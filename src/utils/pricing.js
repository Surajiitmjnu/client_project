export const DEFAULT_PRICING_SETTINGS = {
  tiers: [
    { minimumQuantity: 10, discountPercent: 5 },
    { minimumQuantity: 50, discountPercent: 15 },
  ],
  loyaltyDiscountPercent: 5,
  productMoqs: {},
};

const SETTINGS_KEY = "mayoor-pricing-settings";

export function getPricingSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!stored || !Array.isArray(stored.tiers)) return DEFAULT_PRICING_SETTINGS;

    return {
      tiers: stored.tiers
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
        Math.max(0, Number(stored.loyaltyDiscountPercent) || 0),
      ),
      productMoqs: Object.fromEntries(
        Object.entries(stored.productMoqs || {})
          .map(([id, moq]) => [id, Number(moq)])
          .filter(([, moq]) => Number.isFinite(moq) && moq > 0),
      ),
    };
  } catch {
    return DEFAULT_PRICING_SETTINGS;
  }
}

export function savePricingSettings(settings) {
  const normalized = {
    tiers: settings.tiers
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
      Math.max(0, Number(settings.loyaltyDiscountPercent) || 0),
    ),
    productMoqs: Object.fromEntries(
      Object.entries(settings.productMoqs || {})
        .map(([id, moq]) => [id, Number(moq)])
        .filter(([, moq]) => Number.isFinite(moq) && moq > 0),
    ),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event("pricing-settings-updated"));
  return normalized;
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
    .sort((a, b) => a.minimumQuantity - b.minimumQuantity)
    .filter((tier) => quantity >= tier.minimumQuantity)
    .at(-1)?.discountPercent || 0;
}

export function calculatePrice(price, quantity, settings, isLoyalCustomer, discountThreshold) {
  const baseAmount = Number(price) * quantity;
  const quantityDiscount = getQuantityDiscount(quantity, settings.tiers, discountThreshold);
  const loyaltyDiscount = isLoyalCustomer ? settings.loyaltyDiscountPercent : 0;
  const discountPercent = Math.min(100, quantityDiscount + loyaltyDiscount);

  return {
    baseAmount,
    quantityDiscount,
    loyaltyDiscount,
    discountPercent,
    discountAmount: baseAmount * (discountPercent / 100),
    finalAmount: baseAmount * (1 - discountPercent / 100),
  };
}
