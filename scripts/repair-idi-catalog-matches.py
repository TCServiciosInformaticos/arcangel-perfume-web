"""Second-source catalog index and manually reviewed family/shade matches for missing IDI images."""
import concurrent.futures,json
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1];F=ROOT/'scripts/catalog-data/idi.json';data=json.loads(F.read_text());failed={s.split()[0] for s in data['image_failures']}
def get(u):
 r=requests.get(u,timeout=40);r.raise_for_status();return BeautifulSoup(r.text,'html.parser')
def farmax(offset):
 d=get('https://www.farmax.com.ar/busqueda_avanzada.php?buscar=1&palabra=IDI&inicio='+str(offset));rows={}
 for card in d.select('.product'):
  e=card.select_one('.dcorta');a=card.select_one('h4 a[href]');im=card.select_one('.image img[src]')
  if e and a and im and 'IDI' in a.get_text().upper():rows[e.get_text(strip=True)]=(urljoin('https://www.farmax.com.ar/',im['src']),urljoin('https://www.farmax.com.ar/',a['href']))
 return rows
index={}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 for r in ex.map(farmax,range(0,241,24)):index.update(r)
# The homepage also lists the fully specified six-piece Boost Stick exhibitor.
d=get('https://www.farmax.com.ar/')
for card in d.select('.product'):
 e=card.select_one('.dcorta');a=card.select_one('h4 a[href]');im=card.select_one('.image img[src]')
 if e and a and im:index[e.get_text(strip=True)]=(urljoin('https://www.farmax.com.ar/',im['src']),urljoin('https://www.farmax.com.ar/',a['href']))
print('FARMAX_INDEX',len(index),flush=True)
manual={
 'idi-doan-49389':('https://www.anikashop.com.ar/idi-tinted-found-vit-c-102',['TINTED','FOUNDATION','VIT. C','102']),
 'idi-doan-50683':('https://www.anikashop.com.ar/idi-esm-hipoal-67',['IDI','HIPoAL'.upper(),'67']),
 'idi-doan-50519':('https://www.anikashop.com.ar/idi-primer-skin-silk-vit-c',['IDI','PRIMER','SKIN SILK','VIT.C'])}
for p in data['products']:
 if p['slug'] not in failed:continue
 if p.get('barcode') in index:
  image,reference=index[p['barcode']];p['source_image_urls']=[image];p['image_reference_url']=reference;p['image_reference_match']='identical barcode';print('INDEX_MATCH',p['slug'],flush=True)
 elif p['slug'] in manual:
  u,terms=manual[p['slug']];d=get(u);title=d.select_one('h1');im=d.select_one('.product-detail__image img[src]')
  assert title and im and all(t in title.get_text().upper() for t in terms),(p['slug'],title)
  p['source_image_urls']=[urljoin(u,im['src'])];p['image_reference_url']=u;p['image_reference_match']='Manually reviewed brand, product family and explicit shade; supplier barcodes differ.';p['image_reference_name']=title.get_text(' ',strip=True);print('NAME_MATCH',p['slug'],flush=True)
F.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
