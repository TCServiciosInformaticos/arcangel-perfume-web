import json,re
from urllib.request import urlopen,Request
from urllib.parse import urljoin
from bs4 import BeautifulSoup
URL="https://doan.com.ar/index.php?route=product/manufacturer/info&manufacturer_id=138"
with urlopen(Request(URL,headers={"User-Agent":"Mozilla/5.0"}),timeout=45) as r:
    doc=BeautifulSoup(r.read(),"html.parser")
print("TITLE",doc.title.get_text(),flush=True)
print("TEXT",doc.get_text(" ",strip=True)[-22000:],flush=True)
cards=doc.select(".product-layout, .product-thumb")
print("CARDS",len(cards),flush=True)
if cards: print("CARD",str(cards[0])[:14000],flush=True)
links=[a["href"] for a in doc.select("a[href]") if "product/product" in a["href"]]
print("PRODUCT_LINKS",json.dumps(list(dict.fromkeys(links))[:3]),flush=True)
print("PAGINATION",str(doc.select_one(".pagination"))[:8000],flush=True)
if links:
    with urlopen(Request(urljoin(URL,links[0]),headers={"User-Agent":"Mozilla/5.0"}),timeout=45) as r: p=BeautifulSoup(r.read(),"html.parser")
    print("DETAIL_TEXT",p.get_text(" ",strip=True)[-22000:],flush=True)
    content=p.select_one("#content") or p
    print("DETAIL_HTML",str(content)[:25000],flush=True)
