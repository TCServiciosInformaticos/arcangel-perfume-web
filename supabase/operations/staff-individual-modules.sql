-- Upgrade staff permissions to one checkbox for each admin menu entry.
BEGIN;
ALTER TABLE public.staff_accounts DROP CONSTRAINT staff_accounts_modules_check;
UPDATE public.staff_accounts SET modules=ARRAY(SELECT DISTINCT unnest(array_remove(modules,'catalogo')||ARRAY['productos','categorias','politica-precios'])) WHERE 'catalogo'=ANY(modules);
ALTER TABLE public.staff_accounts ADD CONSTRAINT staff_accounts_modules_check CHECK(modules <@ ARRAY['usuarios','resumen','herramientas','estadisticas','pedidos','slider','productos','categorias','politica-precios']::text[] AND cardinality(modules)<=9);
-- Support the short rolling-deployment interval with the previous frontend.
CREATE OR REPLACE FUNCTION private.normalize_staff_modules() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF 'catalogo'=ANY(NEW.modules) THEN NEW.modules:=ARRAY(SELECT DISTINCT unnest(array_remove(NEW.modules,'catalogo')||ARRAY['productos','categorias','politica-precios']));END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.normalize_staff_modules() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER staff_normalize_modules BEFORE INSERT OR UPDATE ON public.staff_accounts FOR EACH ROW EXECUTE FUNCTION private.normalize_staff_modules();
-- The old combined permission is never an authorization gate anymore.
CREATE OR REPLACE FUNCTION private.can_access_module(requested text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='admin') OR EXISTS(SELECT 1 FROM public.staff_accounts s WHERE s.user_id=auth.uid() AND s.enabled AND requested=ANY(s.modules)))
$$;
ALTER POLICY staff_read_self_or_admin ON public.staff_accounts USING(user_id=auth.uid() OR private.can_access_module('usuarios'));
ALTER POLICY staff_admin_update ON public.staff_accounts USING(private.can_access_module('usuarios') AND NOT private.has_role(user_id,'admin')) WITH CHECK(private.can_access_module('usuarios') AND NOT private.has_role(user_id,'admin'));
-- Each catalog screen has its own writes; shared lookups remain public reads.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['products','categories','subcategories','product_types','brands'] LOOP
 EXECUTE format('DROP POLICY staff_catalog_access ON public.%I',t);
 IF t<>'products' THEN EXECUTE format('CREATE POLICY staff_categories_access ON public.%I FOR ALL TO authenticated USING(private.can_access_module(''categorias'')) WITH CHECK(private.can_access_module(''categorias''))',t);END IF;
 END LOOP;
END $$;
CREATE POLICY staff_products_access ON public.products FOR ALL TO authenticated USING(private.can_access_module('productos')) WITH CHECK(private.can_access_module('productos'));
CREATE POLICY staff_products_lookup ON public.products FOR SELECT TO authenticated USING(private.can_access_module('politica-precios') OR private.can_access_module('estadisticas') OR private.can_access_module('herramientas'));
CREATE POLICY staff_product_limited_update ON public.products FOR UPDATE TO authenticated USING(private.can_access_module('politica-precios') OR private.can_access_module('herramientas')) WITH CHECK(private.can_access_module('politica-precios') OR private.can_access_module('herramientas'));
-- Shared-table permissions cannot accidentally grant unrelated product edits.
CREATE FUNCTION private.guard_staff_product_update() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE allowed text[]:=ARRAY['updated_at']; BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') OR private.has_role(auth.uid(),'admin') OR private.can_access_module('productos') THEN RETURN NEW;END IF;
 IF private.can_access_module('politica-precios') THEN allowed:=allowed||ARRAY['price','compare_at_price'];END IF;
 IF private.can_access_module('herramientas') THEN allowed:=allowed||ARRAY['barcode'];END IF;
 IF (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN RAISE EXCEPTION 'El módulo asignado no permite modificar estos datos del artículo' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_staff_product_update() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_staff_product_update BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION private.guard_staff_product_update();
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['orders','order_items','order_payment_attempts','order_events'] LOOP
 EXECUTE format('CREATE POLICY staff_reports_read ON public.%I FOR SELECT TO authenticated USING(private.can_access_module(''estadisticas'') OR private.can_access_module(''herramientas''))',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['bundles','bundle_components','coupons','product_costs','order_picking'] LOOP
 EXECUTE format('CREATE POLICY staff_tools_access ON public.%I FOR ALL TO authenticated USING(private.can_access_module(''herramientas'')) WITH CHECK(private.can_access_module(''herramientas''))',t);
 END LOOP;
END $$;
CREATE POLICY staff_tools_notices ON public.stock_notifications FOR SELECT TO authenticated USING(private.can_access_module('herramientas'));
-- Preserve invoker execution, validation, locking and optimistic concurrency.
DO $$ DECLARE f record; definition text; gate text; BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('admin_save_staff','admin_commerce','admin_profit_report','admin_sales_statistics','update_products_from_excel','apply_price_policy') LOOP
 definition:=pg_get_functiondef(f.oid);
 IF f.proname IN ('update_products_from_excel','apply_price_policy') THEN
 gate:=CASE WHEN f.proname='apply_price_policy' THEN 'politica-precios' ELSE 'productos' END;
 definition:=replace(definition,'private.can_access_module(''catalogo'')',format('private.can_access_module(%L)',gate));
 ELSE
 gate:=CASE WHEN f.proname='admin_save_staff' THEN 'usuarios' WHEN f.proname='admin_sales_statistics' THEN 'estadisticas' ELSE 'herramientas' END;
 definition:=regexp_replace(definition,'private\.has_role\(auth.uid\(\),\s*''admin''(?:::(?:public\.)?app_role)?\)',format('private.can_access_module(%L)',gate));
 END IF;
 IF f.proname='admin_save_staff' THEN definition:=replace(definition,'EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=employee_id AND role=''admin'')','private.has_role(employee_id,''admin'')');END IF;
 EXECUTE definition;
 END LOOP;
END $$;
DO $$ DECLARE p record;gate text:='(bucket_id IN (''product-images'',''slider-images'') AND private.can_access_module(CASE bucket_id WHEN ''product-images'' THEN ''productos'' ELSE ''slider'' END))'; BEGIN
 FOR p IN SELECT policyname,cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('catalog_images_admin_select','catalog_images_admin_insert','catalog_images_admin_update','catalog_images_admin_delete') LOOP
 EXECUTE format('ALTER POLICY %I ON storage.objects %s',p.policyname,CASE WHEN p.cmd='INSERT' THEN 'WITH CHECK ('||gate||')' WHEN p.cmd='UPDATE' THEN 'USING ('||gate||') WITH CHECK ('||gate||')' ELSE 'USING ('||gate||')' END);
 END LOOP;
END $$;
COMMIT;
