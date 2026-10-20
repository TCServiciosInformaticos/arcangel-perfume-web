import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { prepareCatalogProduct } from "./catalog-import";
const data = JSON.parse(readFileSync("scripts/catalog-data/cannon.json", "utf8"));
assert.equal(data.stage, "prepared");
assert.equal(data.pricing, "published");
assert.equal(data.fragrances, 109);
assert.equal(data.products.length, data.count);
assert(data.count >= 151);
assert.equal(new Set(data.products.map((p: any) => p.source_id)).size, data.count);
assert.equal(new Set(data.products.map((p: any) => p.slug)).size, data.count);
assert.equal(new Set(data.products.map((p: any) => p.brand)).size, 27);
for (const p of data.products) {
  assert(["perfumes", "higiene-personal", "skin-care", "cabello"].includes(p.category_slug));
  assert(p.brand.trim() && p.product_type.trim());
  const row = prepareCatalogProduct(p, p.image_urls, p.category_slug, { slugPrefix: "cannon-" + p.source_id + "-" });
  assert.equal(row.slug, p.slug);
  assert.equal(row.price, Math.round(Number(p.published_price) * 100) / 100);
  assert(row.price > 0);
  assert.equal(row.stock, 0);
  assert.equal(row.is_active, true);
  assert(p.description.split(/\s+/).length <= 200, p.slug);
  for (const url of [...p.image_urls, p.thumbnail_url]) {
    assert(/^\/catalog\/cannon\/cannon-[0-9]+-[a-z0-9-]+\.webp$/.test(url));
    const file = "public" + url;
    assert(existsSync(file), file);
    const bytes = readFileSync(file);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  }
}
console.log("Validated", data.count, "Cannon presentations and", data.count * 2, "stored WebP files.");
