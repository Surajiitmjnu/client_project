export function getProductImageOrigin(imageUrl) {
  try {
    const url = new URL(imageUrl);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}
