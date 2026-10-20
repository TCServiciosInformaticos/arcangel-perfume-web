"""Prepare every official Cannon presentation and owned WebP photos; never writes to the database."""
import ast,io,json,re,time,unicodedata,math
from collections import Counter
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup
from PIL import Image,ImageOps
BASE="https://www.fraganciascannon.com"
PATH=Path("scripts/catalog-data/cannon.json")
source=json.loads(PATH.read_text())
def apply_published_prices(data):
    for row in data["products"]:
        raw=row.get("published_price")
        if raw is None or isinstance(raw,bool): raise ValueError("No published price for "+row["source_url"])
        price=float(raw)
        if not math.isfinite(price) or price <= 0: raise ValueError("Invalid published price for "+row["source_url"])
        row["source_price"]=price
    data["pricing"]="published"
    return data
if source.get("stage")=="prepared":
    PATH.write_text(json.dumps(apply_published_prices(source),ensure_ascii=False,indent=2)+"\\n")
    print("Prepared snapshot uses exact published prices.",flush=True)
    raise SystemExit(0)
OUT=Path("public/catalog/cannon");OUT.mkdir(parents=True,exist_ok=True)
def fetch(url):
    if urlparse(url).scheme!="https" or urlparse(url).hostname not in {"www.fraganciascannon.com","fraganciascannon.com"}:
        raise ValueError("Unexpected source URL: "+url)
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; ArcangelCatalogImport/1.0)"}),timeout=45) as r:
                if urlparse(r.url).hostname not in {"www.fraganciascannon.com","fraganciascannon.com"}: raise ValueError("Unexpected redirect")
                return r.read()
        except Exception:
            if attempt==2: raise
            time.sleep(2)
def soup(url): return BeautifulSoup(fetch(url),"html.parser")
def product_json(doc):
    for tag in doc.find_all("script",type="application/ld+json"):
        try: data=json.loads(tag.get_text())
        except ValueError: continue
        graph=data.get("@graph",[data])
        for obj in graph:
            if obj.get("@type")=="Product": return obj
    raise ValueError("No product structured data")
def share_title(doc):
    for el in doc.find_all(attrs={"x-data":True}):
        m=re.search(r"shareTitle:\s*('(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\")",el["x-data"])
        if m: return ast.literal_eval(m[1])
    raise ValueError("No selected presentation")
def description(doc,product):
    parts=list(doc.stripped_strings)
    try:
        start=parts.index("Descripción")+1
        end=next((i for i in range(start,len(parts)) if parts[i] in {"Notas","Familia olfativa","Productos relacionados","Te puede interesar"} or parts[i].startswith("Más de 50 años")),len(parts))
        value=" ".join(parts[start:end]).strip()
    except ValueError: value=product.get("description","")
    if not value: raise ValueError("No source description")
    if len(value.split())>160:
        value=" ".join(value.split()[:160])
        if "." in value: value=value.rsplit(".",1)[0]+"."
    return value
bases={}
for p in source["products"]: bases.setdefault(p["url"].split("?")[0],p)
def discover(item):
    url,seed=item
    doc=soup(url)
    ids=[re.fullmatch(r"variant-(\d+)",b["wire:key"])[1] for b in doc.find_all("button",attrs={"wire:key":re.compile(r"^variant-\d+$")})]
    if not ids: raise ValueError("No presentations: "+url)
    product=product_json(doc)
    brand=product.get("brand",{}).get("name") or seed["brand"]
    return [{"source_id":v,"url":url+"?v="+v,"base_url":url,"brand":brand,"title":product["name"]} for v in ids]
variants={}
with ThreadPoolExecutor(max_workers=4) as ex:
    futures={ex.submit(discover,item):item[0] for item in bases.items()}
    for future in as_completed(futures):
        for v in future.result(): variants[v["source_id"]]=v
        print("DISCOVERED",len(variants),"presentations",flush=True)
print("PRESENTATIONS_TOTAL",len(variants),"FRAGRANCES",len(bases),flush=True)
def classify(form):
    text=form.lower()
    if "shampoo" in text: return "cabello",form
    if "crema" in text: return "skin-care",form
    if "desodorante" in text or "antitranspirante" in text or "after shave" in text or "jabón" in text or "jabon" in text:
        return "higiene-personal",form
    if any(w in text for w in ["eau de","colonia","body mist","agua de bienvenida","estuche","combo","lata","neceser","conejo"]):
        return "perfumes",form
    raise ValueError("Unclassified presentation: "+form)
def prepare(seed):
    vid=seed["source_id"]
    doc=soup(seed["url"])
    prod=product_json(doc)
    snap=next(json.loads(el["wire:snapshot"]) for el in doc.find_all(attrs={"wire:snapshot":True}) if '"public-site.list-fragrance-page"' in el["wire:snapshot"])
    selected=str(snap["data"]["variantId"])
    if selected!=vid: raise ValueError("Source selected a different presentation: "+seed["url"])
    title=share_title(doc)
    prefix=prod["name"]+" - "
    if not title.startswith(prefix): raise ValueError("Unexpected presentation title: "+title)
    presentation=title[len(prefix):].strip()
    form=re.split(r"\s+\d+(?:[.,]\d+)?\s*(?:ml|g|gr)\b",presentation,maxsplit=1,flags=re.I)[0].strip()
    # Gift packs can include a volume inside parentheses; retain the format label only.
    if "(" in form: form=form.split("(",1)[0].strip()
    cat,typ=classify(form)
    desc=description(doc,prod)
    pathslug=urlparse(seed["base_url"]).path.strip("/").split("/")[-1]
    slug="cannon-"+vid+"-"+pathslug
    name=prod["name"]+" — "+presentation
    image=prod.get("image")
    if isinstance(image,list): image=image[0] if image else None
    if isinstance(image,dict): image=image.get("url")
    if not image or "/storage/" not in image: raise ValueError("No real source image: "+seed["url"])
    im=ImageOps.exif_transpose(Image.open(io.BytesIO(fetch(image)))).convert("RGBA")
    if min(im.size)<100: raise ValueError("Product photo too small")
    full=im.copy();full.thumbnail((1200,1200),Image.Resampling.LANCZOS)
    thumb=im.copy();thumb.thumbnail((400,400),Image.Resampling.LANCZOS)
    full.save(OUT/(slug+".webp"),"WEBP",quality=85,method=6)
    thumb.save(OUT/(slug+"-thumb.webp"),"WEBP",quality=80,method=6)
    return {"source_id":vid,"source_url":seed["url"],"source_price":0,"published_price":prod.get("offers",{}).get("price"),
            "name":name,"slug":slug,"description":presentation+".\n\n"+desc,"brand":seed["brand"],
            "category_slug":cat,"product_type":typ,"image_urls":["/catalog/cannon/"+slug+".webp"],
            "thumbnail_url":"/catalog/cannon/"+slug+"-thumb.webp","source_image_url":image,"gtin":prod.get("gtin13")}
rows=[]
with ThreadPoolExecutor(max_workers=4) as ex:
    futures={ex.submit(prepare,seed):seed["url"] for seed in variants.values()}
    for future in as_completed(futures):
        try: rows.append(future.result())
        except Exception as exc:
            print("FAILED",futures[future],str(exc),flush=True)
            raise
        if len(rows)%20==0: print("PREPARED",len(rows),"of",len(variants),flush=True)
rows.sort(key=lambda x:int(x["source_id"]))
assert len(rows)==len(variants) and len({p["slug"] for p in rows})==len(rows)
PATH.write_text(json.dumps(apply_published_prices({"stage":"prepared","source":BASE+"/catalogo","fragrances":len(bases),"count":len(rows),"products":rows}),ensure_ascii=False,indent=2)+"\n")
print("PREPARED_TOTAL",len(rows),"CATEGORIES",dict(Counter(p["category_slug"] for p in rows)),"BRANDS",len({p["brand"] for p in rows}),"TYPES",dict(Counter(p["product_type"] for p in rows)),flush=True)
