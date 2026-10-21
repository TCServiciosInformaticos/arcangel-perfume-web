"""Collect all Elvive presentations from the explicitly authorized Doan manufacturer catalog."""
import concurrent.futures,importlib.util,io,json,re,time
from pathlib import Path
from urllib.parse import urlparse,parse_qs,urlunparse
import requests
from bs4 import BeautifulSoup
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'scripts/catalog-data/elvive.json'
spec=importlib.util.spec_from_file_location('source',ROOT/'scripts/prepare-multi-brand.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
base.CACHE=ROOT/'.cache/elvive';base.CACHE.mkdir(parents=True,exist_ok=True)
def classify(name,brand=None):
 n=base.norm(name)
 if 'EXHIB.' in n:return 'cabello','Kits capilares'
 if 'CR.P/PEINAR' in n:return 'cabello','Cremas para peinar'
 if ' AC.' in n:return 'cabello','Acondicionadores'
 if ' SH.' in n:return 'cabello','Shampoos'
 if ' TRAT.' in n:return 'cabello','Tratamientos capilares'
 if ' SERUM ' in n:return 'cabello','Sérums capilares'
 if ' OLEO EXT.' in n:return 'cabello','Óleos capilares'
 raise ValueError('Unknown type: '+name)
base.classify_doan=classify

def collect():
 seeds={};expected=78
 for page in range(1,2):
  u=f'https://doan.com.ar/index.php?route=product/manufacturer/info&manufacturer_id=145&limit=100&page={page}'
  d=BeautifulSoup(base.fetch(u,'listing-'+str(page)),'html.parser')
  total=re.search(r'Mostrando\s+\d+\s+a\s+\d+\s+de\s+(\d+)',d.get_text(' ',strip=True));assert total and int(total[1])==expected
  for card in d.select('.product-layout'):
   a=card.select_one('.product-name a');url=urlunparse(urlparse(a['href'])._replace(scheme='https'));pid=parse_qs(urlparse(url).query)['product_id'][0]
   node=BeautifulSoup(str(card.select_one('.price-new') or card.select_one('.price')),'html.parser')
   for e in node.select('.price-old,.price-tax'):e.decompose()
   price=float(re.search(r'\$\s*([0-9,]+(?:\.\d{2})?)',node.get_text(' ',strip=True))[1].replace(',',''))
   seeds[pid]=dict(source_id=pid,source_url=url,name=a.get_text(' ',strip=True),brand='Elvive',brand_slug='elvive',manufacturer_id='145',source_price=price)
 assert len(seeds)==expected
 products=[];failures=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
  futures={ex.submit(base.doan_detail,p):p for p in seeds.values()}
  for i,f in enumerate(concurrent.futures.as_completed(futures),1):
   try:products.append(f.result())
   except Exception as e:failures.append({'source':futures[f],'error':str(e)})
   if i%50==0:print('DETAILS',i,flush=True)
 assert not failures,json.dumps(failures)
 return dict(stage='metadata',count=len(products),source_count=expected,pricing='published_current_including_tax',products=sorted(products,key=lambda p:int(p['source_id'])),excluded=[])

def store(p):
 dest=ROOT/'public'/p['image_urls'][0].lstrip('/');thumb=ROOT/'public'/p['thumbnail_url'].lstrip('/')
 if dest.exists() and thumb.exists() and p.get('white_background_rendered'):return
 errors=[]
 for u in p['source_image_urls']:
  for attempt in range(2):
   try:
    r=requests.get(u,timeout=35,headers={'User-Agent':'Mozilla/5.0'});r.raise_for_status();im=Image.open(io.BytesIO(r.content));im.load();assert min(im.size)>=60
    im=ImageOps.exif_transpose(im).convert('RGBA');white=Image.new('RGB',im.size,'white');white.paste(im,mask=im.getchannel('A'));im=white;dest.parent.mkdir(parents=True,exist_ok=True);full=im.copy();full.thumbnail((1200,1200));full.save(dest,'WEBP',quality=86,method=6);im.thumbnail((360,360));im.save(thumb,'WEBP',quality=78,method=6);p['stored_source_image_url']=u;p['white_background_rendered']=True;return
   except Exception as e:errors.append(str(e));time.sleep(.3)
 raise ValueError(p['slug']+' '+str(p.get('barcode'))+' '+str(errors))

def main():
 data=json.loads(OUT.read_text()) if OUT.exists() else collect()
 # Fixtures and gift-only records with nominal prices are not retail product offers.
 excluded=[p for p in data['products'] if re.search(r'MUEBLE|OBSEQUIO',base.norm(p['name'])) and p['source_price']<1]
 for p in excluded:data['excluded'].append({'name':p['name'],'slug':p['slug'],'source_url':p['source_url'],'price':p['source_price'],'reason':'Ficha de exhibición u obsequio con precio simbólico; no es una oferta comercial verificable.'})
 data['products']=[p for p in data['products'] if p not in excluded];data['count']=len(data['products']);failures=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
  fs={ex.submit(store,p):p for p in data['products']}
  for i,f in enumerate(concurrent.futures.as_completed(fs),1):
   try:f.result()
   except Exception as e:failures.append(str(e));print('PHOTO_FAILURE',str(e),flush=True)
   if i%50==0:print('IMAGES',i,flush=True)
 data['image_failures']=failures;data['stage']='prepared' if not failures else 'images_pending';OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print('CATALOG',data['count'],'excluded',data['excluded'],'photo failures',len(failures),flush=True)
if __name__=='__main__':main()
