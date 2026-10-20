"""Fetch Issue's public catalog. Never accesses or mutates the store database."""
import io
import json
import re
import time
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup
from PIL import Image, ImageOps

BASE = "https://www.issueprofessional.com"
OUT = Path("public/catalog/issue")
OUT.mkdir(parents=True, exist_ok=True)

def fetch(url):
    if urlparse(url).scheme != "https" or urlparse(url).hostname not in {"www.issueprofessional.com", "issueprofessional.com"}:
        raise ValueError("Unexpected source host: " + url)
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; ArcangelCatalogImport/1.0)"}), timeout=45) as response:
                if urlparse(response.url).hostname not in {"www.issueprofessional.com", "issueprofessional.com"}:
                    raise ValueError("Unexpected redirect")
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)

def soup(url):
    return BeautifulSoup(fetch(url), "html.parser")

def product_type(name, url):
    s = (name + " " + urlparse(url).path).lower()
    if "shampoo" in s: return "Shampoo"
    if "acondicionador" in s: return "Acondicionadores"
    if "mascara" in s or "máscara" in s: return "Máscaras"
    if "serum" in s or "sérum" in s: return "Sérums"
    if "oxidante" in s or "activador" in s: return "Oxidantes"
    if "decolorante" in s: return "Decolorantes"
    if "coloraci" in s or "tintura" in s or "crazy-colors" in s: return "Tinturas"
    if "leave" in s or "tratamiento" in s: return "Tratamientos para peinar"
    raise ValueError("Unclassified product: " + name + " " + url)

urls = []
pending = [BASE + "/productos/"]
seen_pages = set()
while pending:
    page = pending.pop(0)
    if page in seen_pages: continue
    seen_pages.add(page)
    if len(seen_pages) > 10: raise ValueError("Unexpected pagination")
    doc = soup(page)
    for a in doc.find_all("a", href=True):
        href = urljoin(BASE, a["href"]).split("#")[0].split("?")[0]
        label = a.get_text(" ", strip=True).lower()
        if "ver producto" in label and href not in urls:
            if urlparse(href).hostname != "www.issueprofessional.com":
                raise ValueError("Unexpected product host")
            urls.append(href)
        if re.fullmatch(r"https://www\.issueprofessional\.com/productos/page/\d+/", href) and href not in seen_pages and href not in pending:
            pending.append(href)
if len(urls) != 34:
    raise ValueError(f"Expected the 34 products reviewed in the source catalog, found {len(urls)}: {urls}")
print("PAGES", sorted(seen_pages), "PRODUCTS", len(urls), flush=True)
rows = []
for url in urls:
    doc = soup(url)
    h1 = doc.find("h1")
    if not h1: raise ValueError("Missing title: " + url)
    title = h1.get_text(" ", strip=True)
    slug = "issue-" + urlparse(url).path.strip("/").split("/")[-1]
    paragraphs = []
    for node in h1.find_all_next(["p", "li", "h2", "h3"]):
        value = node.get_text(" ", strip=True)
        if "ver producto" in value.lower(): break
        if re.search(r"te puede interesar|seguinos|copyright", value, re.I): break
        if node.name == "p" and node.find_parent("li"): continue
        if value and value not in {"Comprar", "Ver carta de colores", "Descargar carta"} and value not in paragraphs:
            paragraphs.append(value)
    if not paragraphs: raise ValueError("Missing description: " + url)
    # Retain factual product information in a compact description; keep source URL for reference.
    description = "\n\n".join(paragraphs)
    words = description.split()
    if len(words) > 180:
        description = " ".join(words[:180]).rsplit(".", 1)[0] + "."
    if slug in {"issue-acondicionador-neutro-y-detox", "issue-acondicionador-neutro-y-detox-1000"}:
        # The source mistakenly repeats Color Protect copy on these two pages.
        description = "Acondicionador de la línea Issue Neutro y Detox, indicado por el fabricante para cabellos naturales y grasos."
    image_meta = doc.find("meta", property="og:image")
    if not image_meta or not image_meta.get("content"):
        raise ValueError("Missing product image: " + url)
    image_url = urljoin(BASE, image_meta["content"])
    if re.search(r"logo|cruelty|no-testeado|favicon", image_url, re.I):
        raise ValueError("Non-product image: " + image_url)
    raw = fetch(image_url)
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGBA")
    if min(im.size) < 100: raise ValueError("Image too small")
    full = im.copy()
    full.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
    thumb = im.copy()
    thumb.thumbnail((400, 400), Image.Resampling.LANCZOS)
    full.save(OUT / (slug + ".webp"), "WEBP", quality=85, method=6)
    thumb.save(OUT / (slug + "-thumb.webp"), "WEBP", quality=80, method=6)
    name = title if "issue" in title.lower() else "Issue " + title
    row = {"name": name, "slug": slug, "description": description, "source_url": url,
           "source_price": 0, "product_type": product_type(title, url),
           "image_urls": ["/catalog/issue/" + slug + ".webp"],
           "thumbnail_url": "/catalog/issue/" + slug + "-thumb.webp",
           "source_image_url": image_url}
    rows.append(row)
    print(json.dumps({"name": name, "type": row["product_type"], "image": image_url,
                      "image_size": im.size, "description_start": description[:120]}, ensure_ascii=False), flush=True)
if len({r["slug"] for r in rows}) != len(rows): raise ValueError("Duplicate slugs")
path = Path("scripts/catalog-data/issue.json")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps({"source": BASE + "/productos/", "count": len(rows), "products": rows}, ensure_ascii=False, indent=2) + "\n")
print("TOTALS", json.dumps(Counter(r["product_type"] for r in rows), ensure_ascii=False), flush=True)
