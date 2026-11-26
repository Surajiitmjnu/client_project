const PRODUCT_IMPORT_ROLES = new Set(["STORE_OWNER", "WAREHOUSE_STAFF"]);

function hasProductImportRole(token) {
  const roles = Array.isArray(token?.roles) ? token.roles : [];
  return PRODUCT_IMPORT_ROLES.has(token?.role)
    || roles.some((role) => PRODUCT_IMPORT_ROLES.has(role));
}

module.exports = { hasProductImportRole };
