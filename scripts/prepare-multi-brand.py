"""Collect the five explicitly requested public catalogs; database loading is separate."""
import argparse,concurrent.futures,hashlib,html,itertools,json,re,time,unicodedata
from pathlib import Path
from urllib.parse import urlparse,parse_qs,urlencode,urljoin,urlunparse
import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache/catalog-sources'
BRANDS={'304':('Nivea','nivea'),'90':('Cicatricure','cicatricure'),'170':('Garnier','garnier'),'126':('Dermaglós','dermaglos')}

def fetch(url,key):
 p=CACHE/(key+'.txt')
 if p.exists(): return p.read_text()
 for attempt in range(3):
  try:
   r=requests.get(url,headers={'User-Agent':'Mozilla/5.0'},timeout=60);r.raise_for_status();p.write_text(r.text);return r.text
  except Exception:
   if attempt==2: raise
   time.sleep(2)

def norm(s):return unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().upper()
def classify_doan(name,brand):
 n=norm(name)
 if re.search(r'MUEBLE|EXHIB',n):return 'accesorios','Exhibidores y muebles'
 if re.search(r'(?<![A-Z])MAQ[.]|MAQUILLAJE',n):return 'make-up','Bases líquidas'
 if re.search(r'BB CREAM|CC CREAM',n):return 'make-up','BB y CC creams'
 if 'JAB' in n:return 'higiene-personal','Jabones líquidos' if ('LIQ' in n or 'INTIMO' in n) else 'Jabones'
 if re.search(r'AFEI|BALSAMO AF|AFTER',n):return 'higiene-personal','Cuidado del afeitado'
 if re.search(r'POST S[.]|POST SOL',n):return 'skin-care','Post solares'
 if re.search(r'AUTOBRONC',n):return 'skin-care','Autobronceadores'
 if re.search(r'S[.]PACK|SOLAR|SUPER UV|S[.]FPS',n):return 'skin-care','Kits de protección solar' if 'PACK' in n else 'Protectores solares'
 if re.search(r'AGUA MIC',n):return 'skin-care','Aguas micelares'
 if re.search(r'DESMAQ',n):return 'skin-care','Desmaquillantes'
 if re.search(r'PATCH',n):return 'skin-care','Parches faciales'
 if re.search(r'LIMP|LECHE ACTIVA|ESPUMA',n):return 'skin-care','Limpiadores'
 if re.search(r'EXFOL|EXFO(?:[.]|$)|PEEL',n):return 'skin-care','Exfoliantes'
 if re.search(r'CONT[.]|CONT[ ]|CONTORNO|ROLL-OJOS|CR[.]OJOS',n):return 'skin-care','Contorno de ojos'
 if re.search(r'SERUM',n):return 'skin-care','Sérums'
 if re.search(r'MASC[.]',n):return 'skin-care','Mascarillas faciales'
 if re.search(r'ACEITE|CICA-OIL',n):return 'skin-care','Aceites corporales'
 if re.search(r'TONICO',n):return 'skin-care','Tónicos'
 if re.search(r'HAND|MANOS',n):return 'skin-care','Cremas para manos'
 if re.search(r'BODY|CORP|EMUL|400|300|175|250|ESTRI|REGE[.]INT',n) and not re.search(r'(?<![A-Z])F[.]',n) and 'FACIAL' not in n:return 'skin-care','Cremas y lociones corporales'
 if re.search(r'GEL',n) and 'CR.' not in n:return 'skin-care','Geles de cuidado'
 return 'skin-care','Cremas faciales y humectantes'

def doan_detail(seed):
 pid=seed['source_id'];brand=seed['brand'];slugbrand=seed['brand_slug']
 doc=BeautifulSoup(fetch(seed['source_url'],'doan-detail-'+pid),'html.parser')
 name=' '.join(doc.find('h1').get_text(' ',strip=True).split())
 actual=doc.select_one('[itemprop="brand"]').get_text(' ',strip=True)
 if not norm(actual).startswith(norm(brand).split()[0]):raise ValueError('Wrong source brand '+name+': '+actual)
 node=doc.select_one('#product .price')
 active=node.select_one('.price-new')
 if not active:
  active=BeautifulSoup(str(node),'html.parser')
  for e in active.select('.price-tax,.price-old'):e.decompose()
 money=lambda n:float(re.search(r'\$\s*([0-9,]+(?:\.\d{2})?)',n.get_text(' ',strip=True))[1].replace(',',''))
 price=money(active);old=node.select_one('.price-old');old=money(old) if old else None
 if not price>0:raise ValueError('Missing price '+name)
 specs={}
 for tr in doc.select('#tab-specification tr'):
  td=tr.find_all('td')
  if len(td)==2:specs[td[0].get_text(' ',strip=True)]=td[1].get_text(' ',strip=True)
 descnode=doc.select_one('#tab-description');raw=descnode.get_text(' ',strip=True) if descnode else ''
 ean=re.search(r'C[oó]digo de Barra\s*([0-9]+)',raw,re.I)
 images=[];keys=set()
 for node in list(doc.select('.thumbnails a.thumbnail[href]'))+list(doc.select('.thumbnails img')):
  u=node.get('href') if node.name=='a' else (node.get('data-src') or node.get('src'))
  if not u or not u.strip():continue
  u=urljoin('https://doan.com.ar/',u);u=urlunparse(urlparse(u)._replace(scheme='https'))
  if '/image/' not in u or re.search('placeholder|no[_-]?image|lazyload',u,re.I):continue
  key=re.sub(r'-\d+x\d+(?=[.][a-zA-Z]+$)','',u.replace('/image/cache/','/image/'))
  if key not in keys:keys.add(key);images.append(u)
 if not images and ean:images=['https://doan.com.ar/image/catalog/doan/'+ean[1]+'.jpg']
 category,typ=classify_doan(name,brand)
 desc='\n\n'.join([name.rstrip('.')+'.']+[k+': '+v.rstrip('.')+'.' for k,v in specs.items() if v and k in {'Fragancia/Tono','Medida'}])
 slug=slugbrand+'-doan-'+pid
 return {'source_id':pid,'source_url':seed['source_url'],'manufacturer_id':seed['manufacturer_id'],'name':name,'slug':slug,'description':desc,'brand':brand,'brand_slug':slugbrand,'category_slug':category,'product_type':typ,'source_price':price,'compare_at_price':old if old and old>price else None,'source_image_urls':images,'barcode':ean[1] if ean else None,'specifications':specs,'listing_price':seed['source_price'],'image_urls':['/catalog/'+slugbrand+'/'+slug+'.webp'],'thumbnail_url':'/catalog/'+slugbrand+'/'+slug+'-thumb.webp'}

def classify_frenzzi(name):
 n=norm(name)
 if 'JAB' in n:return 'higiene-personal','Jabones'
 if 'LUFFA'==n:return 'accesorios','Esponjas'
 if 'PEINE' in n:return 'accesorios','Peines'
 if 'COFIA' in n:return 'accesorios','Cofias'
 if 'SCRUNCH' in n:return 'accesorios','Accesorios para el cabello'
 if 'FUNDA' in n:return 'accesorios','Fundas de almohada'
 if 'BOLSO' in n or 'NECESER' in n:return 'accesorios','Bolsos y neceseres'
 if 'CORPORAL' in n:return 'skin-care','Cremas corporales'
 if 'KIT' in n:return 'cabello','Kits capilares'
 if 'SHAMPOO' in n:return 'cabello','Shampoo'
 if 'TRATAMIENTO ACOND' in n or 'ACONDICIONADOR' in n:return 'cabello','Acondicionadores'
 if 'TONICO' in n:return 'cabello','Tónicos capilares'
 if 'CREMA DE PEINAR' in n:return 'cabello','Cremas para peinar'
 if 'GEL' in n:return 'cabello','Geles y cremas gel'
 if 'CASCADA' in n:return 'cabello','Finalizadores'
 if 'TRATAMIENTO' in n:return 'cabello','Tratamientos capilares'
 raise ValueError('Unknown Frenzzi type '+name)

def clean(s):
 s=BeautifulSoup(html.unescape(s),'html.parser').get_text(' ',strip=True)
 return re.sub(r'\s+',' ',re.sub(r'\[[^\]]*\]','',s)).strip()

def frenzzi_rows(product):
 category,typ=classify_frenzzi(product['name']);base=product['permalink'];short=clean(product['short_description'])
 imgs=[x['src'] for x in product['images']]
 prices=product['prices'];unit=10**prices['currency_minor_unit']
 doc=BeautifulSoup(fetch(base,'frenzzi-detail-'+str(product['id'])),'html.parser')
 # The detail/API prices are authoritative; category landing pages can be cached at older prices.
 variants=[]
 if product['type']=='variable':
  form=doc.select_one('form.variations_form');raw=form.get('data-product_variations')
  if not raw or raw=='false':raise ValueError('Variations not public in HTML: '+base)
  available=json.loads(raw);attrs=[a for a in product['attributes'] if a['has_variations']]
  fields=list(available[0]['attributes'])
  if len(fields)!=len(attrs):raise ValueError('Attribute dimensions differ')
  for choice in itertools.product(*[[t['name'] for t in a['terms']] for a in attrs]):
   selection=dict(zip(fields,choice))
   matched=next((v for v in available if all(not v['attributes'].get(k) or v['attributes'][k]==val for k,val in selection.items())),None)
   if not matched or not matched['variation_is_visible'] or not matched['variation_is_active'] or float(matched['display_price'])<=0:
    print('UNAVAILABLE_SELECTION',product['id'],selection,flush=True);continue
   vid=matched['variation_id'];suffix=hashlib.sha256(json.dumps(selection,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:8]
   label=' / '.join(a['name'].replace('Cambiar ','')+': '+v for a,v in zip(attrs,choice))
   query={**selection,'variation_id':vid}
   image=matched.get('image') or {};sources=[image.get('full_src') or image.get('url') or image.get('src')] if image else imgs
   variants.append({'source_id':str(vid)+'-'+suffix,'variation_id':vid,'label':label,'query':query,'price':float(matched['display_price']),'old':float(matched['display_regular_price']),'sources':[u for u in sources if u],'attributes':selection})
 else:
  variants=[{'source_id':str(product['id']),'variation_id':None,'label':'','query':{},'price':int(prices['price'])/unit,'old':int(prices['regular_price'])/unit,'sources':imgs,'attributes':{}}]
 rows=[]
 for v in variants:
  sid=v['source_id'];slug='frenzzi-'+sid+'-'+product['slug'];sourceurl=base+('?' + urlencode(v['query']) if v['query'] else '')
  name='Frenzzi '+product['name']+(' — '+v['label'] if v['label'] else '')
  if product['type']=='variable':desc=product['name']+'. '+v['label']+'.'
  else:desc=' '.join(short.split()[:160]) if short else product['name']+'.'
  rows.append({'source_id':sid,'source_parent_id':product['id'],'variation_id':v['variation_id'],'source_url':sourceurl,'name':name,'slug':slug,'description':desc,'brand':'Frenzzi','brand_slug':'frenzzi','category_slug':category,'product_type':typ,'source_price':v['price'],'compare_at_price':v['old'] if v['old']>v['price'] else None,'source_image_urls':v['sources'][:1],'attributes':v['attributes'],'image_urls':['/catalog/frenzzi/'+slug+'.webp'],'thumbnail_url':'/catalog/frenzzi/'+slug+'-thumb.webp'})
 return rows

def main():
 global CACHE
 parser=argparse.ArgumentParser()
 parser.add_argument('--doan-listing',type=Path,required=True)
 parser.add_argument('--frenzzi-selection',type=Path,required=True)
 parser.add_argument('--cache',type=Path,default=CACHE)
 args=parser.parse_args();CACHE=args.cache
 CACHE.mkdir(parents=True,exist_ok=True)
 listing=json.loads(args.doan_listing.read_text())
 allrows=[];failures=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
  futures={ex.submit(doan_detail,p):p for p in listing}
  for future in concurrent.futures.as_completed(futures):
   seed=futures[future]
   try:allrows.append(future.result())
   except Exception as e:failures.append({'name':seed['name'],'source_url':seed['source_url'],'error':str(e)})
   if (len(allrows)+len(failures))%20==0:print('DOAN_DETAILS',len(allrows),'failures',len(failures),flush=True)
 (CACHE/'doan-detail-checkpoint.json').write_text(json.dumps({'products':allrows,'failures':failures},ensure_ascii=False,indent=2))
 if failures:raise ValueError(json.dumps(failures,ensure_ascii=False))
 fr=json.loads(args.frenzzi_selection.read_text())
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
  for rows in ex.map(frenzzi_rows,fr['products']):allrows.extend(rows)
 assert len({p['slug'] for p in allrows})==len(allrows)
 counts={brand:sum(p['brand']==brand for p in allrows) for brand in sorted({p['brand'] for p in allrows})}
 data={'stage':'metadata','source_counts':counts,'source_pages':{'doan':205,'frenzzi_unique_parent_products':42},'products':allrows,'count':len(allrows),'pricing':'published_current_including_tax'}
 out=ROOT/'scripts/catalog-data/multi-brand-20261020.json';out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print('METADATA_COMPLETE',len(allrows),counts,flush=True)
 print('NO_IMAGES',[(p['name'],p.get('barcode')) for p in allrows if not p['source_image_urls']],flush=True)

if __name__=='__main__':main()
