"""Recover missing IDI photos only from supplier detail pages with the identical barcode."""
import concurrent.futures,json,re
from pathlib import Path
from urllib.parse import quote,urlparse,urljoin
import requests
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1];FILE=ROOT/'scripts/catalog-data/idi.json'
if not FILE.exists():raise SystemExit(0)
data=json.loads(FILE.read_text());failed={x.split()[0] for x in data.get('image_failures',[])}
def get(url):
 r=requests.get(url,timeout=40,headers={'User-Agent':'Mozilla/5.0'});r.raise_for_status();return BeautifulSoup(r.text,'html.parser')
def repair(p):
 ean=p.get('barcode')
 if not ean:return False
 try:
  urls=[p['image_reference_url']] if p.get('image_reference_url','').startswith('https://www.anikashop.com.ar/') else []
  if not urls:
   d=get('https://www.anikashop.com.ar/search?search_query_adv='+quote(ean))
   for a in d.select('a[href]'):
    u=a['href']
    if u.startswith('https://www.anikashop.com.ar/idi-') and u not in urls:urls.append(u)
  for u in urls[:8]:
   detail=get(u);sku=detail.select_one('.product-detail__sku');brand=detail.select_one('.product-detail__brand');image=detail.select_one('.product-detail__image img[src]')
   if sku and brand and image and re.search(r'(?<!\d)'+re.escape(ean)+r'(?!\d)',sku.get_text()) and 'IDI' in brand.get_text().upper():
    source=image.get('src','')
    if '/productos/' in source:
     p['source_image_urls']=[source];p['image_reference_url']=u;p['image_reference_barcode']=ean;print('RECOVERED',p['slug'],u,flush=True);return True
 except Exception as e:print('REPAIR_WARNING',p['slug'],str(e),flush=True)
 try:
  d=get('https://www.farmax.com.ar/busqueda_avanzada.php?buscar=1&palabra='+quote(ean))
  for card in d.select('.product'):
   barcode=card.select_one('.dcorta');a=card.select_one('h4 a[href]');im=card.select_one('.image img[src]')
   if barcode and a and im and barcode.get_text(strip=True)==ean and 'IDI' in a.get_text().upper():
    p['source_image_urls']=[urljoin('https://www.farmax.com.ar/',im['src'])];p['image_reference_url']=urljoin('https://www.farmax.com.ar/',a['href']);p['image_reference_barcode']=ean;print('FARMAX_RECOVERED',p['slug'],p['image_reference_url'],flush=True);return True
 except Exception as e:print('FARMAX_WARNING',p['slug'],str(e),flush=True)
 print('UNRESOLVED',p['slug'],p['name'],ean,flush=True);return False
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:results=list(ex.map(repair,[p for p in data['products'] if p['slug'] in failed]))
# Doan's generic Medida fields contain incompatible template values for several makeup products.
# Preserve original specifications for audit; use only the actual product name and tone in customer descriptions.
for p in data['products']:
 tone=p.get('specifications',{}).get('Fragancia/Tono','');p['description']=p['name'].rstrip('.')+'.'+ ('\n\nTono: '+tone.rstrip('.')+'.' if tone else '')
FILE.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print('PHOTO_REPAIRS',sum(results),'of',len(results),flush=True)
