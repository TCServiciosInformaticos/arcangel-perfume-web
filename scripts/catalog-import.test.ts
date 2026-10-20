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

test("Cannon imports preserve distinct sizes and the exact published price", () => {
  const cannon = { ...source, source_url: "https://www.fraganciascannon.com/kevin?v=94", source_price: 24500 };
  const image = ["/catalog/cannon/cannon-94-kevin.webp"];
  assert.throws(() => prepareCatalogProduct({ ...cannon, source_price: 0 }, image, "perfumes"));
  const row = prepareCatalogProduct(cannon, image, "perfumes", { slugPrefix: "cannon-94-" });
  assert.equal(row.slug, "cannon-94-kevin");
  assert.equal(row.price, 24500);
  assert.equal(row.stock, 0);
  assert.equal(row.is_active, true);
});
test("Cannon rejects external and cross-source image paths", () => {
  const cannon = { ...source, source_url: "https://www.fraganciascannon.com/kevin?v=94", source_price: 0 };
  for (const path of ["https://www.fraganciascannon.com/image.webp", "/catalog/cannon/../image.webp", "/catalog/issue/issue-x.webp"]) {
    assert.throws(() => prepareCatalogProduct(cannon, [path], "perfumes"));
  }
  assert.throws(() => prepareCatalogProduct(source, ["/catalog/cannon/cannon-94-kevin.webp"], "perfumes"));
});

test("Dove Doan products keep immutable IDs and published current prices", () => {
  const dove = { ...source, source_url: "https://doan.com.ar/index.php?route=product/product&manufacturer_id=138&product_id=47527", source_price: 4839.98 };
  const row = prepareCatalogProduct(dove, ["/catalog/dove/dove-doan-47527.webp"], "cabello");
  assert.equal(row.slug, "dove-doan-47527");
  assert.equal(row.price, 4839.98);
  assert.equal(row.stock, 0);
  assert.equal(row.is_active, true);
});
test("Dove rejects wrong manufacturer, product IDs, foreign photos and missing prices", () => {
  const url = "https://doan.com.ar/index.php?route=product/product&manufacturer_id=138&product_id=47527";
  const dove = { ...source, source_url: url, source_price: 4839.98 };
  const image = ["/catalog/dove/dove-doan-47527.webp"];
  assert.throws(() => prepareCatalogProduct({ ...dove, source_price: 0 }, image, "cabello"));
  assert.throws(() => prepareCatalogProduct({ ...dove, source_url: url.replace("138", "139") }, image, "cabello"));
  assert.throws(() => prepareCatalogProduct({ ...dove, source_url: url.replace("47527", "abc") }, image, "cabello"));
  assert.throws(() => prepareCatalogProduct(dove, ["/catalog/dove/dove-doan-42927.webp"], "cabello"));
  assert.throws(() => prepareCatalogProduct(dove, ["https://doan.com.ar/image/image.jpg"], "cabello"));
});

test('Requested Doan brands preserve prices and cannot borrow another brand image', () => {
 for(const [id,brand] of Object.entries({'304':'nivea','90':'cicatricure','170':'garnier','126':'dermaglos'})){
  const p={name:brand,description:'Producto publicado',source_price:1234.56,source_url:`https://doan.com.ar/index.php?route=product/product&manufacturer_id=${id}&product_id=123`};
  const image=`/catalog/${brand}/${brand}-doan-123.webp`;
  const row=prepareCatalogProduct(p,[image],'category');
  assert.equal(row.slug,`${brand}-doan-123`);assert.equal(row.price,1234.56);
  assert.throws(()=>prepareCatalogProduct(p,['/catalog/dove/dove-doan-123.webp'],'category'));
 }
});
test('Frenzzi requires real positive prices and stored photographs', () => {
 const p={name:'Frenzzi',description:'Producto publicado',source_price:6850,source_url:'https://frenzziargentina.com/producto/scrunchies/'};
 assert.equal(prepareCatalogProduct(p,['/catalog/frenzzi/frenzzi-9048-scrunchies.webp'],'category',{slugPrefix:'frenzzi-9048-'}).slug,'frenzzi-9048-scrunchies');
 assert.throws(()=>prepareCatalogProduct({...p,source_price:0},['/catalog/frenzzi/frenzzi-9048-scrunchies.webp'],'category'));
 assert.throws(()=>prepareCatalogProduct(p,['https://frenzziargentina.com/photo.jpg'],'category'));
});
