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
});test("permite precio cero solo para Han cuando está autorizado", () => {
  const han = { ...source, source_url: "https://hancolor.com.ar/producto/silver-3/", source_price: 0 };
  assert.equal(prepareCatalogProduct(han, images, "han", { allowZeroPrice: true }).price, 0);
});
test("rechaza precio cero de Han sin autorización explícita", () => {
  const han = { ...source, source_url: "https://hancolor.com.ar/producto/silver-3/", source_price: 0 };
  assert.throws(() => prepareCatalogProduct(han, images, "han"));
});
test("no permite precio cero en otros orígenes aunque se pida", () => {
  assert.throws(() => prepareCatalogProduct({ ...source, source_price: 0 }, images, "cabello", { allowZeroPrice: true }));
});

test("Issue requires explicit permission for zero price", () => {
  const issue = { ...source, source_url: "https://www.issueprofessional.com/shampoo/shampoo-color-protect/", source_price: 0 };
  const stored = ["/catalog/issue/issue-shampoo-color-protect.webp"];
  assert.throws(() => prepareCatalogProduct(issue, stored, "cabello"));
  const row = prepareCatalogProduct(issue, stored, "cabello", { allowZeroPrice: true, slugPrefix: "issue-" });
  assert.equal(row.price, 0);
  assert.equal(row.stock, 0);
  assert.equal(row.is_active, true);
  assert.equal(row.slug, "issue-shampoo-color-protect");
});
test("Issue rejects remote photos and traversal paths", () => {
  const issue = { ...source, source_url: "https://www.issueprofessional.com/shampoo/shampoo-color-protect/", source_price: 0 };
  for (const image of ["https://example.com/image.webp", "/catalog/issue/../image.webp", "/catalog/issue/issue-x.webp?x=1"]) {
    assert.throws(() => prepareCatalogProduct(issue, [image], "cabello", { allowZeroPrice: true }));
  }
});
test("Issue stored images are not accepted for other source hosts", () => {
  assert.throws(() => prepareCatalogProduct(source, ["/catalog/issue/issue-x.webp"], "cabello"));
});
