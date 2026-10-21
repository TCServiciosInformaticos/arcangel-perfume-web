"""Recover missing IDI photos only from supplier detail pages with the identical barcode."""
import concurrent.futures,json,re
from pathlib import Path
from urllib.parse import quote,urlparse
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
  d=get('https://www.anikashop.com.ar/search?search_query_adv='+quote(ean));urls=[]
  for a in d.select('a[href]'):
   u=a['href']
   if u.startswith('https://www.anikashop.com.ar/idi-') and u not in urls:urls.append(u)
  for u in urls[:8]:
   detail=get(u);sku=detail.select_one('.product-detail__sku');brand=detail.select_one('.product-detail__brand');image=detail.select_one('meta[property="og:image"]')
   if sku and brand and image and re.search(r'(?<!\d)'+re.escape(ean)+r'(?!\d)',sku.get_text()) and 'IDI' in brand.get_text().upper():
    source=image.get('content','')
    if '/product_images/' in source:
     p['source_image_urls']=[source];p['image_reference_url']=u;p['image_reference_barcode']=ean;print('RECOVERED',p['slug'],u,flush=True);return True
 except Exception as e:print('REPAIR_WARNING',p['slug'],str(e),flush=True)
 print('UNRESOLVED',p['slug'],p['name'],ean,flush=True);return False
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:results=list(ex.map(repair,[p for p in data['products'] if p['slug'] in failed]))
# Doan's generic Medida fields contain incompatible template values for several makeup products.
# Preserve original specifications for audit; use only the actual product name and tone in customer descriptions.
for p in data['products']:
 tone=p.get('specifications',{}).get('Fragancia/Tono','');p['description']=p['name'].rstrip('.')+'.'+ ('\n\nTono: '+tone.rstrip('.')+'.' if tone else '')
FILE.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print('PHOTO_REPAIRS',sum(results),'of',len(results),flush=True)
