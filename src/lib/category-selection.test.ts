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
});const types = [{ id: "shampoo-han", subcategory_id: "han", name: "Shampoo" }];
const brands = [...items, { id: "han", category_id: "cabello", name: "Han" }];
test("el tipo debe pertenecer a la marca elegida", () => {
  assert.throws(() => validateProductClassification("cabello", "fidelite", brands, "shampoo-han", types));
  assert.doesNotThrow(() => validateProductClassification("cabello", "han", brands, "shampoo-han", types));
});
test("no se puede elegir tipo sin marca", () => {
  assert.throws(() => validateProductClassification("cabello", null, brands, "shampoo-han", types));
});
