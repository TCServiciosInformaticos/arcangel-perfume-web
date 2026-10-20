import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {prepareCatalogProduct} from './catalog-import';
const data=JSON.parse(readFileSync('scripts/catalog-data/mv-paper-1-8.json','utf8'));
assert.equal(data.count,36);assert.equal(data.products.length,36);assert.equal(data.stage,'prepared');
assert.equal(new Set(data.products.map((p:any)=>p.slug)).size,36);
assert.equal(new Set(data.products.map((p:any)=>p.image_xref)).size,36);
assert.equal(data.source_sha256.length,64);
let packages=0;
for(const p of data.products){
 const row=prepareCatalogProduct(p,p.image_urls,p.category_slug,{markupPercent:45});
 assert.equal(row.slug,p.slug);assert.equal(row.price,p.price);assert.equal(p.markup_percent,45);assert.equal(row.price,Math.round(p.source_price*145)/100);assert.equal(row.stock,0);assert.equal(row.is_active,true);
 assert.equal(p.category_slug,'limpieza');assert(p.brand && ['Papel higiénico','Rollos de cocina'].includes(p.product_type));
 const amounts=[...p.source_text.matchAll(/\$([0-9.]+)/g)].map(x=>Number(x[1].replaceAll('.','')));
 assert.equal(p.source_price,amounts[0]);
 if(p.price_unit==='paquete'){packages++;assert(/paquete/i.test(p.name));assert(/Precio por paquete/.test(p.description));}
 if(p.source_id==='p3-r2-c3'){assert.equal(row.price,9981.8);assert.equal(amounts[1],20652);assert.equal(amounts[0]*3,amounts[1]);}
 for(const url of [...p.image_urls,p.thumbnail_url]){
  const b=readFileSync('public'+url);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
 }
}
assert.equal(packages,5);
console.log('Validated 36 PDF products, 72 extracted images, and all per-package prices.');
