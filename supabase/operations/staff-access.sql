-- Apply once on the independent Supabase project. No real employees are seeded.
CREATE TABLE public.staff_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 120),
 email text NOT NULL CHECK(length(email) BETWEEN 3 AND 254),
 modules text[] NOT NULL DEFAULT '{}' CHECK(modules <@ ARRAY['catalogo','pedidos','slider']::text[] AND cardinality(modules)<=3),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_accounts FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(name,modules,enabled) ON public.staff_accounts TO authenticated;
GRANT ALL ON public.staff_accounts TO service_role;
CREATE POLICY staff_read_self_or_admin ON public.staff_accounts FOR SELECT TO authenticated USING(user_id=auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY staff_admin_update ON public.staff_accounts FOR UPDATE TO authenticated USING(private.has_role(auth.uid(),'admin')) WITH CHECK(private.has_role(auth.uid(),'admin'));
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON public.staff_accounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
-- Private, caller-bound authorization lookup; never expose auth records or claims.
CREATE FUNCTION private.can_access_module(requested text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='admin') OR EXISTS(SELECT 1 FROM public.staff_accounts s WHERE s.user_id=auth.uid() AND s.enabled AND requested=ANY(s.modules)))
$$;
REVOKE ALL ON FUNCTION private.can_access_module(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_module(text) TO authenticated,service_role;
CREATE FUNCTION public.admin_save_staff(employee_id uuid,employee_name text,allowed_modules text[],active boolean,expected_version timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.staff_accounts;
BEGIN
 IF NOT coalesce(private.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=employee_id AND role='admin') THEN RAISE EXCEPTION 'Los permisos del administrador no se editan desde empleados';END IF;
 UPDATE public.staff_accounts SET name=btrim(employee_name),modules=allowed_modules,enabled=active WHERE user_id=employee_id AND updated_at=expected_version RETURNING * INTO result;
 IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta cambió. Recargá la lista antes de guardar';END IF;
 RETURN jsonb_build_object('updated_at',result.updated_at);
END $$;
REVOKE ALL ON FUNCTION public.admin_save_staff(uuid,text,text[],boolean,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_staff(uuid,text,text[],boolean,timestamptz) TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['products','categories','subcategories','product_types','brands'] LOOP
 EXECUTE format('CREATE POLICY staff_catalog_access ON public.%I FOR ALL TO authenticated USING(private.can_access_module(''catalogo'')) WITH CHECK(private.can_access_module(''catalogo''))',t);
 END LOOP;
END $$;
CREATE POLICY staff_slider_access ON public.home_slides FOR ALL TO authenticated USING(private.can_access_module('slider')) WITH CHECK(private.can_access_module('slider'));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['orders','order_items','order_payment_attempts','order_events','order_stock_reservations','order_recovery_emails'] LOOP
 EXECUTE format('CREATE POLICY staff_orders_read ON public.%I FOR SELECT TO authenticated USING(private.can_access_module(''pedidos''))',t);
 END LOOP;
END $$;
CREATE POLICY staff_orders_update ON public.orders FOR UPDATE TO authenticated USING(private.can_access_module('pedidos')) WITH CHECK(private.can_access_module('pedidos'));
CREATE POLICY staff_order_events_insert ON public.order_events FOR INSERT TO authenticated WITH CHECK(private.can_access_module('pedidos'));
CREATE POLICY staff_release_reservations ON public.order_stock_reservations FOR DELETE TO authenticated USING(private.can_access_module('pedidos'));
-- Recovery payload contains guest capabilities and must never reach browser users.
GRANT SELECT(order_id,state,attempts,sent_at,next_attempt_at,last_error) ON public.order_recovery_emails TO authenticated;
-- Preserve SECURITY INVOKER on existing RPCs and replace only their module gate.
DO $$ DECLARE f record; definition text; module text; BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('update_products_from_excel','apply_price_policy','save_home_slide','reorder_home_slides','delete_home_slide','admin_order_action') LOOP
 module:=CASE WHEN f.proname IN ('update_products_from_excel','apply_price_policy') THEN 'catalogo' WHEN f.proname='admin_order_action' THEN 'pedidos' ELSE 'slider' END;
 definition:=pg_get_functiondef(f.oid);
 IF f.proname='admin_order_action' THEN
 definition:=replace(definition,'IF action=''archive'' THEN','IF action=''resolve_stock'' AND NOT private.has_role(auth.uid(),''admin'') THEN RAISE EXCEPTION ''Resolver diferencias de stock requiere al administrador''; END IF; IF action=''archive'' THEN');
 END IF;
 -- Change the first role gate only; the additional stock-resolution owner gate stays.
 definition:=regexp_replace(definition,'private\.has_role\(auth.uid\(\),\s*''admin''(?:::(?:public\.)?app_role)?\)',format('private.can_access_module(%L)',module));
 EXECUTE definition;
 END LOOP;
END $$;
-- Restrict uploads by bucket as well as the caller's granted module.
DO $$ DECLARE p record; gate text := '(bucket_id IN (''product-images'',''slider-images'') AND private.can_access_module(CASE bucket_id WHEN ''product-images'' THEN ''catalogo'' ELSE ''slider'' END))'; BEGIN
 FOR p IN SELECT policyname,cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('catalog_images_admin_select','catalog_images_admin_insert','catalog_images_admin_update','catalog_images_admin_delete') LOOP
 EXECUTE format('ALTER POLICY %I ON storage.objects %s',p.policyname,CASE WHEN p.cmd='INSERT' THEN 'WITH CHECK ('||gate||')' WHEN p.cmd='UPDATE' THEN 'USING ('||gate||') WITH CHECK ('||gate||')' ELSE 'USING ('||gate||')' END);
 END LOOP;
END $$;
