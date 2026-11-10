import { addDoc, collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

const LOCAL_ORDERS_KEY = "mayoor-orders";

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
  };
  saveLocalOrder(localOrder);
  return localOrder;
}

export async function updateOrderStatus(orderId, status, order = {}) {
  if (String(orderId).startsWith("LOCAL-")) {
    const updatedOrder = updateLocalOrder(orderId, { status, updatedAt: new Date().toISOString() });
    await queueOrderStatusEmail({ ...order, ...updatedOrder }, status);
    return updatedOrder;
  }

  try {
    await updateDoc(doc(db, "orders", orderId), {
      status,
      updatedAt: new Date().toISOString(),
    });
    await queueOrderStatusEmail({ ...order, id: orderId }, status);
    return { id: orderId, status };
  } catch (error) {
    console.error("Unable to update order status in Firestore:", error);
    throw error;
  }
}

export function getLocalOrderSnapshot() {
  return getLocalOrders();
}

export function subscribeToOrders(onOrders, onError) {
  const unsubscribe = onSnapshot(
    collection(db, "orders"),
    (snapshot) => onOrders([...snapshot.docs.map((item) => ({ id: item.id, ...item.data() })), ...getLocalOrders()]),
    (error) => {
      onOrders(getLocalOrders());
      onError?.(error);
    },
  );
  const refreshLocalOrders = () => onOrders(getLocalOrders());
  window.addEventListener("local-orders-updated", refreshLocalOrders);
  return () => {
    unsubscribe();
    window.removeEventListener("local-orders-updated", refreshLocalOrders);
  };
}
