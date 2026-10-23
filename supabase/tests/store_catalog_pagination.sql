BEGIN;
DO $$ DECLARE prefix text:=gen_random_uuid()::text;p uuid;c uuid:=gen_random_uuid();b uuid:=gen_random_uuid();t uuid:=gen_random_uuid();BEGIN
 INSERT INTO public.categories(id,name,slug) VALUES(c,'Pagination fixture',c::text);
 INSERT INTO public.subcategories(id,category_id,name,slug) VALUES(b,c,'Pagination brand',b::text);
 INSERT INTO public.product_types(id,subcategory_id,name,slug) VALUES(t,b,'Pagination type',t::text);
 FOR i IN 1..53 LOOP
 p:=gen_random_uuid();
 INSERT INTO public.products(id,name,slug,price,compare_at_price,stock,is_active,category_id,subcategory_id,product_type_id)
 VALUES(p,prefix||' product '||i,p::text,i,CASE WHEN i%2=0 THEN i+10 ELSE NULL END,1,i<>53,c,b,t);
 END LOOP;
 PERFORM set_config('perf.prefix',prefix,true);PERFORM set_config('perf.category',c::text,true);PERFORM set_config('perf.brand',b::text,true);PERFORM set_config('perf.type',t::text,true);
END $$;
SET LOCAL ROLE anon;
DO $$ DECLARE first_page jsonb;second_page jsonb;last_page jsonb;offer_page jsonb;r jsonb;BEGIN
 first_page:=public.store_catalog_page(p_query=>current_setting('perf.prefix'),p_sort=>'price-asc');
 second_page:=public.store_catalog_page(p_query=>current_setting('perf.prefix'),p_sort=>'price-asc',p_page=>2);
 last_page:=public.store_catalog_page(p_query=>current_setting('perf.prefix'),p_sort=>'price-asc',p_page=>999);
 IF (first_page->>'total')::int<>52 OR jsonb_array_length(first_page->'products')<>24 OR jsonb_array_length(second_page->'products')<>24 OR jsonb_array_length(last_page->'products')<>4 OR (last_page->>'page')::int<>3 THEN RAISE EXCEPTION 'Wrong pagination sizes';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(first_page->'products') a JOIN jsonb_array_elements(second_page->'products') b ON a->>'id'=b->>'id') THEN RAISE EXCEPTION 'Repeated product across pages';END IF;
 IF (first_page->'products'->0->>'price')::numeric<>1 OR (second_page->'products'->0->>'price')::numeric<>25 THEN RAISE EXCEPTION 'Unstable price sort';END IF;
 offer_page:=public.store_catalog_page(p_query=>current_setting('perf.prefix'),p_offers=>true);
 IF (offer_page->>'total')::int<>26 THEN RAISE EXCEPTION 'Wrong offers count';END IF;
 r:=public.store_catalog_page(p_category=>current_setting('perf.category'),p_brand=>current_setting('perf.brand'),p_type=>current_setting('perf.type'),p_query=>current_setting('perf.prefix'),p_sort=>'price-desc');
 IF (r->>'total')::int<>52 OR (r->'products'->0->>'price')::numeric<>52 THEN RAISE EXCEPTION 'Classification or descending sort failed';END IF;
 r:=public.store_catalog_page(p_query=>current_setting('perf.prefix')||'%');
 IF (r->>'total')::int<>0 THEN RAISE EXCEPTION 'Search wildcard escaped literal matching';END IF;
 IF first_page::text LIKE '%unit_cost%' OR first_page::text LIKE '%checkout_key%' THEN RAISE EXCEPTION 'Private fields exposed';END IF;
END $$;
RESET ROLE;
SELECT true AS passed;
ROLLBACK;
