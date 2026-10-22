import { addDoc, collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

const LOCAL_ORDERS_KEY = "mayoor-orders";

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

export function createOrder(order) {
  return addDoc(collection(db, "orders"), {
    ...order,
    createdAt: order.createdAt || new Date().toISOString(),
  });
}

export function createLocalOrder(order) {
  const localOrder = {
    ...order,
    id: order.id || `LOCAL-${Date.now().toString(36).toUpperCase()}`,
    syncStatus: "pending",
  };
  saveLocalOrder(localOrder);
  return localOrder;
}

export async function updateOrderStatus(orderId, status) {
  if (String(orderId).startsWith("LOCAL-")) {
    return updateLocalOrder(orderId, { status, updatedAt: new Date().toISOString() });
  }

  try {
    await updateDoc(doc(db, "orders", orderId), {
      status,
      updatedAt: new Date().toISOString(),
    });
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
