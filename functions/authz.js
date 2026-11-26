const ADMIN_UID = "dkwkAyrzEDSkJYG1tN1VNFyFjdf1";
const ADMIN_EMAIL = "priyanshubhardaj9973@gmail.com";
const PRODUCT_IMPORT_ROLES = new Set(["STORE_OWNER", "WAREHOUSE_STAFF"]);

function hasProductImportRole(token) {
  const uid = token?.uid || token?.user_id || token?.sub || "";
  const email = typeof token?.email === "string" ? token.email.trim().toLowerCase() : "";
  if (uid === ADMIN_UID || email === ADMIN_EMAIL) {
    return true;
  }
  const roles = Array.isArray(token?.roles) ? token.roles : [];
  return PRODUCT_IMPORT_ROLES.has(token?.role)
    || roles.some((role) => PRODUCT_IMPORT_ROLES.has(role));
}

module.exports = { hasProductImportRole };
