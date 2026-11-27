const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const { randomUUID } = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { hasProductImportRole } = require("./authz");
const { createEmailRetryRepository } = require("./repositories/emailRetryRepository");
const { createEmailRetryService } = require("./services/emailRetryService");

admin.initializeApp();

const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const retryFailedEmails = createEmailRetryService(
  createEmailRetryRepository(admin.firestore()),
  logger,
);

exports.retryFailedEmails = onSchedule(
  { schedule: "every 1 minutes", maxInstances: 1, concurrency: 1 },
  async () => retryFailedEmails(),
);

exports.createRazorpayOrder = onCall(
  { secrets: [razorpayKeyId, razorpayKeySecret] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before starting checkout.");
    }

    const amount = Number(request.data?.amount);
    const amountInPaise = Math.round(amount * 100);
    const orderReference = String(request.data?.orderReference || "").trim();
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isSafeInteger(amountInPaise) ||
      !/^[a-zA-Z0-9_-]{1,40}$/.test(orderReference)
    ) {
      throw new HttpsError("invalid-argument", "A valid INR amount and order reference are required.");
    }

    const profileSnapshot = await admin.firestore()
      .collection("customers")
      .doc(request.auth.uid)
      .get();
    if (profileSnapshot.data()?.verificationStatus !== "Verified") {
      throw new HttpsError("permission-denied", "A verified customer profile is required for checkout.");
    }

    try {
      const razorpay = new Razorpay({
        key_id: razorpayKeyId.value(),
        key_secret: razorpayKeySecret.value(),
      });
      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: orderReference,
      });
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        keyId: razorpayKeyId.value(),
      };
    } catch (error) {
      logger.error("Razorpay order creation failed.", error);
      throw new HttpsError("internal", "Unable to initialize the payment session.");
    }
  },
);

exports.approveB2BCreditOrder = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before requesting B2B credit.");
  }

  const amount = Number(request.data?.amount);
  const amountInPaise = Math.round(amount * 100);
  const orderReference = String(request.data?.orderReference || "").trim();
  const requestedItems = request.data?.items;
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(amountInPaise) ||
    !/^[a-zA-Z0-9_-]{1,40}$/.test(orderReference) ||
    !Array.isArray(requestedItems) ||
    !requestedItems.length
  ) {
    throw new HttpsError("invalid-argument", "A valid order amount, reference, and item list are required.");
  }

  const itemQuantities = new Map();
  const itemNames = new Map();
  requestedItems.forEach((item) => {
    const productId = String(item?.id || item?.productId || "").trim();
    const quantity = Number(item?.quantity);
    if (!productId || productId.includes("/") || !Number.isInteger(quantity) || quantity < 1) {
      throw new HttpsError("invalid-argument", "Each order item requires a product ID and positive integer quantity.");
    }
    itemQuantities.set(productId, (itemQuantities.get(productId) || 0) + quantity);
    itemNames.set(productId, String(item?.name || "Product"));
  });
  const inventoryItems = [...itemQuantities.entries()]
    .map(([productId, quantity]) => ({ productId, quantity, name: itemNames.get(productId) }))
    .sort((first, second) => first.productId.localeCompare(second.productId));

  const firestore = admin.firestore();
  const customerReference = firestore.collection("customers").doc(request.auth.uid);
  const scopedOrderKey = `${request.auth.uid}_${orderReference}`;
  const approvalReference = firestore.collection("b2bCreditApprovals").doc(scopedOrderKey);
  const ledgerReference = firestore.collection("CreditLedger").doc(scopedOrderKey);
  const productReferences = inventoryItems.map((item) =>
    firestore.collection("products").doc(item.productId),
  );

  return firestore.runTransaction(async (transaction) => {
    const customerSnapshot = await transaction.get(customerReference);
    const approvalSnapshot = await transaction.get(approvalReference);
    if (!customerSnapshot.exists) {
      throw new HttpsError("not-found", "Customer credit profile could not be found.");
    }

    const customer = customerSnapshot.data();
    const isB2B = customer.customerType === "B2B"
      || customer.accountType === "B2B"
      || customer.type === "B2B"
      || customer.isB2B === true
      || Boolean(customer.shopName || customer.gstin);
    if (customer.verificationStatus !== "Verified" || !isB2B) {
      throw new HttpsError("permission-denied", "A verified B2B buyer is required for credit approval.");
    }

    if (approvalSnapshot.exists) {
      const approval = approvalSnapshot.data();
      if (
        approval.uid === request.auth.uid &&
        approval.amountInPaise === amountInPaise &&
        JSON.stringify(approval.items || []) === JSON.stringify(inventoryItems) &&
        approval.status === "reserved"
      ) {
        return {
          approvalToken: approval.approvalToken,
          availableCredit: approval.availableCredit,
          inventoryReservations: approval.inventoryReservations || [],
          creditLedgerId: approval.creditLedgerId,
          settlementDeadline: approval.settlementDeadline,
        };
      }
      throw new HttpsError("already-exists", "This order reference already has a credit decision.");
    }

    const productSnapshots = await Promise.all(
      productReferences.map((productReference) => transaction.get(productReference)),
    );
    const inventoryReservations = productSnapshots.map((productSnapshot, index) => {
      const item = inventoryItems[index];
      if (!productSnapshot.exists) {
        throw new HttpsError("not-found", `Product ${item.productId} could not be found.`);
      }
      const availableStock = Number(productSnapshot.data().inventory);
      if (!Number.isInteger(availableStock) || availableStock < 0) {
        throw new HttpsError("failed-precondition", `Product ${item.productId} has invalid inventory.`);
      }
      if (availableStock < item.quantity) {
        throw new HttpsError(
          "failed-precondition",
          `ERR-STOCK-001: Insufficient inventory for ${item.name}; ${availableStock} available.`,
          { errorCode: "ERR-STOCK-001" },
        );
      }
      return {
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        previousStock: availableStock,
        remainingStock: availableStock - item.quantity,
      };
    });

    const creditLimit = Number(customer.creditLimit);
    const outstanding = Number(
      customer.creditOutstanding ?? customer.outstandingBalance ?? customer.outstanding ?? 0,
    );
    if (
      !Number.isFinite(creditLimit) ||
      creditLimit < 0 ||
      !Number.isFinite(outstanding) ||
      outstanding < 0
    ) {
      throw new HttpsError("failed-precondition", "A valid B2B credit limit and outstanding balance are required.");
    }

    const creditLimitInPaise = Math.round(creditLimit * 100);
    const outstandingInPaise = Math.round(outstanding * 100);
    const availableCreditInPaise = creditLimitInPaise - outstandingInPaise;
    if (amountInPaise > availableCreditInPaise) {
      throw new HttpsError(
        "failed-precondition",
        `InsufficientCreditException: ERR-CRD-002: Order exceeds available credit of ₹${Math.max(availableCreditInPaise, 0) / 100}.`,
        { errorCode: "ERR-CRD-002" },
      );
    }

    const paymentPeriodDays = Number(customer.paymentPeriodDays ?? customer.creditPaymentPeriodDays ?? 30);
    if (!Number.isInteger(paymentPeriodDays) || paymentPeriodDays < 0) {
      throw new HttpsError("failed-precondition", "A valid B2B payment period is required.");
    }

    const approvalToken = randomUUID();
    const availableCredit = availableCreditInPaise / 100;
    const outstandingAfter = (outstandingInPaise + amountInPaise) / 100;
    const settlementDeadline = new Date(
      Date.now() + paymentPeriodDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.update(customerReference, {
      creditOutstanding: outstandingAfter,
      updatedAt: new Date().toISOString(),
    });
    inventoryReservations.forEach((reservation, index) => {
      transaction.update(productReferences[index], {
        inventory: reservation.remainingStock,
        updatedAt: new Date().toISOString(),
      });
    });
    transaction.create(approvalReference, {
      uid: request.auth.uid,
      orderReference,
      amountInPaise,
      approvalToken,
      availableCredit,
      creditLedgerId: ledgerReference.id,
      settlementDeadline,
      items: inventoryItems,
      inventoryReservations,
      status: "reserved",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(ledgerReference, {
      uid: request.auth.uid,
      orderReference,
      creditLedgerId: ledgerReference.id,
      approvalToken,
      type: "charge",
      status: "posted",
      currency: "INR",
      amount: amountInPaise / 100,
      outstandingBefore: outstandingInPaise / 100,
      outstandingAfter,
      paymentPeriod: `${paymentPeriodDays} days`,
      paymentPeriodDays,
      dueDate: settlementDeadline,
      items: inventoryItems,
      timestamp,
      createdAt: timestamp,
    });

    return {
      approvalToken,
      availableCredit,
      inventoryReservations,
      creditLedgerId: ledgerReference.id,
      settlementDeadline,
    };
  });
});

exports.releaseB2BCreditOrder = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before releasing B2B credit.");
  }

  const orderReferenceId = String(request.data?.orderReference || "").trim();
  const approvalToken = String(request.data?.approvalToken || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(orderReferenceId) || !approvalToken) {
    throw new HttpsError("invalid-argument", "A valid order reference and approval token are required.");
  }

  const firestore = admin.firestore();
  const scopedOrderKey = `${request.auth.uid}_${orderReferenceId}`;
  const approvalReference = firestore.collection("b2bCreditApprovals").doc(scopedOrderKey);
  const customerReference = firestore.collection("customers").doc(request.auth.uid);
  const ledgerReference = firestore.collection("CreditLedger").doc(scopedOrderKey);
  const releaseLedgerReference = firestore.collection("CreditLedger").doc(`${scopedOrderKey}_release`);

  return firestore.runTransaction(async (transaction) => {
    const approvalSnapshot = await transaction.get(approvalReference);
    const customerSnapshot = await transaction.get(customerReference);
    const ledgerSnapshot = await transaction.get(ledgerReference);
    if (!approvalSnapshot.exists || !customerSnapshot.exists) {
      throw new HttpsError("not-found", "Credit approval could not be found.");
    }

    const approval = approvalSnapshot.data();
    if (approval.uid !== request.auth.uid || approval.approvalToken !== approvalToken) {
      throw new HttpsError("permission-denied", "Credit approval does not belong to this customer.");
    }
    if (approval.status === "released") {
      return { released: true, stockRestorations: approval.stockRestorations || [] };
    }
    if (approval.status !== "reserved") {
      throw new HttpsError("failed-precondition", "Credit approval is not releasable.");
    }

    const inventoryItems = Array.isArray(approval.items) ? approval.items : [];
    const productReferences = inventoryItems.map((item) =>
      firestore.collection("products").doc(item.productId),
    );
    const productSnapshots = await Promise.all(
      productReferences.map((productReference) => transaction.get(productReference)),
    );
    const stockRestorations = productSnapshots.map((productSnapshot, index) => {
      const item = inventoryItems[index];
      if (!productSnapshot.exists) {
        throw new HttpsError("not-found", `Product ${item.productId} could not be found to release stock.`);
      }
      const currentStock = Number(productSnapshot.data().inventory);
      if (!Number.isInteger(currentStock) || currentStock < 0) {
        throw new HttpsError("failed-precondition", `Product ${item.productId} has invalid inventory.`);
      }
      return {
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        remainingStock: currentStock + item.quantity,
      };
    });

    const customer = customerSnapshot.data();
    const outstanding = Number(customer.creditOutstanding ?? 0);
    const amount = Number(approval.amountInPaise) / 100;
    transaction.update(customerReference, {
      creditOutstanding: Math.max(0, outstanding - amount),
      updatedAt: new Date().toISOString(),
    });
    stockRestorations.forEach((restoration, index) => {
      transaction.update(productReferences[index], {
        inventory: restoration.remainingStock,
        updatedAt: new Date().toISOString(),
      });
    });
    transaction.update(approvalReference, {
      status: "released",
      releasedAt: admin.firestore.FieldValue.serverTimestamp(),
      stockRestorations,
    });
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const outstandingAfter = Math.max(0, outstanding - amount);
    if (ledgerSnapshot.exists) {
      transaction.update(ledgerReference, {
        status: "reversed",
        reversedAt: timestamp,
        outstandingAfter,
      });
    }
    transaction.create(releaseLedgerReference, {
      uid: request.auth.uid,
      orderReference: orderReferenceId,
      approvalToken,
      type: "credit_release",
      status: "posted",
      currency: "INR",
      amount,
      outstandingBefore: outstanding,
      outstandingAfter,
      stockRestorations,
      timestamp,
      createdAt: timestamp,
    });
    return { released: true, stockRestorations };
  });
});

    function normalizeInventoryItems(requestedItems) {
      if (!Array.isArray(requestedItems) || !requestedItems.length) {
        throw new HttpsError("invalid-argument", "At least one product is required for inventory reservation.");
      }

      const quantities = new Map();
      const names = new Map();
      requestedItems.forEach((item) => {
        const productId = String(item?.id || item?.productId || "").trim();
        const quantity = Number(item?.quantity);
        if (!productId || productId.includes("/") || !Number.isSafeInteger(quantity) || quantity < 1) {
          throw new HttpsError("invalid-argument", "Each item requires a product ID and positive integer quantity.");
        }
        const combinedQuantity = (quantities.get(productId) || 0) + quantity;
        if (!Number.isSafeInteger(combinedQuantity)) {
          throw new HttpsError("invalid-argument", `Quantity for product ${productId} is too large.`);
        }
        quantities.set(productId, combinedQuantity);
        names.set(productId, String(item?.name || "Product"));
      });

      return [...quantities.entries()]
        .map(([productId, quantity]) => ({ productId, quantity, name: names.get(productId) }))
        .sort((first, second) => first.productId.localeCompare(second.productId));
    }

    function validateInventoryOrderReference(value) {
      const orderReference = String(value || "").trim();
      if (!/^[a-zA-Z0-9_-]{1,40}$/.test(orderReference)) {
        throw new HttpsError("invalid-argument", "A valid order reference is required.");
      }
      return orderReference;
    }

    function getInventoryReservationReference(firestore, uid, orderReference) {
      return firestore.collection("inventoryReservations").doc(`${uid}_${orderReference}`);
    }

    exports.reserveProductInventory = onCall(async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in before reserving inventory.");
      }

      const orderReference = validateInventoryOrderReference(request.data?.orderReference);
      const inventoryItems = normalizeInventoryItems(request.data?.items);
      const firestore = admin.firestore();
      const customerReference = firestore.collection("customers").doc(request.auth.uid);
      const reservationReference = getInventoryReservationReference(
        firestore,
        request.auth.uid,
        orderReference,
      );
      const productReferences = inventoryItems.map((item) =>
        firestore.collection("products").doc(item.productId),
      );

      return firestore.runTransaction(async (transaction) => {
        const [customerSnapshot, reservationSnapshot] = await Promise.all([
          transaction.get(customerReference),
          transaction.get(reservationReference),
        ]);
        if (customerSnapshot.data()?.verificationStatus !== "Verified") {
          throw new HttpsError("permission-denied", "A verified customer profile is required for checkout.");
        }

        if (reservationSnapshot.exists) {
          const reservation = reservationSnapshot.data();
          if (
            reservation.uid === request.auth.uid &&
            reservation.orderReference === orderReference &&
            JSON.stringify(reservation.items) === JSON.stringify(inventoryItems) &&
            ["reserved", "committed"].includes(reservation.status)
          ) {
            return {
              reservationId: reservationReference.id,
              inventoryReservations: reservation.inventoryReservations,
              status: reservation.status,
            };
          }
          throw new HttpsError("already-exists", "This order reference already has an inventory reservation.");
        }

        const productSnapshots = await Promise.all(
          productReferences.map((productReference) => transaction.get(productReference)),
        );
        const inventoryReservations = productSnapshots.map((productSnapshot, index) => {
          const item = inventoryItems[index];
          if (!productSnapshot.exists) {
            throw new HttpsError("not-found", `Product ${item.productId} could not be found.`);
          }

          const rawStock = productSnapshot.data().inventory;
          if (rawStock === undefined || rawStock === null || rawStock === "") {
            return { ...item, tracked: false };
          }
          const availableStock = Number(rawStock);
          if (!Number.isInteger(availableStock) || availableStock < 0) {
            throw new HttpsError("failed-precondition", `Product ${item.productId} has invalid inventory.`);
          }
          if (availableStock < item.quantity) {
            throw new HttpsError(
              "failed-precondition",
              `ERR-STOCK-001: Insufficient inventory for ${item.name}; ${availableStock} available.`,
              { errorCode: "ERR-STOCK-001" },
            );
          }
          return {
            ...item,
            tracked: true,
            previousStock: availableStock,
            remainingStock: availableStock - item.quantity,
          };
        });

        inventoryReservations.forEach((reservation, index) => {
          if (reservation.tracked) {
            transaction.update(productReferences[index], {
              inventory: reservation.remainingStock,
              updatedAt: new Date().toISOString(),
            });
          }
        });
        transaction.create(reservationReference, {
          uid: request.auth.uid,
          orderReference,
          items: inventoryItems,
          inventoryReservations,
          status: "reserved",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          reservationId: reservationReference.id,
          inventoryReservations,
          status: "reserved",
        };
      });
    });

    exports.commitProductInventoryReservation = onCall(async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in before completing an inventory reservation.");
      }
      const orderReference = validateInventoryOrderReference(request.data?.orderReference);
      const firestore = admin.firestore();
      const reservationReference = getInventoryReservationReference(
        firestore,
        request.auth.uid,
        orderReference,
      );

      return firestore.runTransaction(async (transaction) => {
        const reservationSnapshot = await transaction.get(reservationReference);
        if (!reservationSnapshot.exists) {
          throw new HttpsError("not-found", "Inventory reservation could not be found.");
        }
        const reservation = reservationSnapshot.data();
        if (reservation.uid !== request.auth.uid) {
          throw new HttpsError("permission-denied", "Inventory reservation belongs to another customer.");
        }
        if (reservation.status === "committed") return { committed: true };
        if (reservation.status !== "reserved") {
          throw new HttpsError("failed-precondition", "Inventory reservation is not active.");
        }

        transaction.update(reservationReference, {
          status: "committed",
          committedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { committed: true };
      });
    });

    exports.releaseProductInventoryReservation = onCall(async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in before releasing an inventory reservation.");
      }
      const orderReference = validateInventoryOrderReference(request.data?.orderReference);
      const firestore = admin.firestore();
      const reservationReference = getInventoryReservationReference(
        firestore,
        request.auth.uid,
        orderReference,
      );

      return firestore.runTransaction(async (transaction) => {
        const reservationSnapshot = await transaction.get(reservationReference);
        if (!reservationSnapshot.exists) return { released: false };
        const reservation = reservationSnapshot.data();
        if (reservation.uid !== request.auth.uid) {
          throw new HttpsError("permission-denied", "Inventory reservation belongs to another customer.");
        }
        if (reservation.status === "released") return { released: true };
        if (reservation.status !== "reserved") {
          throw new HttpsError("failed-precondition", "Only an active inventory reservation can be released.");
        }

        const inventoryReservations = Array.isArray(reservation.inventoryReservations)
          ? reservation.inventoryReservations
          : [];
        const trackedReservations = inventoryReservations.filter((item) => item.tracked);
        const productReferences = trackedReservations.map((item) =>
          firestore.collection("products").doc(item.productId),
        );
        const productSnapshots = await Promise.all(
          productReferences.map((productReference) => transaction.get(productReference)),
        );
        const stockRestorations = productSnapshots.map((productSnapshot, index) => {
          const item = trackedReservations[index];
          if (!productSnapshot.exists) {
            throw new HttpsError("not-found", `Product ${item.productId} could not be found to release stock.`);
          }
          const currentStock = Number(productSnapshot.data().inventory);
          if (!Number.isInteger(currentStock) || currentStock < 0) {
            throw new HttpsError("failed-precondition", `Product ${item.productId} has invalid inventory.`);
          }
          return {
            ...item,
            remainingStock: currentStock + item.quantity,
          };
        });

        stockRestorations.forEach((restoration, index) => {
          transaction.update(productReferences[index], {
            inventory: restoration.remainingStock,
            updatedAt: new Date().toISOString(),
          });
        });

        transaction.update(reservationReference, {
          status: "released",
          releasedAt: admin.firestore.FieldValue.serverTimestamp(),
          stockRestorations,
        });
        return { released: true, stockRestorations };
      });
    });

exports.importProductCatalog = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before importing products.");
  }
  if (!hasProductImportRole(request.auth.token)) {
    throw new HttpsError(
      "permission-denied",
      "Only STORE_OWNER or WAREHOUSE_STAFF can import product CSV data.",
    );
  }

  const requestedProducts = request.data?.products;
  if (!Array.isArray(requestedProducts) || requestedProducts.length < 1 || requestedProducts.length > 500) {
    throw new HttpsError("invalid-argument", "Provide between 1 and 500 products per import request.");
  }

  const productIds = new Set();
  const products = requestedProducts.map((product) => {
    const id = String(product?.id || "").trim();
    const name = String(product?.name || "").trim();
    const price = Number(product?.price);
    const inventory = Number(product?.inventory);
    const moq = Number(product?.moq ?? 1);
    if (
      !id ||
      id.length > 1500 ||
      id.includes("/") ||
      !name ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(inventory) ||
      inventory < 0 ||
      !Number.isInteger(moq) ||
      moq < 1
    ) {
      throw new HttpsError("invalid-argument", "Each product requires a valid ID, name, price, inventory, and MOQ.");
    }
    if (productIds.has(id)) {
      throw new HttpsError("invalid-argument", `Product ID ${id} appears more than once in this import batch.`);
    }
    productIds.add(id);

    return {
      id,
      name,
      price,
      inventory,
      moq,
      ...(product.sku ? { sku: String(product.sku) } : {}),
      ...(product.brand ? { brand: String(product.brand) } : {}),
      ...(product.category ? { category: String(product.category) } : {}),
      ...(product.image ? { image: String(product.image) } : {}),
      ...(product.msrp !== undefined ? { msrp: Number(product.msrp) } : {}),
      ...(product.wholesalePrice !== undefined
        ? { wholesalePrice: Number(product.wholesalePrice) }
        : {}),
    };
  });

  const firestore = admin.firestore();
  const productReferences = products.map((product) =>
    firestore.collection("products").doc(product.id),
  );
  const existingSnapshots = productReferences.length
    ? await firestore.getAll(...productReferences)
    : [];
  const batch = firestore.batch();
  products.forEach((product, index) => {
    batch.set(productReferences[index], {
      ...product,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
  await batch.commit();

  const modifiedCount = existingSnapshots.filter((snapshot) => snapshot.exists).length;
  return {
    evaluatedCount: products.length,
    createdCount: products.length - modifiedCount,
    modifiedCount,
    failedCount: 0,
  };
});
