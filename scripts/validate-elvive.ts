import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {prepareCatalogProduct} from './catalog-import';
const d=JSON.parse(readFileSync('scripts/catalog-data/elvive.json','utf8'));
assert.equal(d.stage,'prepared');assert.equal(d.source_count,78);assert.equal(d.count+d.excluded.length+(d.pending_products?.length??0),78);assert.equal(d.products.length,d.count);assert.deepEqual(d.image_failures,[]);
assert.equal(new Set(d.products.map((p:any)=>p.slug)).size,d.count);
for(const p of d.products){
 assert.equal(p.brand,'Elvive');assert.equal(p.manufacturer_id,'145');assert(p.product_type);assert(['cabello'].includes(p.category_slug));
 const row=prepareCatalogProduct(p,p.image_urls,p.category_slug);assert.equal(row.slug,p.slug);assert.equal(row.price,p.source_price);assert.equal(row.stock,0);assert.equal(row.is_active,true);assert(p.compare_at_price===null||p.compare_at_price>row.price);
 for(const url of [...p.image_urls,p.thumbnail_url]){const b=readFileSync('public'+url);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');}
}
console.log('Verified Elvive products:',d.count,'Excluded non-retail entries:',d.excluded.length);
