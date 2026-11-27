import {
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export function normalizeInventoryItems(requestedItems) {
  if (!Array.isArray(requestedItems) || !requestedItems.length) {
    throw new Error("At least one product is required for inventory reservation.");
  }
  const quantities = new Map();
  const names = new Map();
  requestedItems.forEach((item) => {
    const productId = String(item?.id || item?.productId || "").trim();
    const quantity = Number(item?.quantity);
    if (!productId || productId.includes("/") || !Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error("Each item requires a product ID and positive integer quantity.");
    }
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    names.set(productId, String(item?.name || "Product"));
  });
  return [...quantities.entries()]
    .map(([productId, quantity]) => ({ productId, quantity, name: names.get(productId) }))
    .sort((first, second) => first.productId.localeCompare(second.productId));
}

const RETRYABLE_TX_CODES = new Set(["aborted", "unavailable", "deadline-exceeded"]);

export async function runTransactionWithRetry(txFn, maxAttempts = 4) {
  let attempt = 0;
  while (true) {
    try {
      return await runTransaction(db, txFn);
    } catch (error) {
      attempt += 1;
      const code = String(error?.code || "").replace("firestore/", "");
      const isContention = RETRYABLE_TX_CODES.has(code)
        || /too much contention|aborted|transaction.*retry/i.test(error?.message || "");
      if (!isContention || attempt >= maxAttempts) {
        throw error;
      }
      const backoffMs = 60 * 2 ** (attempt - 1) + Math.floor(Math.random() * 60);
      await new Promise((resolve) => window.setTimeout(resolve, backoffMs));
    }
  }
}

export async function reserveProductInventory({ orderReference, items } = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in before reserving inventory.");
  const refId = String(orderReference || "").trim();
  if (!refId) throw new Error("A valid order reference is required.");

  const inventoryItems = normalizeInventoryItems(items);
  const reservationRef = doc(db, "inventoryReservations", `${uid}_${refId}`);
  const productRefs = inventoryItems.map((item) => doc(db, "products", item.productId));

  try {
    return await runTransactionWithRetry(async (transaction) => {
      const reservationSnap = await transaction.get(reservationRef);
      if (reservationSnap.exists()) {
        const existing = reservationSnap.data();
        if (existing.uid === uid && ["reserved", "committed"].includes(existing.status)) {
          return {
            reservationId: reservationRef.id,
            inventoryReservations: existing.inventoryReservations || [],
            status: existing.status,
          };
        }
        throw new Error("This order reference already has an inventory reservation.");
      }

      const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
      const inventoryReservations = productSnaps.map((productSnap, index) => {
        const item = inventoryItems[index];
        if (!productSnap.exists()) {
          return { ...item, tracked: false };
        }
        const rawStock = productSnap.data().inventory;
        if (rawStock === undefined || rawStock === null || rawStock === "") {
          return { ...item, tracked: false };
        }
        const availableStock = Number(rawStock);
        if (!Number.isInteger(availableStock) || availableStock < 0) {
          throw new Error(`Product ${item.name} has invalid inventory.`);
        }
        if (availableStock < item.quantity) {
          throw new Error(`ERR-STOCK-001: Insufficient inventory for ${item.name}; ${availableStock} available.`);
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
          transaction.update(productRefs[index], {
            inventory: reservation.remainingStock,
            updatedAt: new Date().toISOString(),
          });
        }
      });

      transaction.set(reservationRef, {
        uid,
        orderReference: refId,
        items: inventoryItems,
        inventoryReservations,
        status: "reserved",
        createdAt: serverTimestamp(),
      });

      return {
        reservationId: reservationRef.id,
        inventoryReservations,
        status: "reserved",
      };
    });
  } catch (error) {
    if (error?.code === "permission-denied" || /insufficient permissions/i.test(error?.message || "")) {
      throw new Error(
        "Firestore permissions blocked inventory update. Deploy firestore.rules (`firebase deploy --only firestore:rules`) and try again.",
      );
    }
    throw error;
  }
}

export async function commitProductInventoryReservation({ orderReference } = {}) {
  const uid = auth.currentUser?.uid;
  const refId = String(orderReference || "").trim();
  if (!uid || !refId) return { committed: false };

  try {
    const reservationRef = doc(db, "inventoryReservations", `${uid}_${refId}`);
    await updateDoc(reservationRef, {
      status: "committed",
      committedAt: serverTimestamp(),
    });
    return { committed: true };
  } catch {
    return { committed: false };
  }
}

export async function releaseProductInventoryReservation({ orderReference } = {}) {
  const uid = auth.currentUser?.uid;
  const refId = String(orderReference || "").trim();
  if (!uid || !refId) return { released: false };

  const reservationRef = doc(db, "inventoryReservations", `${uid}_${refId}`);
  try {
    return await runTransactionWithRetry(async (transaction) => {
      const reservationSnap = await transaction.get(reservationRef);
      if (!reservationSnap.exists()) return { released: false };

      const reservation = reservationSnap.data();
      if (reservation.status === "released") return { released: true };
      if (reservation.status !== "reserved") return { released: false };

      const tracked = (reservation.inventoryReservations || []).filter((item) => item.tracked);
      const productRefs = tracked.map((item) => doc(db, "products", item.productId));
      const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

      productSnaps.forEach((productSnap, index) => {
        if (!productSnap.exists()) return;
        const currentStock = Number(productSnap.data().inventory);
        if (Number.isInteger(currentStock) && currentStock >= 0) {
          transaction.update(productRefs[index], {
            inventory: currentStock + tracked[index].quantity,
            updatedAt: new Date().toISOString(),
          });
        }
      });

      transaction.update(reservationRef, {
        status: "released",
        releasedAt: serverTimestamp(),
      });
      return { released: true };
    });
  } catch (error) {
    if (error?.code === "permission-denied" || /insufficient permissions/i.test(error?.message || "")) {
      throw new Error(
        "Firestore permissions blocked releasing inventory. Deploy firestore.rules (`firebase deploy --only firestore:rules`).",
      );
    }
    throw error;
  }
}
