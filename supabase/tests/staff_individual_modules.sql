BEGIN;
DO $$ DECLARE u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); p uuid:=gen_random_uuid();c uuid:=gen_random_uuid();BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(u,u||'@example.invalid',now()),(v,v||'@example.invalid',now());
 INSERT INTO public.staff_accounts(user_id,name,email,modules) VALUES(u,'Module fixture',u||'@example.invalid',ARRAY['productos']),(v,'Other fixture',v||'@example.invalid',ARRAY['slider']);
 INSERT INTO public.categories(id,name,slug) VALUES(c,'Module fixture',c::text);
 INSERT INTO public.products(id,name,slug,price,stock,is_active) VALUES(p,'Module fixture',p::text,10,1,false);
 PERFORM set_config('staff.fixture_user',u::text,true);PERFORM set_config('staff.fixture_other',v::text,true);PERFORM set_config('staff.fixture_product',p::text,true);PERFORM set_config('staff.fixture_category',c::text,true);
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('staff.fixture_user'),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int;BEGIN
 UPDATE public.products SET name='Product edit allowed' WHERE id=current_setting('staff.fixture_product')::uuid; GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Products permission broken';END IF;
 UPDATE public.categories SET name='Forbidden' WHERE id=current_setting('staff.fixture_category')::uuid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Products granted categories';END IF;
 BEGIN PERFORM public.apply_price_policy('[]',10,'increase',false);RAISE EXCEPTION 'Products granted price policy';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.admin_save_staff(auth.uid(),'Forbidden',ARRAY['usuarios'],true,now());RAISE EXCEPTION 'Products granted users';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['categorias'] WHERE user_id=current_setting('staff.fixture_user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int;BEGIN
 UPDATE public.categories SET name='Category edit allowed' WHERE id=current_setting('staff.fixture_category')::uuid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Categories permission broken';END IF;
 UPDATE public.products SET name='Forbidden' WHERE id=current_setting('staff.fixture_product')::uuid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Categories granted products';END IF;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['politica-precios'] WHERE user_id=current_setting('staff.fixture_user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int;BEGIN
 PERFORM public.apply_price_policy(jsonb_build_array(jsonb_build_object('id',current_setting('staff.fixture_product'),'updated_at',(SELECT updated_at FROM public.products WHERE id=current_setting('staff.fixture_product')::uuid))),10,'increase',false);
 IF (SELECT price FROM public.products WHERE id=current_setting('staff.fixture_product')::uuid)<>11 THEN RAISE EXCEPTION 'Price policy did not apply';END IF;
 BEGIN UPDATE public.products SET name='Forbidden' WHERE id=current_setting('staff.fixture_product')::uuid;RAISE EXCEPTION 'Price policy edited product name';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.update_products_from_excel('[]');RAISE EXCEPTION 'Price policy granted product Excel';EXCEPTION WHEN insufficient_privilege THEN NULL;WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Solo administradores%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['estadisticas'] WHERE user_id=current_setting('staff.fixture_user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int;BEGIN
 PERFORM public.admin_sales_statistics(current_date-1,current_date);
 IF EXISTS(SELECT 1 FROM public.product_costs) THEN RAISE EXCEPTION 'Stats exposed costs';END IF;
 BEGIN PERFORM public.admin_profit_report(current_date-1,current_date);RAISE EXCEPTION 'Stats granted tools report';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 UPDATE public.products SET price=12 WHERE id=current_setting('staff.fixture_product')::uuid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Stats granted product writes';END IF;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['herramientas'] WHERE user_id=current_setting('staff.fixture_user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.admin_profit_report(current_date-1,current_date);
 PERFORM public.admin_commerce('cost',jsonb_build_object('product_id',current_setting('staff.fixture_product'),'barcode','12345678','unit_cost',5,'expected_product_updated_at',(SELECT updated_at FROM public.products WHERE id=current_setting('staff.fixture_product')::uuid)));
 BEGIN UPDATE public.products SET stock=9 WHERE id=current_setting('staff.fixture_product')::uuid;RAISE EXCEPTION 'Tools granted stock edits';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.admin_sales_statistics(current_date-1,current_date);RAISE EXCEPTION 'Tools granted statistics';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['usuarios'] WHERE user_id=current_setting('staff.fixture_user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.admin_save_staff(current_setting('staff.fixture_other')::uuid,'Managed fixture',ARRAY['estadisticas'],true,(SELECT updated_at FROM public.staff_accounts WHERE user_id=current_setting('staff.fixture_other')::uuid));
 IF NOT EXISTS(SELECT 1 FROM public.staff_accounts WHERE user_id=current_setting('staff.fixture_other')::uuid AND modules=ARRAY['estadisticas']) THEN RAISE EXCEPTION 'Users delegation failed';END IF;
 IF private.can_access_module('productos') OR private.can_access_module('estadisticas') OR private.can_access_module('catalogo') THEN RAISE EXCEPTION 'Users silently gained other modules';END IF;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET enabled=false WHERE user_id=current_setting('staff.fixture_user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF private.can_access_module('usuarios') THEN RAISE EXCEPTION 'Disabled account retains Users';END IF;
 IF has_column_privilege(current_user,'public.order_recovery_emails','payload','SELECT') THEN RAISE EXCEPTION 'Recovery payload exposed';END IF;
END $$;
RESET ROLE;
SELECT true AS passed;
ROLLBACK;
