-- Test database only, after commerce-tools.sql.
BEGIN;
-- Test transaction only. No emails or committed subscriptions.
DO $$ DECLARE p uuid:=gen_random_uuid();b uuid:=gen_random_uuid();other uuid:=gen_random_uuid();BEGIN
 INSERT INTO public.products(id,name,slug,price,stock) VALUES(p,'Security fixture',p::text,12,0),(other,'Security fixture 2',other::text,20,3);
 INSERT INTO public.product_costs VALUES(p,2,now());
 INSERT INTO public.bundles(id,name,price,is_active) VALUES(b,'Security fixture bundle',29.99,true);
 INSERT INTO public.bundle_components VALUES(b,p,1),(b,other,1);
 PERFORM set_config('commerce.fixture_product',p::text,true);PERFORM set_config('commerce.fixture_bundle',b::text,true);
 PERFORM set_config('commerce.fixture_user',(SELECT id::text FROM auth.users WHERE email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false) LIMIT 1),true);
END $$;
SET LOCAL ROLE anon;
DO $$ DECLARE q jsonb;BEGIN
 q:=public.preview_store_cart(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',current_setting('commerce.fixture_bundle'),'quantity',1))));
 IF (q->>'amount')::numeric<>29.99 OR q::text LIKE '%unit_cost%' THEN RAISE EXCEPTION 'Public quote is incorrect or includes costs';END IF;
 IF has_table_privilege(current_user,'public.product_costs','SELECT') OR has_table_privilege(current_user,'public.bundles','TRUNCATE') OR has_function_privilege(current_user,'public.commerce_quote(jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Unexpected anonymous privilege';END IF;
 BEGIN PERFORM public.admin_commerce('cost','{}');RAISE EXCEPTION 'Anonymous admin allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('commerce.fixture_user'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.manage_stock_notice(current_setting('commerce.fixture_product')::uuid);
 IF NOT EXISTS(SELECT 1 FROM public.stock_notifications WHERE product_id=current_setting('commerce.fixture_product')::uuid AND state='waiting') THEN RAISE EXCEPTION 'Verified user subscription failed';END IF;
 PERFORM public.manage_stock_notice(current_setting('commerce.fixture_product')::uuid,true);
 IF NOT EXISTS(SELECT 1 FROM public.stock_notifications WHERE product_id=current_setting('commerce.fixture_product')::uuid AND state='cancelled') THEN RAISE EXCEPTION 'Cancellation failed';END IF;
 IF has_table_privilege(current_user,'public.coupons','TRUNCATE') THEN RAISE EXCEPTION 'Unexpected truncate privilege';END IF;
END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000000099','role','authenticated')::text,true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.stock_notifications WHERE product_id=current_setting('commerce.fixture_product')::uuid) THEN RAISE EXCEPTION 'Another user can read subscriptions';END IF;
 IF EXISTS(SELECT 1 FROM public.product_costs WHERE product_id=current_setting('commerce.fixture_product')::uuid) THEN RAISE EXCEPTION 'Nonadmin can read costs';END IF;
 BEGIN PERFORM public.admin_commerce('coupon','{}');RAISE EXCEPTION 'Nonadmin admin allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.manage_stock_notice(current_setting('commerce.fixture_product')::uuid);RAISE EXCEPTION 'Unconfirmed subscription allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unconfirmed subscription allowed' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
SELECT jsonb_build_object('passed',true,'checks','anonymous quote without costs, no anon or authenticated truncate grants, admin denial, cost RLS, verified account-only subscription, own-record cancellation and other-user isolation') verification;
ROLLBACK;
