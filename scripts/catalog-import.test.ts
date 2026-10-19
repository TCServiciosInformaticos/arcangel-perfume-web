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
test("reduce un 20% los precios publicados de cuidado personal Thelma & Louise", () => {
  const product = { ...source, source_url: "https://www.thelmaylouise.com.ar/productos/jabon/", source_price: 10000 };
  assert.equal(prepareCatalogProduct(product, images, "higiene", { discountPercent: 20, roundToPesos: true }).price, 8000);
});
test("redondea el precio descontado a pesos enteros", () => {
  const product = { ...source, source_url: "https://www.thelmaylouise.com.ar/productos/jabon/", source_price: 12345.67 };
  assert.equal(prepareCatalogProduct(product, images, "higiene", { discountPercent: 20, roundToPesos: true }).price, 9877);
});