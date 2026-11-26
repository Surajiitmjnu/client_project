import { isProductVariantActive } from "./productVariants.js";

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function createProductSearchIndex(products) {
  return products.map((product) => ({
    product,
    searchableText: [product.name, product.brand, product.category]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase(),
    skus: [
      product.sku,
      ...(Array.isArray(product.variants)
        ? product.variants.filter(isProductVariantActive).map((variant) => variant.sku)
        : []),
    ]
      .filter((sku) => typeof sku === "string")
      .map((sku) => sku.toLowerCase()),
    category: normalize(product.category),
    brand: normalize(product.brand),
  }));
}

export function filterProductSearchIndex(index, filters) {
  const search = normalize(filters.search);
  const category = filters.category === "All Categories"
    ? ""
    : normalize(filters.category);
  const brand = normalize(filters.brand);

  return index.reduce((matches, entry) => {
    const matchesSearch = !search
      || entry.searchableText.includes(search)
      || entry.skus.some((sku) => sku.includes(search));
    if (
      matchesSearch
      && (!category || entry.category === category)
      && (!brand || entry.brand === brand)
    ) {
      matches.push(entry.product);
    }
    return matches;
  }, []);
}
