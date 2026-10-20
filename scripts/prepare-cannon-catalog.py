"""Inspect the public Cannon catalog transport without accessing store credentials."""
import json,re
from urllib.request import Request,urlopen
from urllib.parse import urljoin
from bs4 import BeautifulSoup
BASE="https://www.fraganciascannon.com"
def get(url):
    with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=45) as r: return r.read().decode("utf-8")
html=get(BASE+"/catalogo")
doc=BeautifulSoup(html,"html.parser")
print("HTML_SNIPPET",html[:1800],flush=True)
for s in doc.find_all("script"):
    src=s.get("src")
    if src and (src.startswith("/") or BASE in src):
        url=urljoin(BASE,src)
        js=get(url)
        print("SCRIPT",url,"SIZE",len(js),flush=True)
        matches=list(re.finditer(r"/api/|fetch\(|axios|baseURL|supabase|productos|products|catalogo",js))
        print("MATCHES",json.dumps([js[max(0,m.start()-150):m.end()+220] for m in matches[:45]],ensure_ascii=False),flush=True)
    elif not src:
        print("INLINE",s.get("id"),s.get("type"),(s.string or s.get_text())[:5000],flush=True)
print("LINKS",json.dumps([{"text":a.get_text(" ",strip=True),"url":a.get("href")} for a in doc.select("a[href]")][-50:],ensure_ascii=False),flush=True)
