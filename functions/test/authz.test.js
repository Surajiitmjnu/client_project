const assert = require("node:assert/strict");
const test = require("node:test");
const { hasProductImportRole } = require("../authz");

test("allows a Store Owner to import products", () => {
  assert.equal(hasProductImportRole({ role: "STORE_OWNER" }), true);
});

test("allows warehouse staff to import products", () => {
  assert.equal(hasProductImportRole({ roles: ["WAREHOUSE_STAFF"] }), true);
});

test("rejects retail and unrecognized roles", () => {
  assert.equal(hasProductImportRole({ role: "RETAIL_CUSTOMER" }), false);
  assert.equal(hasProductImportRole({ role: "ADMIN" }), false);
  assert.equal(hasProductImportRole(null), false);
});
