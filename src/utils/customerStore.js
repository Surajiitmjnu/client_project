import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const CUSTOMERS_KEY = "mayoor-registered-customers";
const LOYALTY_KEY = "mayoor-loyal-customers";
const CREDIT_KEY = "mayoor-customer-credits";
const PROFILE_KEY = "mayoor-customer-profiles";

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function getProfileList() {
  return readList(PROFILE_KEY);
}

export function registerCustomer(user) {
  if (!user?.uid && !user?.email) return;
  const customers = readList(CUSTOMERS_KEY);
  const existing = customers.find(
    (customer) =>
      (user.uid && customer.uid === user.uid) ||
      (user.email && customer.email?.toLowerCase() === user.email.toLowerCase()),
  );
  const customer = {
    uid: user.uid || existing?.uid || user.email,
    name: user.displayName || existing?.name || user.email?.split("@")[0] || "Customer",
    email: user.email || existing?.email || "",
  };

  const next = existing
    ? customers.map((item) => (item.uid === existing.uid ? { ...item, ...customer } : item))
    : [...customers, customer];
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(next));
}

export async function syncCustomerProfile(user) {
  if (!user?.uid) return;
  registerCustomer(user);
  const profile = {
    uid: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Customer",
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    providerIds: user.providerData?.map(({ providerId }) => providerId) || [],
    isLoyal: isLoyalCustomer(user.uid),
    creditBalance: getCustomerCredit(user.uid),
    lastLoginAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, "customers", user.uid), profile, { merge: true });
    return true;
  } catch (error) {
    console.error(
      "Unable to sync customer profile to Firestore. Local customer data remains available. Check the deployed Firestore rules for customers/{uid}:",
      error,
    );
    return false;
  }
}

export function getCustomerProfile(uid) {
  if (!uid) return null;
  return getProfileList().find((profile) => profile.uid === uid) || null;
}

export async function saveCustomerProfile(uid, details) {
  if (!uid) throw new Error("A signed-in customer is required.");
  const existing = getCustomerProfile(uid);
  const profile = {
    ...existing,
    ...details,
    uid,
    verificationStatus: "Pending",
    updatedAt: new Date().toISOString(),
  };
  const profiles = getProfileList().filter((item) => item.uid !== uid);
  localStorage.setItem(PROFILE_KEY, JSON.stringify([...profiles, profile]));
  window.dispatchEvent(new CustomEvent("customer-profile-updated", { detail: profile }));
  try {
    await setDoc(doc(db, "customers", uid), {
      ...details,
      verificationStatus: "Pending",
      updatedAt: profile.updatedAt,
    }, { merge: true });
    return { ...profile, syncStatus: "synced" };
  } catch (error) {
    console.error("Unable to save customer profile to Firestore:", error);
    return { ...profile, syncStatus: "local" };
  }
}

export async function setCustomerVerification(uid, verificationStatus) {
  if (!uid) return;
  const profiles = getProfileList();
  const existing = profiles.find((profile) => profile.uid === uid) || { uid };
  const profile = { ...existing, verificationStatus, updatedAt: new Date().toISOString() };
  localStorage.setItem(PROFILE_KEY, JSON.stringify([
    ...profiles.filter((item) => item.uid !== uid),
    profile,
  ]));
  window.dispatchEvent(new CustomEvent("customer-profile-updated", { detail: profile }));
  try {
    await setDoc(doc(db, "customers", uid), {
      verificationStatus,
      updatedAt: profile.updatedAt,
    }, { merge: true });
  } catch (error) {
    console.error("Unable to update customer verification in Firestore:", error);
    throw error;
  }
}

export function isCustomerVerified(uid) {
  return getCustomerProfile(uid)?.verificationStatus === "Verified";
}

export function subscribeToCustomerProfile(uid, onProfile, onError) {
  if (!uid) return () => {};
  return onSnapshot(doc(db, "customers", uid), (snapshot) => {
    if (snapshot.exists()) onProfile({ uid, ...snapshot.data() });
  }, onError);
}

export function subscribeToCustomers(onCustomers, onError) {
  return onSnapshot(
    collection(db, "customers"),
    (snapshot) => {
      onCustomers(snapshot.docs.map((customer) => ({
        ...customer.data(),
        isLoyal: Boolean(customer.data().isLoyal),
        creditBalance: Math.max(0, Number(customer.data().creditBalance) || 0),
      })));
    },
    onError,
  );
}

export function getRegisteredCustomers() {
  return readList(CUSTOMERS_KEY).map((customer) => ({
    ...customer,
    ...getCustomerProfile(customer.uid),
    isLoyal: readList(LOYALTY_KEY).includes(customer.uid),
    creditBalance: getCustomerCredit(customer.uid),
  }));
}

export function setCustomerLoyalty(uid, isLoyal) {
  const loyalCustomers = readList(LOYALTY_KEY).filter((id) => id !== uid);
  if (isLoyal) loyalCustomers.push(uid);
  localStorage.setItem(LOYALTY_KEY, JSON.stringify(loyalCustomers));
  void setDoc(doc(db, "customers", uid), { isLoyal }, { merge: true }).catch((error) => {
    console.error("Unable to save customer loyalty status:", error);
  });
  window.dispatchEvent(new Event("customer-settings-updated"));
}

export function isLoyalCustomer(uid) {
  return Boolean(uid && readList(LOYALTY_KEY).includes(uid));
}

export function getCustomerCredit(uid) {
  if (!uid) return 0;
  const credits = readList(CREDIT_KEY);
  const balance = credits.find((credit) => credit.uid === uid)?.amount;
  return Number.isFinite(Number(balance)) ? Math.max(0, Number(balance)) : 0;
}

export function setCustomerCredit(uid, amount) {
  if (!uid) return;
  const credits = readList(CREDIT_KEY).filter((credit) => credit.uid !== uid);
  const nextAmount = Math.max(0, Number(amount) || 0);
  credits.push({ uid, amount: nextAmount });
  localStorage.setItem(CREDIT_KEY, JSON.stringify(credits));
  void setDoc(doc(db, "customers", uid), { creditBalance: nextAmount }, { merge: true }).catch((error) => {
    console.error("Unable to save customer credit:", error);
  });
  window.dispatchEvent(new CustomEvent("customer-credit-updated", {
    detail: { uid, amount: nextAmount },
  }));
}
