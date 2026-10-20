"""Store reviewed source images; fail before publishing if any image is unavailable."""
import concurrent.futures,io,json,time
from pathlib import Path
import requests
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parents[1]
FILE=ROOT/'scripts/catalog-data/multi-brand-20261020.json'
data=json.loads(FILE.read_text())
def save(p):
 target=ROOT/'public'/p['image_urls'][0].lstrip('/');thumb=ROOT/'public'/p['thumbnail_url'].lstrip('/')
 if target.exists() and thumb.exists():return
 errors=[]
 for url in p['source_image_urls']:
  for attempt in range(2):
   try:
    r=requests.get(url,timeout=35,headers={'User-Agent':'Mozilla/5.0'});r.raise_for_status()
    im=Image.open(io.BytesIO(r.content));im.load()
    if min(im.size)<80:raise ValueError('Image too small')
    im=ImageOps.exif_transpose(im).convert('RGB');target.parent.mkdir(parents=True,exist_ok=True)
    full=im.copy();full.thumbnail((1200,1200));full.save(target,'WEBP',quality=86,method=6)
    im.thumbnail((360,360));im.save(thumb,'WEBP',quality=78,method=6)
    p['stored_source_image_url']=url
    return
   except Exception as e:
    errors.append(str(e));time.sleep(.3)
 raise ValueError(p['slug']+' '+str(p.get('barcode'))+' '+str(errors))
fail=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
 futures={ex.submit(save,p):p for p in data['products']}
 for i,f in enumerate(concurrent.futures.as_completed(futures),1):
  try:f.result()
  except Exception as e:fail.append(str(e));print('FAILED',e,flush=True)
  if i%25==0:print('IMAGES',i,flush=True)
if fail:raise ValueError(json.dumps(fail))
data['stage']='prepared';FILE.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('PREPARED',data['count'],flush=True)
