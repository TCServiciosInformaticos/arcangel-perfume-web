import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareCatalogProduct } from "./catalog-import";

const source = {
  name: "Fidelité",
  source_url: "https://www.bmdistribuidora.com.ar/productos/fidelite/",
  source_price: 12738,
  description: "Tratamiento capilar.",
};
const images = ["/__l5e/assets-v1/test/product.webp"];

test("conserva el precio publicado sin aplicar margen ni descuento adicional", () => {
  assert.equal(prepareCatalogProduct(source, images, "cabello").price, 12738);
});
test("no inventa stock para los artículos importados", () => {
  assert.equal(prepareCatalogProduct(source, images, "cabello").stock, 0);
});
test("no carga un artículo sin precio verificable", () => {
  assert.throws(() => prepareCatalogProduct({ ...source, source_price: 0 }, images, "cabello"));
});