-- Transactional authorization checks; synthetic identity, no real employee committed.
BEGIN;
DO $$ DECLARE uid uuid:=gen_random_uuid();pid uuid:=gen_random_uuid(); BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(uid,uid::text||'@example.invalid',now());
 INSERT INTO public.staff_accounts(user_id,name,email,modules) VALUES(uid,'Staff security fixture',uid::text||'@example.invalid',ARRAY['slider']);
 INSERT INTO public.products(id,name,slug,price,stock,is_active) VALUES(pid,'Staff security fixture',pid::text,10,1,false);
 PERFORM set_config('staff.fixture_user',uid::text,true);PERFORM set_config('staff.fixture_product',pid::text,true);
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN IF has_table_privilege(current_user,'public.staff_accounts','SELECT') THEN RAISE EXCEPTION 'Public employee directory';END IF;END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('staff.fixture_user'),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
 IF NOT private.can_access_module('slider') OR private.can_access_module('productos') OR private.can_access_module('pedidos') THEN RAISE EXCEPTION 'Incorrect module gates';END IF;
 IF EXISTS(SELECT 1 FROM public.orders) OR EXISTS(SELECT 1 FROM public.product_costs) THEN RAISE EXCEPTION 'Private data exposed';END IF;
 IF (SELECT count(*) FROM public.staff_accounts)<>1 THEN RAISE EXCEPTION 'Employee directory leaked';END IF;
 UPDATE public.products SET price=price+1 WHERE id=current_setting('staff.fixture_product')::uuid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Slider employee edited catalog';END IF;
 UPDATE public.staff_accounts SET modules=ARRAY['productos','pedidos','slider'] WHERE user_id=auth.uid();GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Employee self-escalation';END IF;
 UPDATE public.home_slides SET title=title;GET DIAGNOSTICS n=ROW_COUNT;IF n=0 THEN RAISE EXCEPTION 'Slider employee cannot edit slides';END IF;
 BEGIN PERFORM public.admin_save_staff(auth.uid(),'Unauthorized',ARRAY['productos'],true,now());RAISE EXCEPTION 'Employee managed users';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.admin_profit_report(current_date-7,current_date);RAISE EXCEPTION 'Employee read profit';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['productos'] WHERE user_id=current_setting('staff.fixture_user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
 IF private.can_access_module('slider') OR NOT private.can_access_module('productos') THEN RAISE EXCEPTION 'Live permission change failed';END IF;
 UPDATE public.products SET price=11 WHERE id=current_setting('staff.fixture_product')::uuid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Catalog employee cannot edit hidden product';END IF;
 BEGIN PERFORM public.admin_commerce('cost','{}');RAISE EXCEPTION 'Catalog employee edited costs';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['pedidos'] WHERE user_id=current_setting('staff.fixture_user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
 IF NOT private.can_access_module('pedidos') OR private.can_access_module('productos') THEN RAISE EXCEPTION 'Order module change failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders) THEN RAISE EXCEPTION 'Order employee cannot read migrated orders';END IF;
 IF has_column_privilege(current_user,'public.order_recovery_emails','payload','SELECT') THEN RAISE EXCEPTION 'Recovery capability exposed';END IF;
 UPDATE public.products SET price=12 WHERE id=current_setting('staff.fixture_product')::uuid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Order employee edited catalog';END IF;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET enabled=false WHERE user_id=current_setting('staff.fixture_user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF private.can_access_module('pedidos') OR private.can_access_module('productos') OR private.can_access_module('slider') OR EXISTS(SELECT 1 FROM public.orders) THEN RAISE EXCEPTION 'Disabled employee retains access';END IF;
 IF has_table_privilege(current_user,'public.staff_accounts','INSERT') OR has_table_privilege(current_user,'public.user_roles','INSERT') OR has_table_privilege(current_user,'public.products','TRUNCATE') THEN RAISE EXCEPTION 'Dangerous staff grant';END IF;
END $$;
RESET ROLE;
SELECT jsonb_build_object('passed',true,'checks','module gates, own-record visibility, self-escalation denial, slider edit, catalog edit, order isolation, protected recovery payload, immediate disable, owner-only costs') AS verification;
ROLLBACK;
