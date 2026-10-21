-- Run on a test database after applying commerce-tools.sql.
BEGIN;
DO $$ DECLARE cat uuid:=gen_random_uuid(); p1 uuid:=gen_random_uuid();p2 uuid:=gen_random_uuid();b uuid:=gen_random_uuid();uid uuid:=gen_random_uuid();q jsonb;r jsonb;oid uuid;aid uuid;used int;BEGIN
 INSERT INTO public.categories(id,name,slug) VALUES(cat,'COMMERCE FIXTURE CATEGORY',cat::text);
 INSERT INTO public.products(id,name,slug,price,stock) VALUES(p1,'COMMERCE FIXTURE 1',p1::text,30,20),(p2,'COMMERCE FIXTURE 2',p2::text,40,20);
 UPDATE public.products SET category_id=cat WHERE id=p1;
 INSERT INTO public.product_costs VALUES(p1,10,now()),(p2,20,now());
 INSERT INTO public.bundles(id,name,price,is_active) VALUES(b,'COMMERCE FIXTURE KIT',79.99,true);
 INSERT INTO public.bundle_components VALUES(b,p1,2),(b,p2,1);
 q:=public.commerce_quote(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',b,'quantity',1),jsonb_build_object('productId',p1,'quantity',1))));
 IF (q->>'amount')::numeric<>109.99 OR (SELECT sum((x->>'line_total')::numeric) FROM jsonb_array_elements(q->'items')x)<>109.99 OR (SELECT sum((x->>'quantity')::int) FROM jsonb_array_elements(q->'items')x)<>4 THEN RAISE EXCEPTION 'Bundle quote incorrect: %',q;END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(q->'items')x WHERE (x->>'unit_price')::numeric*100<>trunc((x->>'unit_price')::numeric*100)) THEN RAISE EXCEPTION 'Non-centavo price';END IF;
 INSERT INTO public.coupons(code,kind,value,ends_at,max_uses,is_active) VALUES('COMMERCEFIXTURE','percent',10,now()+interval '1 day',1,true);
 q:=public.commerce_quote(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',b,'quantity',1)),'coupon_code','COMMERCEFIXTURE','verified_user_id',uid));
 IF (q->>'amount')::numeric<>71.99 OR (q->>'discount')::numeric<>8 OR (SELECT sum((x->>'line_total')::numeric) FROM jsonb_array_elements(q->'items')x)<>71.99 THEN RAISE EXCEPTION 'Coupon rounding incorrect: %',q;END IF;
 BEGIN PERFORM public.commerce_quote(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',p1,'quantity',1)),'coupon_code','COMMERCEFIXTURE'));RAISE EXCEPTION 'Unverified coupon accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unverified coupon accepted' THEN RAISE;END IF;END;
 r:=public.reserve_order_checkout(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',b,'quantity',2),jsonb_build_object('productId',p1,'quantity',1)),'customer_name','Fixture','customer_email','fixture@example.invalid','customer_whatsapp','000000000','delivery_method','pickup','coupon_code','COMMERCEFIXTURE','verified_user_id',uid),null,gen_random_uuid());
 oid:=(r#>>'{order,id}')::uuid;aid:=(r#>>'{attempt,id}')::uuid;
 IF (SELECT sum(quantity) FROM public.order_stock_reservations WHERE order_id=oid AND product_id=p1)<>5 THEN RAISE EXCEPTION 'Combined component reservations incorrect';END IF;
 BEGIN PERFORM public.commerce_quote(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',b,'quantity',1)),'coupon_code','COMMERCEFIXTURE','verified_user_id',gen_random_uuid()));RAISE EXCEPTION 'Coupon held quota ignored';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Coupon held quota ignored' THEN RAISE;END IF;END;
 IF (public.reserve_order_checkout(NULL,oid)#>>'{attempt,id}')::uuid<>aid THEN RAISE EXCEPTION 'Retry changed active attempt';END IF;
 PERFORM public.apply_verified_order_payment(aid,'commerce-fixture-payment','approved');
 PERFORM public.apply_verified_order_payment(aid,'commerce-fixture-payment','approved');
 IF (SELECT stock FROM public.products WHERE id=p1)<>15 OR (SELECT stock FROM public.products WHERE id=p2)<>18 THEN RAISE EXCEPTION 'Component stock decremented incorrectly';END IF;
 IF EXISTS(SELECT 1 FROM public.order_items WHERE order_id=oid AND unit_cost IS NULL) THEN RAISE EXCEPTION 'Missing cost snapshot';END IF;
 IF EXISTS(SELECT 1 FROM public.order_items WHERE order_id=oid AND line_total<>unit_price*quantity) THEN RAISE EXCEPTION 'Line total mismatch';END IF;
 INSERT INTO public.coupons(code,kind,value,ends_at,max_uses,is_active,category_id) VALUES('COMMERCEFIXED','fixed',17.25,now()+interval '1 day',10,true,cat);
 q:=public.commerce_quote(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',p1,'quantity',1),jsonb_build_object('productId',p2,'quantity',1)),'coupon_code','COMMERCEFIXED','verified_user_id',uid));
 IF (q->>'amount')::numeric<>52.75 OR (SELECT sum((x->>'line_total')::numeric) FROM jsonb_array_elements(q->'items')x WHERE x->>'product_id'=p2::text)<>40 THEN RAISE EXCEPTION 'Fixed category discount incorrect';END IF;
 UPDATE public.coupons SET first_purchase=true WHERE code='COMMERCEFIXED';
 BEGIN PERFORM public.commerce_quote(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',p1,'quantity',1)),'coupon_code','COMMERCEFIXED','verified_user_id',uid));RAISE EXCEPTION 'First-purchase coupon accepted after purchase';EXCEPTION WHEN raise_exception THEN IF SQLERRM='First-purchase coupon accepted after purchase' THEN RAISE;END IF;END;
 PERFORM set_config('commerce.fixture_product',p1::text,true);
 -- Mutating current costs must never alter the snapshot.
 UPDATE public.product_costs SET unit_cost=999 WHERE product_id=p1;
 IF EXISTS(SELECT 1 FROM public.order_items WHERE order_id=oid AND product_id=p1 AND unit_cost<>10) THEN RAISE EXCEPTION 'Historical cost changed';END IF;
END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT user_id FROM public.user_roles WHERE role='admin' LIMIT 1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p uuid:=current_setting('commerce.fixture_product')::uuid;BEGIN
 PERFORM public.admin_commerce('cost',jsonb_build_object('product_id',p,'unit_cost',12,'barcode','7791234567890','expected_updated_at',(SELECT updated_at FROM public.product_costs WHERE product_id=p),'expected_product_updated_at',(SELECT updated_at FROM public.products WHERE id=p)));
 IF (SELECT unit_cost FROM public.product_costs WHERE product_id=p)<>12 THEN RAISE EXCEPTION 'Admin cost save denied';END IF;
 BEGIN PERFORM public.admin_commerce('cost',jsonb_build_object('product_id',p,'unit_cost',13,'barcode','7791234567890','expected_updated_at',now()-interval '1 minute','expected_product_updated_at',(SELECT updated_at FROM public.products WHERE id=p)));RAISE EXCEPTION 'Stale cost accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Stale cost accepted' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
SELECT jsonb_build_object('passed',true,'checks','combo + standalone overlap, exact centavo totals, coupon rounding and held quota, guest denial, grouped stock reservations, idempotent payment, immutable cost snapshot') verification;
ROLLBACK;
