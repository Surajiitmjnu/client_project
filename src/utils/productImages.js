export const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=700";

const BROKEN_IMAGE_URLS = new Set([
  "https://images.unsplash.com/photo-1522335789203-aasd6fc0e1c2?w=700",
]);

export function resolveProductImageUrl(imageUrl) {
  const trimmed = String(imageUrl || "").trim();
  if (!trimmed || BROKEN_IMAGE_URLS.has(trimmed)) {
    return FALLBACK_PRODUCT_IMAGE;
  }
  return trimmed;
}

export function handleProductImageError(event) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "1") {
    img.style.display = "none";
    return;
  }
  img.dataset.fallbackApplied = "1";
  img.src = FALLBACK_PRODUCT_IMAGE;
}

export function getProductImageOrigin(imageUrl) {
  try {
    const url = new URL(imageUrl);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}
