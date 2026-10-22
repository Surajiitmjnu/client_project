const CUSTOMERS_KEY = "mayoor-registered-customers";
const LOYALTY_KEY = "mayoor-loyal-customers";

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
