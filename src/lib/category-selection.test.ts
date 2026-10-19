import { test } from "node:test";
import { strict as assert } from "node:assert";
import { subcategoriesForCategory, validateProductClassification } from "./category-selection";

const items = [{ id: "fidelite", category_id: "cabello", name: "Fidelité" }, { id: "otra", category_id: "limpieza", name: "Otra" }];
test("Fidelité corresponde a la subcategoría de Cabello", () => {
  assert.deepEqual(subcategoriesForCategory(items, "cabello").map((item) => item.name), ["Fidelité"]);
});
test("un producto no puede tener una subcategoría de otra categoría", () => {
  assert.throws(() => validateProductClassification("limpieza", "fidelite", items));
});
test("una categoría puede tener productos sin subcategoría", () => {
  assert.doesNotThrow(() => validateProductClassification("cabello", null, items));
});