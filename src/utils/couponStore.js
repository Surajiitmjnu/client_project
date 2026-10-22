import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const LOCAL_COUPONS_KEY = "mayoor-coupons";

function readLocalCoupons() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_COUPONS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveLocalCoupons(coupons) {
  localStorage.setItem(LOCAL_COUPONS_KEY, JSON.stringify(coupons));
  window.dispatchEvent(new Event("coupons-updated"));
}

export function normalizeCouponCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function getLocalCoupons() {
  return readLocalCoupons();
}

export async function saveCoupon(coupon) {
  const normalized = {
    ...coupon,
    code: normalizeCouponCode(coupon.code),
    discountPercent: Math.min(100, Math.max(0, Number(coupon.discountPercent) || 0)),
    isActive: coupon.isActive !== false,
    updatedAt: new Date().toISOString(),
  };
  let synced = true;
  try {
    await Promise.race([
      setDoc(doc(db, "coupons", normalized.code), normalized, { merge: true }),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("Coupon save timed out.")), 10000)),
    ]);
  } catch (error) {
    console.error("Unable to save coupon to Firestore; saving locally:", error);
    synced = false;
  }
  const next = readLocalCoupons().filter((item) => item.code !== normalized.code);
  saveLocalCoupons([normalized, ...next]);
  return { ...normalized, synced };
}

export async function removeCoupon(code) {
  const normalizedCode = normalizeCouponCode(code);
  try {
    await deleteDoc(doc(db, "coupons", normalizedCode));
  } catch (error) {
    console.error("Unable to delete coupon from Firestore; removing local copy:", error);
  }
  saveLocalCoupons(readLocalCoupons().filter((item) => item.code !== normalizedCode));
}

export function subscribeToCoupons(onCoupons, onError) {
  let firestoreCoupons = [];
  const emit = () => {
    const localCoupons = readLocalCoupons();
    const merged = [...firestoreCoupons, ...localCoupons].filter((coupon, index, coupons) =>
      coupons.findIndex((item) => item.code === coupon.code) === index,
    );
    onCoupons(merged);
  };
  const unsubscribe = onSnapshot(
    collection(db, "coupons"),
    (snapshot) => {
      firestoreCoupons = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      emit();
    },
    (error) => {
      emit();
      onError?.(error);
    },
  );
  const refresh = () => emit();
  window.addEventListener("coupons-updated", refresh);
  return () => {
    unsubscribe();
    window.removeEventListener("coupons-updated", refresh);
  };
}
