import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { prepareCatalogProduct } from "./catalog-import";
const data = JSON.parse(readFileSync("scripts/catalog-data/dove.json", "utf8"));
assert.equal(data.stage, "prepared");
assert.equal(data.pricing, "published_current_including_tax");
assert.equal(data.count, 132);
assert.equal(data.products.length, data.count);
assert.equal(new Set(data.products.map((p: any) => p.source_id)).size, data.count);
assert.equal(new Set(data.products.map((p: any) => p.slug)).size, data.count);
let photoCount = 0;
for (const p of data.products) {
  assert.equal(p.brand, "Dove");
  assert(["cabello", "higiene-personal", "skin-care"].includes(p.category_slug));
  assert(p.product_type.trim());
  const row = prepareCatalogProduct(p, p.image_urls, p.category_slug);
  assert.equal(row.slug, p.slug);
  assert.equal(row.price, p.source_price);
  assert(row.price > 0);
  assert.equal(row.stock, 0);
  assert.equal(row.is_active, true);
  assert(p.compare_at_price === null || p.compare_at_price > row.price);
  for (const url of [...p.image_urls, p.thumbnail_url]) {
    assert(/^\/catalog\/dove\/dove-doan-[0-9]+(-[0-9]+|-thumb)?\.webp$/.test(url));
    const file = "public" + url;
    assert(existsSync(file), file);
    const bytes = readFileSync(file);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    photoCount++;
  }
}
console.log("Validated", data.count, "Dove products and", photoCount, "stored WebP files.");
