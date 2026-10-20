import json,re
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup
BASE="https://www.fraganciascannon.com"
with urlopen(Request(BASE+"/catalogo",headers={"User-Agent":"Mozilla/5.0"}),timeout=45) as r: html=r.read().decode()
doc=BeautifulSoup(html,"html.parser")
for el in doc.find_all(attrs={"wire:snapshot":True}):
    snap=json.loads(el["wire:snapshot"])
    print("COMPONENT",snap.get("memo",{}).get("name"),"DATA",json.dumps(snap["data"],ensure_ascii=False)[:45000],flush=True)
for tag in doc.find_all(["button","article","div"]):
    attrs={k:v for k,v in tag.attrs.items() if k.startswith(("wire:","x-","@"))}
    if attrs and any(re.search("product|producto|load|more|detail|modal|select",str(v),re.I) for v in attrs.values()):
        print("CONTROL",tag.name,json.dumps(attrs,ensure_ascii=False),tag.get_text(" ",strip=True)[:80],flush=True)
card=doc.find(string=re.compile(r"Kevin Black"))
if card:
    parent=card.parent
    for _ in range(4): parent=parent.parent
    print("CARD",str(parent)[:18000],flush=True)
