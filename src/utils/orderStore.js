import { addDoc, collection, doc, onSnapshot, runTransaction } from "firebase/firestore";
import { auth, db } from "../firebase";

const LOCAL_ORDERS_KEY = "mayoor-orders";
const INVOICE_FIELDS = [
  "orderId",
  "createdAt",
  "items",
  "total",
  "shippingCharges",
  "customer",
  "customerName",
  "customerEmail",
  "phone",
  "shopName",
  "shopAddress",
  "gstin",
  "status",
  "paymentStatus",
  "payment",
  "paymentType",
  "paymentMethod",
  "isB2BCredit",
  "creditStatus",
  "creditApprovalToken",
  "creditLedgerId",
  "creditLedgerPath",
  "settlementDeadline",
  "creditApplied",
  "taxableAmount",
  "gstPercent",
  "gstAmount",
];

function invoiceSnapshotFromOrder(order) {
  return INVOICE_FIELDS.reduce((snapshot, field) => {
    if (Object.prototype.hasOwnProperty.call(order, field)) {
      snapshot[field] = order[field];
    }
    return snapshot;
  }, {});
}

function invoiceLockedError() {
  const error = new Error("ERR-INV-002: Finalized invoice details cannot be changed.");
  error.code = "ERR-INV-002";
  return error;
}

const ALLOWED_STATUS_TRANSITIONS = {
  PENDING: ["CONFIRMED", "PACKAGING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  CONFIRMED: ["PACKAGING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  PACKAGING: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  COMPLETED: [],
  CANCELLED: [],
};

export function normalizeOrderStatus(status) {
  const upper = String(status || "PENDING").trim().toUpperCase().replace(/\s+/g, "_");
  if (upper === "SHIPPED") return "OUT_FOR_DELIVERY";
  if (upper === "COMPLETED") return "DELIVERED";
  return upper;
}

export function getAllowedNextOrderStatuses(currentStatus) {
  const normalized = normalizeOrderStatus(currentStatus);
  return ALLOWED_STATUS_TRANSITIONS[normalized] || [];
}

function assertValidStatusTransition(currentStatus, targetStatus) {
  const from = normalizeOrderStatus(currentStatus);
  const to = normalizeOrderStatus(targetStatus);
  if (from === "DELIVERED" || from === "COMPLETED" || from === "CANCELLED") {
    const error = new Error("ERR-ORD-005: Delivered or cancelled orders are immutable.");
    error.code = "ERR-ORD-005";
    throw error;
  }
  if (from === to) return;
  const allowed = ALLOWED_STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    const error = new Error(`InvalidStateTransitionException: Cannot transition order from ${from} to ${to}.`);
    error.code = "InvalidStateTransitionException";
    throw error;
  }
}

function assertOrderCanBeCancelled(order, userId) {
  if (order.customerId !== userId) {
    throw new Error("You can only cancel your own orders.");
  }
  const normalized = normalizeOrderStatus(order.status);
  if (!["PENDING", "CONFIRMED"].includes(normalized)) {
    throw new Error("Only pending or confirmed orders can be cancelled before packaging.");
  }
}

export async function cancelOrder(orderId) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Sign in to cancel an order.");
  if (!orderId) throw new Error("An order is required for cancellation.");

  if (String(orderId).startsWith("LOCAL-")) {
    const currentOrder = getLocalOrders().find((order) => order.id === orderId);
    if (!currentOrder) throw new Error("Order could not be found.");
    assertOrderCanBeCancelled(currentOrder, userId);
    return updateLocalOrder(orderId, {
      status: "Cancelled",
      updatedAt: new Date().toISOString(),
    });
  }

  const orderReference = doc(db, "orders", orderId);
  return runTransaction(db, async (transaction) => {
    const orderDocument = await transaction.get(orderReference);
    if (!orderDocument.exists()) throw new Error("Order could not be found.");

    const order = orderDocument.data();
    if (order.invoiceSnapshot) throw invoiceLockedError();
    assertOrderCanBeCancelled(order, userId);
    const updatedAt = new Date().toISOString();
    transaction.update(orderReference, { status: "Cancelled", updatedAt });
    return { id: orderId, ...order, status: "Cancelled", updatedAt };
  });
}

export async function finalizeOrderInvoice(order) {
  const orderId = order.id;
  if (!orderId) {
    throw new Error("Invoice cannot be finalized without an order ID.");
  }

  if (String(orderId).startsWith("LOCAL-")) {
    const currentOrder = getLocalOrders().find((item) => item.id === orderId);
    if (!currentOrder) {
      throw new Error("Order could not be found to finalize its invoice.");
    }
    if (currentOrder.invoiceSnapshot) return currentOrder.invoiceSnapshot;

    const invoiceSnapshot = invoiceSnapshotFromOrder(currentOrder);
    updateLocalOrder(orderId, {
      invoiceSnapshot,
      invoiceFinalizedAt: new Date().toISOString(),
    });
    return invoiceSnapshot;
  }

  const orderReference = doc(db, "orders", orderId);
  return runTransaction(db, async (transaction) => {
    const orderDocument = await transaction.get(orderReference);
    if (!orderDocument.exists()) {
      throw new Error("Order could not be found to finalize its invoice.");
    }

    const currentOrder = orderDocument.data();
    if (currentOrder.invoiceSnapshot) return currentOrder.invoiceSnapshot;

    const invoiceSnapshot = invoiceSnapshotFromOrder(currentOrder);
    transaction.update(orderReference, {
      invoiceSnapshot,
      invoiceFinalizedAt: new Date().toISOString(),
    });
    return invoiceSnapshot;
  });
}

export async function updateOrderDetails(orderId, changes) {
  if (!orderId || !changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new Error("A valid order ID and order changes are required.");
  }
  if ("invoiceSnapshot" in changes || "invoiceFinalizedAt" in changes) {
    throw new Error("Invoice finalization fields are managed by invoice generation.");
  }

  if (String(orderId).startsWith("LOCAL-")) {
    const currentOrder = getLocalOrders().find((order) => order.id === orderId);
    if (!currentOrder) throw new Error("Order could not be found.");
    if (currentOrder.invoiceSnapshot) throw invoiceLockedError();
    return updateLocalOrder(orderId, { ...changes, updatedAt: new Date().toISOString() });
  }

  const orderReference = doc(db, "orders", orderId);
  return runTransaction(db, async (transaction) => {
    const orderDocument = await transaction.get(orderReference);
    if (!orderDocument.exists()) throw new Error("Order could not be found.");
    if (orderDocument.data().invoiceSnapshot) throw invoiceLockedError();

    transaction.update(orderReference, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    return { id: orderId, ...orderDocument.data(), ...changes };
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[character]));
}

export function generateOrderId() {
  const existingIds = new Set(getLocalOrders().map((order) => order.orderId));
  let orderId = "";
  do {
    const firstLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const digits = Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, "0");
    orderId = `${firstLetter}${digits}`;
  } while (existingIds.has(orderId));
  return orderId;
}

function getLocalOrders() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalOrder(order) {
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([order, ...getLocalOrders()]));
  window.dispatchEvent(new CustomEvent("local-orders-updated"));
}

function updateLocalOrder(orderId, updates) {
  const updatedOrders = getLocalOrders().map((order) =>
    order.id === orderId ? { ...order, ...updates } : order,
  );
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updatedOrders));
  window.dispatchEvent(new CustomEvent("local-orders-updated"));
  return updatedOrders.find((order) => order.id === orderId);
}

async function queueOrderStatusEmail(order, status) {
  const recipient = order.customerEmail || (String(order.customer || "").includes("@") ? order.customer : "");
  if (!recipient) {
    throw new Error("This order does not have a customer email address.");
  }

  const orderNumber = order.orderId || order.id;
  const customerName = escapeHtml(order.customerName || order.customer || "Customer");
  await addDoc(collection(db, "mail"), {
    to: recipient,
    message: {
      subject: `Order ${orderNumber} status updated to ${status}`,
      text: `Your Mayoor Store order ${orderNumber} is now ${status}.`,
      html: `<p>Hi ${customerName},</p><p>Your Mayoor Store order <strong>${escapeHtml(orderNumber)}</strong> is now <strong>${escapeHtml(status)}</strong>.</p><p>Thank you for shopping with us.</p>`,
    },
    orderId: orderNumber,
    status,
    createdAt: new Date().toISOString(),
  });
}

function formatEmailMoney(value) {
  return `₹${(Number(value) || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export async function queueOrderConfirmationEmail(order) {
  const recipient = order.customerEmail;
  if (!recipient) {
    throw new Error("No customer email address is associated with this order.");
  }

  const orderNumber = order.orderId || order.id;
  const customerName = escapeHtml(order.customerName || order.customer || "Customer");
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const lineTotal = (Number(item.price) || 0) * quantity;
    return `${item.name || "Product"} x ${quantity} — ${formatEmailMoney(lineTotal)}`;
  });
  const text = [
    `Hi ${order.customerName || order.customer || "Customer"},`,
    "",
    `Your Mayoor Store order ${orderNumber} has been placed successfully.`,
    "",
    ...itemLines,
    "",
    `Order total: ${formatEmailMoney(order.total)}`,
    "",
    "Thank you for shopping with Mayoor Store.",
  ].join("\n");
  const itemRows = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const lineTotal = (Number(item.price) || 0) * quantity;
    return `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(item.name || "Product")}</td><td style="padding:8px;border-bottom:1px solid #eee">${quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatEmailMoney(lineTotal)}</td></tr>`;
  }).join("");

  await addDoc(collection(db, "mail"), {
    to: recipient,
    message: {
      subject: `Order ${orderNumber} confirmed — Mayoor Store`,
      text,
      html: `<div style="font-family:Arial,sans-serif;color:#173f35;max-width:600px;margin:auto"><h2>Order confirmed</h2><p>Hi ${customerName},</p><p>Your Mayoor Store order <strong>${escapeHtml(orderNumber)}</strong> has been placed successfully.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:left">Qty</th><th style="padding:8px;text-align:right">Amount</th></tr></thead><tbody>${itemRows}</tbody></table><p style="text-align:right;font-size:18px"><strong>Order total: ${formatEmailMoney(order.total)}</strong></p><p>Thank you for shopping with Mayoor Store.</p></div>`,
    },
    orderId: orderNumber,
    type: "order_confirmation",
    createdAt: new Date().toISOString(),
  });
}

export function createOrder(order) {
  return addDoc(collection(db, "orders"), {
    ...order,
    orderId: order.orderId || generateOrderId(),
    createdAt: order.createdAt || new Date().toISOString(),
  });
}

export function createLocalOrder(order) {
  const localOrder = {
    ...order,
    id: order.id || `LOCAL-${Date.now().toString(36).toUpperCase()}`,
    orderId: order.orderId || generateOrderId(),
    syncStatus: "pending",
    confirmationEmailStatus: order.confirmationEmailStatus || "not_queued",
  };
  saveLocalOrder(localOrder);
  return localOrder;
}

export async function updateOrderStatus(orderId, status, order = {}) {
  const normalizedTarget = normalizeOrderStatus(status);
  if (String(orderId).startsWith("LOCAL-")) {
    const currentOrder = getLocalOrders().find((item) => item.id === orderId);
    if (currentOrder?.invoiceSnapshot) throw invoiceLockedError();
    if (currentOrder) assertValidStatusTransition(currentOrder.status, normalizedTarget);
    const updatedOrder = updateLocalOrder(orderId, { status: normalizedTarget, updatedAt: new Date().toISOString() });
    await queueOrderStatusEmail({ ...order, ...updatedOrder }, normalizedTarget);
    return updatedOrder;
  }

  try {
    const orderReference = doc(db, "orders", orderId);
    const updatedOrder = await runTransaction(db, async (transaction) => {
      const orderDocument = await transaction.get(orderReference);
      if (!orderDocument.exists()) throw new Error("Order could not be found.");
      const currentOrder = orderDocument.data();
      if (currentOrder.invoiceSnapshot) throw invoiceLockedError();
      assertValidStatusTransition(currentOrder.status, normalizedTarget);

      const updatedAt = new Date().toISOString();
      transaction.update(orderReference, { status: normalizedTarget, updatedAt });
      return { id: orderId, ...currentOrder, status: normalizedTarget, updatedAt };
    });
    await queueOrderStatusEmail({ ...updatedOrder, ...order, id: orderId }, normalizedTarget);
    return { id: orderId, status: normalizedTarget };
  } catch (error) {
    console.error("Unable to update order status in Firestore:", error);
    throw error;
  }
}

export function getLocalOrderSnapshot() {
  return getLocalOrders();
}

let isSyncingLocalOrders = false;

export async function syncPendingLocalOrders(existingFirestoreOrders = []) {
  const uid = auth.currentUser?.uid;
  if (!uid || isSyncingLocalOrders) return;
  const localOrders = getLocalOrders();
  const pendingForUser = localOrders.filter(
    (order) => order.syncStatus === "pending" && order.customerId === uid,
  );
  if (!pendingForUser.length) return;

  isSyncingLocalOrders = true;
  try {
    const syncedOrderIds = new Set(existingFirestoreOrders.map((item) => item.orderId).filter(Boolean));
    const remainingLocal = [...localOrders];
    for (const localOrder of pendingForUser) {
      if (localOrder.orderId && syncedOrderIds.has(localOrder.orderId)) {
        const idx = remainingLocal.findIndex((item) => item.id === localOrder.id);
        if (idx !== -1) remainingLocal.splice(idx, 1);
        continue;
      }
      try {
        const { id: _localId, syncStatus: _syncStatus, ...orderPayload } = localOrder;
        await createOrder(orderPayload);
        const idx = remainingLocal.findIndex((item) => item.id === localOrder.id);
        if (idx !== -1) remainingLocal.splice(idx, 1);
      } catch {
        // Leave in localStorage if Firestore write is still blocked/offline.
      }
    }
    if (remainingLocal.length !== localOrders.length) {
      try {
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(remainingLocal));
        window.dispatchEvent(new Event("local-orders-updated"));
      } catch {
        // Ignore storage errors.
      }
    }
  } finally {
    isSyncingLocalOrders = false;
  }
}

export function subscribeToOrders(onOrders, onError) {
  let firestoreOrders = [];
  const emitOrders = () => {
    const firestoreOrderIds = new Set(firestoreOrders.map((item) => item.orderId).filter(Boolean));
    const unsyncedLocal = getLocalOrders().filter(
      (item) => !item.orderId || !firestoreOrderIds.has(item.orderId),
    );
    onOrders([...firestoreOrders, ...unsyncedLocal]);
  };

  const unsubscribe = onSnapshot(
    collection(db, "orders"),
    (snapshot) => {
      firestoreOrders = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      emitOrders();
      void syncPendingLocalOrders(firestoreOrders);
    },
    (error) => {
      emitOrders();
      onError?.(error);
    },
  );
  const refreshLocalOrders = () => emitOrders();
  window.addEventListener("local-orders-updated", refreshLocalOrders);
  return () => {
    unsubscribe();
    window.removeEventListener("local-orders-updated", refreshLocalOrders);
  };
}
