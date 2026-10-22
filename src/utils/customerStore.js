const CUSTOMERS_KEY = "mayoor-registered-customers";
const LOYALTY_KEY = "mayoor-loyal-customers";
const CREDIT_KEY = "mayoor-customer-credits";

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
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

export function getRegisteredCustomers() {
  return readList(CUSTOMERS_KEY).map((customer) => ({
    ...customer,
    isLoyal: readList(LOYALTY_KEY).includes(customer.uid),
    creditBalance: getCustomerCredit(customer.uid),
  }));
}

export function setCustomerLoyalty(uid, isLoyal) {
  const loyalCustomers = readList(LOYALTY_KEY).filter((id) => id !== uid);
  if (isLoyal) loyalCustomers.push(uid);
  localStorage.setItem(LOYALTY_KEY, JSON.stringify(loyalCustomers));
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
  window.dispatchEvent(new CustomEvent("customer-credit-updated", {
    detail: { uid, amount: nextAmount },
  }));
}
