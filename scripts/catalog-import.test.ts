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
test("los precios en pesos enteros se redondean siempre hacia arriba", () => {
  const product = { ...source, source_url: "https://www.thelmaylouise.com.ar/productos/jabon/", source_price: 10000.1 };
  assert.equal(prepareCatalogProduct(product, images, "higiene", { roundToPesos: true }).price, 10001);
});
test("permite precio cero solo para Han cuando está autorizado", () => {
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

test('MV attached PDF preserves per-package prices and isolates each source card image', () => {
 const p={name:'Elegante paquete de 12 rollos',description:'Precio por paquete, bulto de 4 paquetes.',source_url:'attachment:mv-rep-1-8/p1-r4-c1',source_price:6070};
 const images=['/catalog/mv-rep-1-8/mv-rep-1-8-p1-r4-c1.webp'];
 const row=prepareCatalogProduct(p,images,'limpieza');
 assert.equal(row.slug,'mv-rep-1-8-p1-r4-c1');assert.equal(row.price,6070);assert.equal(row.stock,0);assert.equal(row.is_active,true);
 assert.throws(()=>prepareCatalogProduct({...p,source_price:0},images,'limpieza'));
 assert.throws(()=>prepareCatalogProduct(p,['/catalog/mv-rep-1-8/mv-rep-1-8-p1-r4-c2.webp'],'limpieza'));
 assert.throws(()=>prepareCatalogProduct({...p,source_url:'attachment:other/p1-r4-c1'},images,'limpieza'));
 assert.throws(()=>prepareCatalogProduct({...p,source_url:'https://example.com/p1-r4-c1'},images,'limpieza'));
});

test('Explicit 45 percent markup adds to source prices, without confusing markup with margin', () => {
 const p={name:'Higienol',description:'Bulto 12 x 4 x 30 m',source_url:'attachment:mv-rep-1-8/p1-r1-c1',source_price:17054};
 const images=['/catalog/mv-rep-1-8/mv-rep-1-8-p1-r1-c1.webp'];
 assert.equal(prepareCatalogProduct(p,images,'limpieza',{markupPercent:45}).price,24728.3);
 assert.equal(prepareCatalogProduct({...p,source_price:6884},images,'limpieza',{markupPercent:45}).price,9981.8);
 for(const value of [-1,NaN,Infinity])assert.throws(()=>prepareCatalogProduct(p,images,'limpieza',{markupPercent:value}));
});

test('IDI imports use manufacturer 201, immutable IDs, exact prices, and matching stored photographs', () => {
 const p={name:'IDI esmalte tono 01',description:'Tono 01',source_url:'https://doan.com.ar/index.php?route=product/product&manufacturer_id=201&product_id=123',source_price:4000.12};
 const images=['/catalog/idi/idi-doan-123.webp'];
 const row=prepareCatalogProduct(p,images,'make-up');assert.equal(row.slug,'idi-doan-123');assert.equal(row.price,4000.12);assert.equal(row.stock,0);assert.equal(row.is_active,true);
 assert.throws(()=>prepareCatalogProduct({...p,source_price:0},images,'make-up'));
 assert.throws(()=>prepareCatalogProduct(p,['/catalog/idi/idi-doan-124.webp'],'make-up'));
 assert.throws(()=>prepareCatalogProduct({...p,source_url:p.source_url.replace('201','138')},images,'make-up'));
});
