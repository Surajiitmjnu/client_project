import { doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { normalizeInventoryItems, runTransactionWithRetry } from "./productInventory";

export async function approveB2BCreditOrder({ amount, orderReference, items } = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in before requesting B2B credit.");

  const numericAmount = Number(amount);
  const amountInPaise = Math.round(numericAmount * 100);
  const refId = String(orderReference || "").trim();
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !refId || !Array.isArray(items) || !items.length) {
    throw new Error("A valid order amount, reference, and item list are required.");
  }

  const normalizedItems = normalizeInventoryItems(items);
  const scopedKey = `${uid}_${refId}`;
  const customerRef = doc(db, "customers", uid);
  const approvalRef = doc(db, "b2bCreditApprovals", scopedKey);
  const ledgerRef = doc(db, "CreditLedger", scopedKey);
  const productRefs = normalizedItems.map((item) => doc(db, "products", item.productId));

  return runTransactionWithRetry(async (transaction) => {
    const [customerSnap, approvalSnap] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(approvalRef),
    ]);
    if (!customerSnap.exists()) {
      throw new Error("Customer credit profile could not be found.");
    }
    const customer = customerSnap.data();
    const isB2B = customer.customerType === "B2B"
      || customer.accountType === "B2B"
      || customer.type === "B2B"
      || customer.isB2B === true
      || Boolean(customer.shopName || customer.gstin);
    if (customer.verificationStatus !== "Verified" || !isB2B) {
      throw new Error("A verified B2B buyer is required for credit approval.");
    }
    if (approvalSnap.exists()) {
      const existing = approvalSnap.data();
      return {
        approvalToken: existing.approvalToken,
        availableCredit: existing.availableCredit,
        inventoryReservations: existing.inventoryReservations || [],
        creditLedgerId: existing.creditLedgerId,
        settlementDeadline: existing.settlementDeadline,
      };
    }

    const creditLimit = Number(customer.creditLimit ?? customer.creditBalance ?? 0);
    const outstanding = Number(customer.creditOutstanding ?? 0);
    const availableCredit = Math.max(0, creditLimit - outstanding);
    if (numericAmount > availableCredit) {
      throw new Error("ERR-CRD-002: Insufficient B2B credit for this order amount.");
    }

    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    const inventoryReservations = productSnaps.map((snap, index) => {
      const item = normalizedItems[index];
      const qty = item.quantity;
      if (!snap.exists()) {
        return { productId: item.productId, name: item.name, quantity: qty, tracked: false };
      }
      const rawStock = snap.data().inventory;
      if (rawStock === undefined || rawStock === null || rawStock === "") {
        return { productId: snap.id, name: item.name || "Product", quantity: qty, tracked: false };
      }
      const availableStock = Number(rawStock);
      if (availableStock < qty) {
        throw new Error(`ERR-STOCK-001: Insufficient inventory for ${item.name}; ${availableStock} available.`);
      }
      return {
        productId: snap.id,
        name: item.name || "Product",
        quantity: qty,
        tracked: true,
        previousStock: availableStock,
        remainingStock: availableStock - qty,
      };
    });

    inventoryReservations.forEach((res, index) => {
      if (res.tracked) {
        transaction.update(productRefs[index], {
          inventory: res.remainingStock,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const periodDays = Number(customer.paymentPeriodDays) || 30;
    const settlementDeadline = new Date(Date.now() + periodDays * 86400000).toISOString();
    const approvalToken = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    transaction.update(customerRef, {
      creditOutstanding: Number((outstanding + numericAmount).toFixed(2)),
      updatedAt: new Date().toISOString(),
    });
    transaction.set(approvalRef, {
      uid,
      orderReference: refId,
      amountInPaise,
      amount: numericAmount,
      approvalToken,
      availableCredit: Number((availableCredit - numericAmount).toFixed(2)),
      inventoryReservations,
      creditLedgerId: ledgerRef.id,
      settlementDeadline,
      status: "reserved",
      createdAt: serverTimestamp(),
    });
    transaction.set(ledgerRef, {
      uid,
      orderReference: refId,
      amount: numericAmount,
      status: "UNSETTLED",
      settlementDeadline,
      createdAt: serverTimestamp(),
    });

    return {
      approvalToken,
      availableCredit: Number((availableCredit - numericAmount).toFixed(2)),
      inventoryReservations,
      creditLedgerId: ledgerRef.id,
      settlementDeadline,
    };
  });
}

export async function releaseB2BCreditOrder({ orderReference, approvalToken } = {}) {
  const uid = auth.currentUser?.uid;
  const refId = String(orderReference || "").trim();
  if (!uid || !refId || !approvalToken) return { released: false };

  const scopedKey = `${uid}_${refId}`;
  const approvalRef = doc(db, "b2bCreditApprovals", scopedKey);
  const customerRef = doc(db, "customers", uid);
  const ledgerRef = doc(db, "CreditLedger", scopedKey);

  return runTransactionWithRetry(async (transaction) => {
    const [approvalSnap, customerSnap] = await Promise.all([
      transaction.get(approvalRef),
      transaction.get(customerRef),
    ]);
    if (!approvalSnap.exists() || !customerSnap.exists()) return { released: false };
    const approval = approvalSnap.data();
    if (approval.uid !== uid || approval.approvalToken !== approvalToken || approval.status === "released") {
      return { released: approval.status === "released" };
    }

    const tracked = (approval.inventoryReservations || []).filter((item) => item.tracked);
    const productRefs = tracked.map((item) => doc(db, "products", item.productId));
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    productSnaps.forEach((snap, index) => {
      if (!snap.exists()) return;
      const stock = Number(snap.data().inventory);
      if (Number.isInteger(stock) && stock >= 0) {
        transaction.update(productRefs[index], {
          inventory: stock + tracked[index].quantity,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const outstanding = Number(customerSnap.data().creditOutstanding ?? 0);
    transaction.update(customerRef, {
      creditOutstanding: Math.max(0, Number((outstanding - Number(approval.amount || 0)).toFixed(2))),
      updatedAt: new Date().toISOString(),
    });
    transaction.update(approvalRef, { status: "released", releasedAt: serverTimestamp() });
    transaction.update(ledgerRef, { status: "RELEASED", releasedAt: serverTimestamp() });
    return { released: true };
  });
}
