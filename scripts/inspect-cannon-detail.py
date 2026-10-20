import json
from urllib.request import urlopen,Request
from bs4 import BeautifulSoup
doc=BeautifulSoup(urlopen(Request("https://www.fraganciascannon.com/kevin?v=94",headers={"User-Agent":"Mozilla/5.0"}),timeout=45).read(),"html.parser")
for el in doc.find_all(attrs={"wire:snapshot":True}):
    s=json.loads(el["wire:snapshot"])
    print("SNAPSHOT",s["memo"]["name"],json.dumps(s["data"],ensure_ascii=False)[:35000],flush=True)
for el in doc.find_all(attrs={"x-data":True}):
    v=el["x-data"]
    if len(v)>150: print("XDATA",v[:50000],flush=True)
for el in doc.find_all(["button","a"]):
    attrs={k:v for k,v in el.attrs.items() if k.startswith(("wire:","x-","@"))}
    if attrs and ("ml" in el.get_text() or "present" in str(attrs).lower()): print("BUTTON",json.dumps(attrs),el.get_text(" ",strip=True)[:100],flush=True)
print("DESCRIPTION",str(doc.find(string=lambda t:t and t.strip()=="Descripción").parent.parent)[:12000],flush=True)
