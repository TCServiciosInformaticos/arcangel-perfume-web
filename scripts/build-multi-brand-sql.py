"""Build an atomic, idempotent import from the validated source snapshot."""
import json,re,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'scripts/catalog-data/multi-brand-20261020.json').read_text())
assert data['stage']=='prepared'
def slug(s):return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
rows=[dict(name=p['name'],slug=p['slug'],description=p['description'],price=p['source_price'],compare_at_price=p['compare_at_price'],category_slug=p['category_slug'],brand=p['brand'],brand_slug=p['brand_slug'],type=p['product_type'],type_slug=slug(p['product_type']),image_urls=p['image_urls'],thumbnail_url=p['thumbnail_url']) for p in data['products']]
sql="""BEGIN;
CREATE TEMP TABLE import_stage ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset($catalog$"""+json.dumps(rows,ensure_ascii=False)+"""$catalog$::jsonb) AS x(name text,slug text,description text,price numeric,compare_at_price numeric,category_slug text,brand text,brand_slug text,type text,type_slug text,image_urls text[],thumbnail_url text);
DO $$ BEGIN
 IF (SELECT count(*) FROM import_stage) <> EXPECTED OR EXISTS(SELECT 1 FROM import_stage WHERE price<=0 OR cardinality(image_urls)=0) THEN RAISE EXCEPTION 'Invalid source catalog'; END IF;
 IF EXISTS(SELECT 1 FROM import_stage s LEFT JOIN categories c ON c.slug=s.category_slug WHERE c.id IS NULL) THEN RAISE EXCEPTION 'Unknown category'; END IF;
END $$;
INSERT INTO subcategories(category_id,name,slug)
SELECT DISTINCT c.id,s.brand,s.brand_slug FROM import_stage s JOIN categories c ON c.slug=s.category_slug
ON CONFLICT(category_id,slug) DO NOTHING;
INSERT INTO product_types(subcategory_id,name,slug)
SELECT DISTINCT b.id,s.type,s.type_slug FROM import_stage s JOIN categories c ON c.slug=s.category_slug JOIN subcategories b ON b.category_id=c.id AND b.slug=s.brand_slug
ON CONFLICT(subcategory_id,slug) DO NOTHING;
INSERT INTO products(name,slug,description,price,compare_at_price,stock,category_id,subcategory_id,product_type_id,image_urls,thumbnail_url,is_active,is_featured)
SELECT s.name,s.slug,s.description,s.price,s.compare_at_price,0,c.id,b.id,t.id,s.image_urls,s.thumbnail_url,true,false
FROM import_stage s JOIN categories c ON c.slug=s.category_slug JOIN subcategories b ON b.category_id=c.id AND b.slug=s.brand_slug JOIN product_types t ON t.subcategory_id=b.id AND t.slug=s.type_slug
ON CONFLICT(slug) DO NOTHING;
DO $$ BEGIN
 IF (SELECT count(*) FROM import_stage s JOIN products p ON p.slug=s.slug JOIN categories c ON c.id=p.category_id JOIN subcategories b ON b.id=p.subcategory_id JOIN product_types t ON t.id=p.product_type_id WHERE p.name=s.name AND p.description=s.description AND p.price=s.price AND p.compare_at_price IS NOT DISTINCT FROM s.compare_at_price AND p.stock=0 AND p.is_active AND c.slug=s.category_slug AND b.slug=s.brand_slug AND t.slug=s.type_slug AND p.image_urls=s.image_urls AND p.thumbnail_url=s.thumbnail_url) <> EXPECTED THEN RAISE EXCEPTION 'Import verification failed'; END IF;
END $$;
COMMIT;
SELECT s.name as brand,count(*) as imported,min(p.price) as minimum_price,max(p.price) as maximum_price,count(*) filter(where p.compare_at_price>p.price) as offers FROM products p JOIN subcategories s ON s.id=p.subcategory_id WHERE p.slug IN (SLUGS) GROUP BY s.name ORDER BY s.name;
""".replace('EXPECTED',str(len(rows))).replace('SLUGS',','.join("'"+p['slug']+"'" for p in rows))
print(sql)
