import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { prepareCatalogProduct } from "./catalog-import";
const data = JSON.parse(readFileSync("scripts/catalog-data/issue.json", "utf8"));
assert.equal(data.products.length, 34);
assert.equal(new Set(data.products.map((p: any) => p.source_url)).size, 34);
assert.equal(new Set(data.products.map((p: any) => p.slug)).size, 34);
const allowedTypes = new Set(["Tinturas", "Oxidantes", "Decolorantes", "Shampoo", "Acondicionadores", "Máscaras", "Sérums", "Tratamientos para peinar"]);
for (const p of data.products) {
  assert(allowedTypes.has(p.product_type), p.name);
  const row = prepareCatalogProduct(p, p.image_urls, "cabello", { allowZeroPrice: true, slugPrefix: "issue-" });
  assert.equal(row.slug, p.slug);
  assert.equal(row.price, 0);
  assert.equal(row.stock, 0);
  assert.equal(row.is_active, true);
  for (const url of [...p.image_urls, p.thumbnail_url]) {
    assert(/^\/catalog\/issue\/issue-[a-z0-9-]+\.webp$/.test(url));
    const file = "public" + url;
    assert(existsSync(file), file);
    const bytes = readFileSync(file);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  }
}
console.log("Validated 34 Issue rows and 68 stored WebP files.");
