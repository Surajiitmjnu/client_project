import assert from "node:assert/strict";
import test from "node:test";
import { isProductVariantActive, softDeleteProductVariant } from "./productVariants.js";

test("soft delete retains the variant and references while setting both inactive flags", () => {
  const variant = { sku: "SKU-LAK-001", inventory: 12, size: "100 ml" };
  const updated = softDeleteProductVariant([variant], variant.sku, "2026-11-27T00:00:00.000Z");

  assert.equal(updated.length, 1);
  assert.equal(updated[0].sku, variant.sku);
  assert.equal(updated[0].inventory, 12);
  assert.equal(updated[0].is_active, false);
  assert.equal(updated[0].is_deleted, true);
  assert.equal(updated[0].deletedAt, "2026-11-27T00:00:00.000Z");
  assert.equal(isProductVariantActive(updated[0]), false);
});

test("legacy variants remain active and unrelated variants are unchanged", () => {
  const target = { sku: "SKU-LAK-001" };
  const other = { sku: "SKU-LAK-002" };
  const updated = softDeleteProductVariant([target, other], target.sku, "2026-11-27T00:00:00.000Z");

  assert.equal(isProductVariantActive(other), true);
  assert.equal(updated[1], other);
});

test("soft delete is idempotent and rejects unknown SKUs", () => {
  const first = softDeleteProductVariant(
    [{ sku: "SKU-LAK-001" }],
    "SKU-LAK-001",
    "2026-11-27T00:00:00.000Z",
  );
  const repeated = softDeleteProductVariant(first, "SKU-LAK-001", "2026-11-28T00:00:00.000Z");

  assert.equal(repeated[0].deletedAt, "2026-11-27T00:00:00.000Z");
  assert.throws(() => softDeleteProductVariant([], "missing"), /could not be found/);
});
