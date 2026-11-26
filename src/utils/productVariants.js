export function isProductVariantActive(variant) {
  return Boolean(
    variant
    && typeof variant === "object"
    && variant.is_active !== false
    && variant.is_deleted !== true,
  );
}

export function softDeleteProductVariant(variants, sku, updatedAt = new Date().toISOString()) {
  if (!Array.isArray(variants)) {
    throw new Error("Product variants must be an array.");
  }

  const normalizedSku = String(sku || "").trim().toLowerCase();
  if (!normalizedSku) {
    throw new Error("A variant SKU is required.");
  }

  const variantIndex = variants.findIndex((variant) =>
    String(variant?.sku || "").trim().toLowerCase() === normalizedSku,
  );
  if (variantIndex < 0) {
    throw new Error(`Product variant "${String(sku).trim()}" could not be found.`);
  }

  return variants.map((variant, index) => {
    if (index !== variantIndex) return variant;

    return {
      ...variant,
      is_active: false,
      is_deleted: true,
      deletedAt: variant.deletedAt || updatedAt,
      updatedAt,
    };
  });
}
