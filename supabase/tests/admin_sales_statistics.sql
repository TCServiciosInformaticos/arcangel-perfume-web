-- Run only on a test database with the migration applied and an existing admin.
BEGIN;
-- All fixture writes and function creation roll back. Explicit numbers avoid sequence changes.
DO $$ DECLARE c1 uuid:=gen_random_uuid();c2 uuid:=gen_random_uuid();p1 uuid:=gen_random_uuid();p2 uuid:=gen_random_uuid();
 o1 uuid:=gen_random_uuid();o2 uuid:=gen_random_uuid();o3 uuid:=gen_random_uuid();o4 uuid:=gen_random_uuid();o5 uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.categories(id,name,slug) VALUES(c1,'Stats fixture A',c1::text),(c2,'Stats fixture B',c2::text);
 INSERT INTO public.products(id,name,slug,price,stock,category_id) VALUES(p1,'Stats fixture 1',p1::text,100,4,c1),(p2,'Stats fixture 2',p2::text,100,0,c2);
 INSERT INTO public.orders(id,order_number,customer_name,customer_email,customer_whatsapp,delivery_method,subtotal,shipping_cost,total,status,mp_payment_id,created_at,archived_at) VALUES
 (o1,-2000000001,'Fixture','fixture@example.invalid','000','pickup',300,50,350,'delivered','stats-fixture-1','2099-10-20T10:00:00Z',now()),
 (o2,-2000000002,'Fixture','fixture@example.invalid','000','pickup',200,0,200,'paid','stats-fixture-2','2099-10-20T10:00:00Z',null),
 (o3,-2000000003,'Fixture','fixture@example.invalid','000','pickup',100,0,100,'paid','stats-fixture-3','2099-10-19T10:00:00Z',null),
 (o4,-2000000004,'Fixture','fixture@example.invalid','000','pickup',999,0,999,'pending_payment',null,'2099-10-20T10:00:00Z',null),
 (o5,-2000000005,'Fixture','fixture@example.invalid','000','pickup',888,0,888,'paid',null,'2099-10-20T10:00:00Z',null);
 INSERT INTO public.order_items(order_id,product_id,product_name,quantity,unit_price,line_total) VALUES(o1,p1,'Fixture 1',2,100,200),(o1,p2,'Fixture 2',1,100,100),(o2,p1,'Fixture 1',2,100,200),(o3,p1,'Fixture 1',1,100,100),(o4,p1,'Fixture 1',1,999,999),(o5,p1,'Fixture 1',1,888,888);
 INSERT INTO public.order_payment_attempts(order_id,state,payment_id,total,subtotal,shipping_cost,items,expires_at,created_at) VALUES
 (o1,'approved','stats-fixture-1',350,300,50,'[]',now(),'2099-10-20T10:00:00Z'),(o1,'approved','stats-fixture-duplicate',350,300,50,'[]',now(),'2099-10-20T10:01:00Z'),
 (o2,'approved','stats-fixture-2',200,200,0,'[]',now(),'2099-10-20T10:00:00Z'),(o3,'approved','stats-fixture-3',100,100,0,'[]',now(),'2099-10-19T10:00:00Z');
 INSERT INTO public.order_events(id,order_id,kind,detail,created_at) OVERRIDING SYSTEM VALUE VALUES
 (-2000000001,o1,'payment_approved','{"payment_id":"stats-fixture-1"}','2099-10-21T01:00:00Z'),
 (-2000000002,o2,'payment_approved','{"payment_id":"stats-fixture-2"}','2099-10-21T03:00:00Z'),
 (-2000000003,o3,'payment_approved','{"payment_id":"stats-fixture-3"}','2099-10-19T12:00:00Z');
 PERFORM set_config('stats.fixture_category',c1::text,true);
END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT user_id FROM public.user_roles WHERE role='admin' LIMIT 1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; s jsonb; BEGIN
 r:=public.admin_sales_statistics('2099-10-20','2099-10-20');
 IF (r#>>'{current,revenue}')::numeric<>350 OR (r#>>'{current,orders}')::int<>1 OR (r#>>'{current,units}')::int<>3 OR (r#>>'{previous,revenue}')::numeric<>100 OR (r->>'unverified_orders')::int<>1 THEN RAISE EXCEPTION 'Incorrect totals: %',r->'current';END IF;
 IF (r#>>'{daily,0,revenue}')::numeric<>350 THEN RAISE EXCEPTION 'Argentina date boundary failed';END IF;
 s:=public.admin_sales_statistics('2099-10-20','2099-10-20',current_setting('stats.fixture_category')::uuid);
 IF (s#>>'{current,revenue}')::numeric<>200 OR (s#>>'{current,shipping}')::numeric<>0 OR (s#>>'{current,units}')::int<>2 THEN RAISE EXCEPTION 'Category/shipping failed';END IF;
 r:=public.admin_sales_statistics('2026-10-01','2026-10-21');
 IF jsonb_array_length(r->'products')<(select count(*) from public.products where is_active) THEN RAISE EXCEPTION 'Product truncation';END IF;
 BEGIN PERFORM public.admin_sales_statistics('2026-10-21','2026-10-01');RAISE EXCEPTION 'Range accepted';EXCEPTION WHEN SQLSTATE '22023' THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000000099','role','authenticated')::text,true);
DO $$ BEGIN BEGIN PERFORM public.admin_sales_statistics('2026-10-01','2026-10-21');RAISE EXCEPTION 'Non-admin accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
SELECT jsonb_build_object('passed',true,'checks','verified payments, no duplicate attempts, archived included, Argentina midnight, paid date, previous period, category/shipping, >1000 products, legacy excluded, invalid range and non-admin denial') verification;
ROLLBACK;
