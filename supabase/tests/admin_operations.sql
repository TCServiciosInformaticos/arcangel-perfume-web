BEGIN;
DO $$ DECLARE u uuid:=gen_random_uuid(); p uuid:=gen_random_uuid();o uuid:=gen_random_uuid();unpaid uuid:=gen_random_uuid();email text:=gen_random_uuid()||'@example.invalid';BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(u,email,now());
 INSERT INTO public.staff_accounts(user_id,name,email,modules) VALUES(u,'Operations test',email,ARRAY['productos']);
 INSERT INTO public.products(id,name,slug,price,stock,is_active) VALUES(p,'Operations test',p::text,10,0,true);
 INSERT INTO public.orders(id,order_number,customer_name,customer_email,customer_whatsapp,delivery_method,subtotal,total,status,mp_payment_id,created_at) VALUES
 (o,-(random()*100000000+100)::int,'Synthetic client',email,'000','pickup',100,110,'paid',o::text,now()-interval '1 day'),
 (unpaid,-(random()*100000000+100)::int,'Synthetic client',upper(email),'000','pickup',999,999,'pending_payment',NULL,now()-interval '2 days');
 INSERT INTO public.order_items(order_id,product_id,product_name,quantity,unit_price,line_total) VALUES(o,p,'Operations test',1,100,100);
 INSERT INTO public.order_payment_attempts(order_id,payment_id,state,total,subtotal,shipping_cost,items,expires_at) VALUES(o,o::text,'approved',110,100,10,'[]',now());
 PERFORM set_config('ops.user',u::text,true);PERFORM set_config('ops.product',p::text,true);PERFORM set_config('ops.email',email,true);PERFORM set_config('ops.order',o::text,true);
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('ops.user'),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb;v timestamptz;BEGIN
 IF EXISTS(SELECT 1 FROM public.admin_change_log) THEN RAISE EXCEPTION 'Products exposed history';END IF;
 BEGIN PERFORM public.admin_customer_list();RAISE EXCEPTION 'Products exposed clients';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.admin_business_alerts();RAISE EXCEPTION 'Products exposed alerts';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 SELECT updated_at INTO v FROM public.products WHERE id=current_setting('ops.product')::uuid;
 PERFORM public.admin_apply_product_preview(jsonb_build_array(jsonb_build_object('id',current_setting('ops.product'),'price',20,'stock',2,'is_active',true,'expected_updated_at',v)));
 IF (SELECT price FROM public.products WHERE id=current_setting('ops.product')::uuid)<>20 THEN RAISE EXCEPTION 'Preview did not save';END IF;
 BEGIN PERFORM public.admin_apply_product_preview(jsonb_build_array(jsonb_build_object('id',current_setting('ops.product'),'price',30,'stock',3,'is_active',true,'expected_updated_at','2000-01-01T00:00:00Z')));RAISE EXCEPTION 'Stale preview applied';EXCEPTION WHEN serialization_failure THEN NULL;END;
 IF (SELECT price FROM public.products WHERE id=current_setting('ops.product')::uuid)<>20 THEN RAISE EXCEPTION 'Stale batch changed data';END IF;
 IF has_table_privilege(current_user,'public.admin_change_log','INSERT') OR has_table_privilege(current_user,'public.admin_change_log','UPDATE') OR has_table_privilege(current_user,'public.admin_change_log','DELETE') THEN RAISE EXCEPTION 'Editable audit log';END IF;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['historial'] WHERE user_id=current_setting('ops.user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_change_log WHERE record_id=current_setting('ops.product') AND actor_id=auth.uid() AND source='excel' AND (changes->'price'->>'before')::numeric=10 AND (changes->'price'->>'after')::numeric=20) THEN RAISE EXCEPTION 'Missing attributed Excel audit';END IF;
 IF EXISTS(SELECT 1 FROM public.admin_change_log WHERE entity='orders' AND (changes ? 'customer_email' OR changes ? 'customer_whatsapp')) THEN RAISE EXCEPTION 'Contact data in audit';END IF;
 BEGIN PERFORM public.admin_customer_list();RAISE EXCEPTION 'History exposed clients';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['clientes'] WHERE user_id=current_setting('ops.user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb;BEGIN
 r:=public.admin_customer_list(current_setting('ops.email'),0);
 IF (r->>'total')::int<>1 OR (r->'rows'->0->>'orders')::int<>2 OR (r->'rows'->0->>'paid_orders')::int<>1 OR (r->'rows'->0->>'spent')::numeric<>110 THEN RAISE EXCEPTION 'Wrong customer aggregation: %',r;END IF;
 r:=public.admin_customer_orders(current_setting('ops.email'),0);
 IF (r->>'total')::int<>2 THEN RAISE EXCEPTION 'Missing customer orders';END IF;
 IF r::text LIKE '%checkout_key%' OR r::text LIKE '%unit_cost%' THEN RAISE EXCEPTION 'Sensitive customer detail';END IF;
 IF EXISTS(SELECT 1 FROM public.admin_change_log) THEN RAISE EXCEPTION 'Clients exposed audit';END IF;
END $$;
RESET ROLE;
UPDATE public.staff_accounts SET modules=ARRAY['alertas'] WHERE user_id=current_setting('ops.user')::uuid;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb;BEGIN
 r:=public.admin_business_alerts('sin_imagen',5,0);
 IF NOT (r->'counts' ? 'sin_imagen') THEN RAISE EXCEPTION 'Missing product alerts';END IF;
 IF (r->'counts'->>'pedido_pendiente')::int<1 THEN RAISE EXCEPTION 'Missing overdue order alert';END IF;
 IF has_column_privilege(current_user,'public.order_recovery_emails','payload','SELECT') THEN RAISE EXCEPTION 'Recovery capability exposed';END IF;
 BEGIN PERFORM public.admin_customer_list();RAISE EXCEPTION 'Alerts exposed customers RPC';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SELECT true AS passed;
ROLLBACK;
