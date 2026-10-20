"""Collect Dove source listings and specification pages without touching store data."""
import json,re,time,io,unicodedata
from pathlib import Path
from decimal import Decimal
from collections import Counter
from concurrent.futures import ThreadPoolExecutor,as_completed
from urllib.parse import urlparse,parse_qs,urlencode,urlunparse,urljoin
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup
from PIL import Image,ImageOps
BASE="https://doan.com.ar"
URL=BASE+"/index.php?route=product/manufacturer/info&manufacturer_id=138"
OUT=Path("public/catalog/dove");OUT.mkdir(parents=True,exist_ok=True)
PATH=Path("scripts/catalog-data/dove.json")
if PATH.exists() and json.loads(PATH.read_text()).get("stage")=="prepared":
    print("Prepared Dove snapshot already stored.",flush=True);raise SystemExit(0)
def secure(url):
    p=urlparse(urljoin(BASE,url))
    if p.hostname not in {"doan.com.ar","www.doan.com.ar"}: raise ValueError("Unexpected source host: "+url)
    return urlunparse(p._replace(scheme="https"))
def fetch(url):
    url=secure(url)
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; ArcangelCatalogImport/1.0)"}),timeout=45) as response:
                if urlparse(response.url).hostname not in {"doan.com.ar","www.doan.com.ar"}: raise ValueError("Unexpected redirect")
                return response.read()
        except Exception:
            if attempt==2: raise
            time.sleep(2)
def soup(url): return BeautifulSoup(fetch(url),"html.parser")
def money(text):
    text=BeautifulSoup(text,"html.parser").get_text(" ",strip=True)
    m=re.search(r"\$\s*([0-9,]+(?:\.\d{2})?)",text)
    if not m: raise ValueError("Missing published price: "+text)
    n=Decimal(m[1].replace(",",""))
    if n<=0: raise ValueError("Invalid published price")
    return float(n)
def current_price(node):
    current=node.select_one(".price-new")
    if not current:
        current=BeautifulSoup(str(node),"html.parser")
        for el in current.select(".price-tax, .price-old"): el.decompose()
    return money(current.get_text(" ",strip=True))
listing={}
first=soup(URL)
pages=[URL]
for a in first.select(".pagination a[href]"):
    href=secure(a["href"])
    q=parse_qs(urlparse(href).query)
    if q.get("manufacturer_id")==["138"] and href not in pages: pages.append(href)
total_match=re.search(r"Mostrando\s+\d+\s+a\s+\d+\s+de\s+(\d+)",first.get_text(" ",strip=True),re.I)
if not total_match: raise ValueError("No catalog total")
expected=int(total_match[1])
for page in pages:
    doc=first if page==URL else soup(page)
    for card in doc.select(".product-layout"):
        a=card.select_one(".product-name a[href], h4 a[href]")
        if not a: raise ValueError("No product link")
        href=secure(a["href"])
        pid=parse_qs(urlparse(href).query)["product_id"][0]
        price=card.select_one(".price")
        old=card.select_one(".price-old")
        listing[pid]={"source_id":pid,"source_url":href,"source_name":a.get_text(" ",strip=True),"listing_price":current_price(price),"listing_old_price":money(old.get_text()) if old else None}
    print("PAGE",page,"PRODUCTS",len(listing),flush=True)
if len(listing)!=expected: raise ValueError(f"Source count mismatch {len(listing)} != {expected}")
print("SOURCE_TOTAL",expected,flush=True)
print("SOURCE_NAMES",json.dumps([p["source_name"] for p in listing.values()],ensure_ascii=False),flush=True)
def classify(name):
    n=unicodedata.normalize("NFKD",name).encode("ascii","ignore").decode().upper()
    if re.search(r"EXHIB",n): return "accesorios","Exhibidores"
    if re.search(r"\bAC[.\s]|ACOND",n): return "cabello","Acondicionadores"
    if re.search(r"\bSH[.\s]|SHAMPOO",n): return "cabello","Shampoo"
    if re.search(r"MASC",n): return "cabello","Máscaras"
    if re.search(r"TRAT|CR[.\s]*PEIN|CREMA.*PEIN",n): return "cabello","Tratamientos sin enjuague"
    if re.search(r"OLEO.*(BOND|UV REPAIR)",n): return "cabello","Óleos capilares"
    if re.search(r"JAB",n): return "higiene-personal","Jabones líquidos" if re.search(r"LIQ|DUCH",n) else "Jabones"
    if re.search(r"DEO|DESOD|ANTITRAN|ROLL|AER[.\s]|BARRA.*ANT[.\s]|CLINICAL.*BARRA",n): return "higiene-personal","Desodorantes y antitranspirantes"
    if re.search(r"SERUM",n): return "skin-care","Sérums corporales"
    if re.search(r"CREMA|CR[.\s]|BODY|LOCION",n): return "skin-care","Cremas y lociones"
    raise ValueError("Unclassified Dove product: "+name)
def prepare(seed):
    doc=soup(seed["source_url"])
    heading=doc.find("h1")
    if not heading: raise ValueError("No product title")
    name=" ".join(heading.get_text(" ",strip=True).split())
    brand=doc.select_one('[itemprop="brand"]')
    if not brand or brand.get_text(strip=True).upper()!="DOVE": raise ValueError("Non-Dove product")
    node=doc.select_one("#product .price")
    if not node: raise ValueError("No detail price")
    price=current_price(node)
    old=node.select_one(".price-old")
    oldprice=money(old.get_text()) if old else None
    if price!=seed["listing_price"]: raise ValueError("Listing/detail price mismatch for "+name)
    specs={}
    for tr in doc.select("#tab-specification tr"):
        tds=tr.find_all("td")
        if len(tds)==2: specs[tds[0].get_text(" ",strip=True)]=tds[1].get_text(" ",strip=True)
    category,typ=classify(name)
    image_urls=list(dict.fromkeys(secure(a["href"]) for a in doc.select(".thumbnails a.thumbnail[href]")))
    if not image_urls or any(re.search(r"no[_-]?image|placeholder",u,re.I) for u in image_urls): raise ValueError("No genuine photo: "+name)
    desc_node=doc.select_one("#tab-description")
    desc_text=desc_node.get_text(" ",strip=True) if desc_node else ""
    barcode=re.search(r"Código de Barra\s*([0-9]+)",desc_text,re.I)
    source_text=re.sub(r"Código Interno\s*\d+|Código de Barra\s*\d+|PRODUCTO FRACCIONABLE DE A\s*\d+\s*UNIDADES","",desc_text,flags=re.I).strip()
    facts=[name+"."]+[k+": "+v+"." for k,v in specs.items() if v and k in {"Fragancia/Tono","Medida"}]
    if source_text: facts.append(source_text)
    description="\n\n".join(facts)
    if len(description.split())>180: description=" ".join(description.split()[:180])
    pid=seed["source_id"]
    slug="dove-doan-"+pid
    saved=[]
    chosen_images=[]
    for i,url in enumerate(image_urls):
        candidates=[url]
        small=re.sub(r"-[0-9]+x[0-9]+(?=[.][a-zA-Z]+$)","-228x228",url)
        original=re.sub(r"-[0-9]+x[0-9]+(?=[.][a-zA-Z]+$)","",url.replace("/image/cache/","/image/"))
        candidates.extend([small,original])
        # All candidates identify the same source image, never another product.
        im=None
        for candidate in dict.fromkeys(candidates):
            try:
                decoded=ImageOps.exif_transpose(Image.open(io.BytesIO(fetch(candidate)))).convert("RGBA")
                if min(decoded.size)<100: raise ValueError("Photo too small")
                im=decoded
                chosen_images.append(candidate)
                if candidate!=url: print("RECOVERED_PHOTO",pid,candidate,flush=True)
                break
            except Exception as image_error:
                print("PHOTO_CANDIDATE_FAILED",pid,candidate,type(image_error).__name__,flush=True)
        if im is None: raise ValueError("No valid real product photo for "+name+"; tried "+str(candidates))
        filename=slug+("-"+str(i) if i else "")
        full=im.copy();full.thumbnail((1200,1200),Image.Resampling.LANCZOS)
        full.save(OUT/(filename+".webp"),"WEBP",quality=85,method=6)
        saved.append("/catalog/dove/"+filename+".webp")
        if i==0:
            thumb=im.copy();thumb.thumbnail((400,400),Image.Resampling.LANCZOS)
            thumb.save(OUT/(slug+"-thumb.webp"),"WEBP",quality=80,method=6)
    return {"source_id":pid,"source_url":seed["source_url"],"source_price":price,
            "compare_at_price":oldprice if oldprice and oldprice>price else None,
            "name":name,"slug":slug,"description":description,"brand":"Dove","category_slug":category,
            "product_type":typ,"image_urls":saved,"thumbnail_url":"/catalog/dove/"+slug+"-thumb.webp",
            "source_image_urls":chosen_images,"barcode":barcode[1] if barcode else None,"specifications":specs}
rows=[]
with ThreadPoolExecutor(max_workers=4) as ex:
    futures={ex.submit(prepare,p):p for p in listing.values()}
    for future in as_completed(futures):
        try: rows.append(future.result())
        except Exception as exc:
            print("FAILED",futures[future]["source_name"],str(exc),flush=True)
            raise
        if len(rows)%15==0: print("PREPARED",len(rows),"of",expected,flush=True)
rows.sort(key=lambda p:int(p["source_id"]))
assert len(rows)==expected and len({p["slug"] for p in rows})==expected
PATH.parent.mkdir(parents=True,exist_ok=True)
PATH.write_text(json.dumps({"stage":"prepared","source":URL,"count":len(rows),"pricing":"published_current_including_tax","products":rows},ensure_ascii=False,indent=2)+"\n")
print("PREPARED_TOTAL",len(rows),"CATEGORIES",dict(Counter(p["category_slug"] for p in rows)),"TYPES",dict(Counter(p["product_type"] for p in rows)),flush=True)
