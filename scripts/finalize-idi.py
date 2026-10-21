"""Hold the three reviewed records whose product images could not be verified."""
import json
from pathlib import Path
f=Path(__file__).resolve().parents[1]/'scripts/catalog-data/idi.json';d=json.loads(f.read_text())
failed={s.split()[0] for s in d.get('image_failures',[])}
allowed={'idi-doan-27990','idi-doan-27991','idi-doan-50138'}
assert failed<=allowed,('Unexpected missing images; no product may silently be omitted',failed)
pending=list({p['slug']:p for p in d.get('pending_products',[])+[p for p in d['products'] if p['slug'] in failed]}.values())
for p in pending:p['pending_reason']='No se encontró una fotografía verificable del producto/presentación en Doan ni en las fuentes alternativas revisadas.'
d['pending_products']=pending;d['products']=[p for p in d['products'] if p['slug'] not in failed];d['count']=len(d['products']);d['image_failures']=[];d['stage']='prepared'
assert d['count']+len(d['excluded'])+len(pending)==389
f.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print('READY',d['count'],'PHOTO_PENDING',[(p['name'],p['source_price']) for p in pending],flush=True)
