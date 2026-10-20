import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {prepareCatalogProduct} from './catalog-import';
const data=JSON.parse(readFileSync('scripts/catalog-data/multi-brand-20261020.json','utf8'));
assert.equal(data.stage,'prepared');
assert.equal(data.products.length,data.count);
assert.equal(new Set(data.products.map((p:any)=>p.slug)).size,data.count);
for(const p of data.products){
 const sourceSlug=new URL(p.source_url).pathname.split('/').filter(Boolean).at(-1)!;
 const row=prepareCatalogProduct(p,p.image_urls,p.category_slug,p.brand_slug==='frenzzi'?{slugPrefix:p.slug.slice(0,-sourceSlug.length)}:{});
 assert.equal(row.slug,p.slug);assert.equal(row.price,p.source_price);assert(row.price>0);
 assert(p.product_type && p.brand && p.category_slug);assert(p.compare_at_price===null||p.compare_at_price>row.price);
 for(const url of [...p.image_urls,p.thumbnail_url]){
  const b=readFileSync('public'+url);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
 }
}
assert.deepEqual(data.source_counts,{'Cicatricure':35,'Dermaglós':108,'Frenzzi':66,'Garnier':25,'Nivea':37});
console.log('Verified',data.count,'products, prices and stored photos');
