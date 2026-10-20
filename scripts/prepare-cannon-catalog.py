"""Read all public Cannon catalog pages using the same load-more action as the site."""
import json,re,http.cookiejar,time
from pathlib import Path
from urllib.request import Request,build_opener,HTTPCookieProcessor
from urllib.parse import urlparse,urljoin
from bs4 import BeautifulSoup
BASE="https://www.fraganciascannon.com"
opener=build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
def get(url):
    with opener.open(Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=50) as r: return r.read().decode()
html=get(BASE+"/catalogo")
doc=BeautifulSoup(html,"html.parser")
token=doc.select_one('meta[name="csrf-token"]')["content"]
livewire=doc.find("script",attrs={"data-update-uri":True})
endpoint=urljoin(BASE,livewire["data-update-uri"]) if livewire else BASE+"/livewire-a28e7295/update"
component=next(el for el in doc.find_all(attrs={"wire:snapshot":True}) if "list-catalog-page" in el["wire:snapshot"])
snapshot=component["wire:snapshot"]
seen={}
groups={}
def parse(fragment):
    soup=BeautifulSoup(fragment,"html.parser")
    for card in soup.find_all(attrs={"wire:key":re.compile(r"^catalog-product-")}):
        key=card["wire:key"]
        variant_node=card.find(attrs={"x-data":re.compile("variants:")})
        if not variant_node: raise ValueError("No variant data on "+key)
        variants=json.JSONDecoder().raw_decode(variant_node["x-data"].split("variants:",1)[1].lstrip())[0]
        heading=card.select_one("[data-flux-heading]")
        title=heading.get_text(" ",strip=True)
        brand=card.find("p").get_text(" ",strip=True)
        form=card.select_one("p[data-flux-text]").get_text(" ",strip=True)
        groups[key]={"title":title,"brand":brand,"format":form,"variants":list(variants)}
        for vid,v in variants.items():
            if vid in seen: continue
            seen[vid]={"source_id":vid,"title":title,"brand":brand,"format":form,**v}
    return soup
page=1
while True:
    page_doc=parse(html)
    sentinel=page_doc.find(attrs={"wire:key":"catalog-load-more-sentinel"})
    print("PAGE",page,"GROUPS",len(groups),"VARIANTS",len(seen),flush=True)
    if not sentinel: break
    if page>=100: raise ValueError("Pagination safety limit")
    before=len(seen)
    body=json.dumps({"_token":token,"components":[{"snapshot":snapshot,"updates":{},"calls":[{"path":"","method":"loadMoreCatalogProducts","params":[]}]}]}).encode()
    req=Request(endpoint,data=body,headers={"User-Agent":"Mozilla/5.0","Content-Type":"application/json","X-Livewire":"true","Referer":BASE+"/catalogo"})
    with opener.open(req,timeout=60) as response: result=json.load(response)
    comp=result["components"][0]
    snapshot=comp["snapshot"]
    html=comp.get("effects",{}).get("html","")
    if not html: raise ValueError("No public page returned")
    parse(html)
    if len(seen)==before: 
        if BeautifulSoup(html,"html.parser").find(attrs={"wire:key":"catalog-load-more-sentinel"}): raise ValueError("Pagination made no progress")
        break
    page+=1
products=list(seen.values())
print("TOTAL",len(products),"GROUPS",len(groups),"BRANDS",sorted({p["brand"] for p in products}),"FORMATS",sorted({p["format"] for p in products}),flush=True)
print("SAMPLES",json.dumps(products[:3],ensure_ascii=False),flush=True)
for url in [products[0]["url"],next((p["url"] for p in products if "desodor" in p["format"].lower()),products[-1]["url"])]:
    detail=BeautifulSoup(get(url),"html.parser")
    print("DETAIL",url,"TEXT",detail.get_text(" ",strip=True)[-14000:],flush=True)
    for el in detail.find_all(attrs={"wire:snapshot":True}):
        snap=json.loads(el["wire:snapshot"])
        if "product" in snap.get("memo",{}).get("name","") or "detail" in snap.get("memo",{}).get("name",""):
            print("DETAIL_DATA",json.dumps(snap["data"],ensure_ascii=False)[:15000],flush=True)
    print("DETAIL_JSONLD",json.dumps([s.get_text() for s in detail.find_all("script",type="application/ld+json")],ensure_ascii=False)[:12000],flush=True)
out=Path("scripts/catalog-data/cannon.json");out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps({"stage":"source","source":BASE+"/catalogo","count":len(products),"groups":len(groups),"products":products},ensure_ascii=False,indent=2)+"\n")
Path("public/catalog/cannon").mkdir(parents=True,exist_ok=True)
Path("public/catalog/cannon/.gitkeep").touch()
