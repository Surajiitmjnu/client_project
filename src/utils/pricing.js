import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export const DEFAULT_PRICING_SETTINGS = {
  tiers: [
    { minimumQuantity: 10, discountPercent: 5 },
    { minimumQuantity: 50, discountPercent: 15 },
  ],
  loyaltyDiscountPercent: 5,
  productMoqs: {},
};

const SETTINGS_KEY = "mayoor-pricing-settings";

function normalizePricingSettings(raw) {
  if (!raw || !Array.isArray(raw.tiers)) return DEFAULT_PRICING_SETTINGS;
  return {
    tiers: raw.tiers
      .map((tier) => ({
        minimumQuantity: Number(tier.minimumQuantity),
        discountPercent: Number(tier.discountPercent),
      }))
      .filter(
        (tier) =>
          Number.isFinite(tier.minimumQuantity) &&
          tier.minimumQuantity > 0 &&
          Number.isFinite(tier.discountPercent) &&
          tier.discountPercent >= 0 &&
          tier.discountPercent <= 100,
      )
      .sort((a, b) => a.minimumQuantity - b.minimumQuantity),
    loyaltyDiscountPercent: Math.min(
      100,
      Math.max(0, Number(raw.loyaltyDiscountPercent) || 0),
    ),
    productMoqs: Object.fromEntries(
      Object.entries(raw.productMoqs || {})
        .map(([id, moq]) => [id, Number(moq)])
        .filter(([, moq]) => Number.isFinite(moq) && moq > 0),
    ),
  };
}

export function getPricingSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return normalizePricingSettings(stored);
  } catch {
    return DEFAULT_PRICING_SETTINGS;
  }
}

export function savePricingSettings(settings) {
  const normalized = normalizePricingSettings(settings);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota errors when caching pricing locally.
  }
  void setDoc(doc(db, "settings", "pricing"), {
    ...normalized,
    updatedAt: new Date().toISOString(),
  }, { merge: true }).catch((error) => {
    console.error("Unable to sync pricing settings to Firestore:", error);
  });
  window.dispatchEvent(new Event("pricing-settings-updated"));
  return normalized;
}

export function subscribeToPricingSettings(onSettings) {
  return onSnapshot(
    doc(db, "settings", "pricing"),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const normalized = normalizePricingSettings(snapshot.data());
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
      } catch {
        // Ignore storage errors.
      }
      onSettings?.(normalized);
      window.dispatchEvent(new Event("pricing-settings-updated"));
    },
    () => {
      // Fall back silently to localStorage pricing settings.
    },
  );
}

export function getProductMoq(product, settings) {
  return settings.productMoqs?.[String(product.id)] || product.moq;
}

export function getQuantityDiscount(quantity, tiers, discountThreshold) {
  const applicableTiers = [...tiers];
  if (discountThreshold && applicableTiers.length) {
    applicableTiers[0] = {
      ...applicableTiers[0],
      minimumQuantity: Math.max(applicableTiers[0].minimumQuantity, discountThreshold),
    };
  }

  return applicableTiers
    .filter((tier) => quantity >= tier.minimumQuantity)
    .reduce((best, tier) => Math.max(best, Number(tier.discountPercent) || 0), 0);
}

const roundCurrency = (value) => Number(Number(value).toFixed(2));

export function calculatePrice(price, quantity, settings, isLoyalCustomer, discountThreshold) {
  const baseAmount = roundCurrency(Number(price) * quantity);
  const quantityDiscount = getQuantityDiscount(quantity, settings.tiers, discountThreshold);
  const loyaltyDiscount = isLoyalCustomer ? settings.loyaltyDiscountPercent : 0;
  const afterQuantityDiscount = baseAmount * (1 - quantityDiscount / 100);
  const loyaltyDiscountAmount = roundCurrency(afterQuantityDiscount * (loyaltyDiscount / 100));
  const finalAmount = roundCurrency(afterQuantityDiscount - loyaltyDiscountAmount);
  const discountAmount = roundCurrency(baseAmount - finalAmount);
  const quantityDiscountAmount = roundCurrency(baseAmount - afterQuantityDiscount);
  const discountPercent = baseAmount
    ? Number(((discountAmount / baseAmount) * 100).toFixed(2))
    : 0;

  return {
    baseAmount,
    quantityDiscount,
    loyaltyDiscount,
    discountPercent,
    quantityDiscountAmount,
    loyaltyDiscountAmount,
    discountAmount,
    finalAmount,
  };
}
