import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareProductPreview } from "./product-excel-preview";
const products = [
  {
    id: "one",
    name: "One",
    price: 10,
    stock: 1,
    is_active: true,
    updated_at: "2026-10-22T01:00:00.123456Z",
  },
  {
    id: "two",
    name: "Two",
    price: 20,
    stock: 0,
    is_active: false,
    updated_at: "2026-10-22T02:00:00Z",
  },
];
const updates = products.map((p) => ({
  id: p.id,
  price: p.price + 1,
  stock: p.stock,
  is_active: p.is_active,
}));
test("preview sends only selected rows and preserves exact snapshot timestamps", () => {
  assert.deepEqual(prepareProductPreview(updates, products, new Set(["one"])), [
    { ...updates[0], expected_updated_at: products[0].updated_at },
  ]);
  assert.deepEqual(prepareProductPreview(updates, products, new Set()), []);
});
test("preview refuses missing versions instead of overwriting concurrent edits", () => {
  assert.throws(
    () =>
      prepareProductPreview(
        updates,
        products.map((p) => ({ ...p, updated_at: undefined })),
        new Set(["one"]),
      ),
    /versión/,
  );
});
