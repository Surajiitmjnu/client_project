import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { createProductSearchIndex, filterProductSearchIndex } from "./productSearch.js";

function createProducts(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `product-${index}`,
    sku: `SKU-${String(index).padStart(5, "0")}`,
    name: `Product ${index}`,
    brand: `Brand ${index % 100}`,
    category: `Category ${index % 20}`,
    variants: [{ sku: `VAR-${index}` }],
  }));
}

test("search supports product and variant SKUs with category and brand facets", () => {
  const index = createProductSearchIndex(createProducts(10_000));

  assert.deepEqual(
    filterProductSearchIndex(index, { search: "sku-09999" }).map(({ id }) => id),
    ["product-9999"],
  );
  assert.equal(
    filterProductSearchIndex(index, {
      category: "Category 15",
      brand: "Brand 15",
    }).length,
    100,
  );
  assert.deepEqual(
    filterProductSearchIndex(index, { search: "VAR-9999" }).map(({ id }) => id),
    ["product-9999"],
  );
});

test("search does not match soft-deleted variant SKUs", () => {
  const index = createProductSearchIndex([{
    id: "product-1",
    name: "Lakme Foundation",
    variants: [
      { sku: "SKU-RETIRED-001", is_active: false, is_deleted: true },
      { sku: "SKU-CURRENT-001" },
    ],
  }]);

  assert.deepEqual(filterProductSearchIndex(index, { search: "SKU-RETIRED-001" }), []);
  assert.deepEqual(
    filterProductSearchIndex(index, { search: "SKU-CURRENT-001" }).map(({ id }) => id),
    ["product-1"],
  );
});

test("10,000-product search and faceted queries stay under 500 ms", () => {
  const index = createProductSearchIndex(createProducts(10_000));
  const queries = [
    { search: "SKU-09999" },
    { category: "Category 15", brand: "Brand 15" },
    { search: "Product 995", category: "Category 15", brand: "Brand 95" },
  ];

  for (const filters of queries) {
    const start = performance.now();
    filterProductSearchIndex(index, filters);
    assert.ok(performance.now() - start < 500);
  }
});
