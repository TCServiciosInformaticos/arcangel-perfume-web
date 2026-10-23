BEGIN;
ALTER TABLE public.staff_accounts DROP CONSTRAINT staff_accounts_modules_check;
ALTER TABLE public.staff_accounts ADD CONSTRAINT staff_accounts_modules_check CHECK(modules <@ ARRAY['usuarios','resumen','herramientas','estadisticas','pedidos','slider','productos','categorias','politica-precios','historial','clientes','alertas']::text[] AND cardinality(modules)<=12);
CREATE TABLE public.admin_change_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor_id uuid, actor_name text NOT NULL, entity text NOT NULL, record_id text NOT NULL,
 record_name text NOT NULL, operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
 source text NOT NULL, changes jsonb NOT NULL
);
ALTER TABLE public.admin_change_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_change_log FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_change_log TO authenticated;
GRANT ALL ON public.admin_change_log TO service_role;
CREATE POLICY staff_history_read ON public.admin_change_log FOR SELECT TO authenticated USING(private.can_access_module('historial'));
CREATE INDEX admin_change_log_date ON public.admin_change_log(occurred_at DESC,id DESC);
CREATE INDEX admin_change_log_entity_date ON public.admin_change_log(entity,occurred_at DESC,id DESC);
-- Internal trigger only: app roles cannot create, alter or delete audit entries.
-- Whitelist fields to exclude customer contact information and credentials.
CREATE FUNCTION private.capture_admin_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_row jsonb; after_row jsonb; fields text[]; field text; delta jsonb:='{}'; ident text; title text;who text;
BEGIN
 before_row:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 after_row:=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 fields:=CASE TG_TABLE_NAME
 WHEN 'products' THEN ARRAY['name','description','article_code','barcode','price','compare_at_price','stock','is_active','is_featured','category_id','subcategory_id','product_type_id','image_urls','thumbnail_url']
 WHEN 'orders' THEN ARRAY['status','total','subtotal','shipping_cost','needs_review','stock_committed_at','archived_at']
 WHEN 'staff_accounts' THEN ARRAY['name','modules','enabled']
 WHEN 'home_slides' THEN ARRAY['title','subtitle','alt_text','image_path','mobile_position','destination','category_id','is_active','sort_order']
 ELSE ARRAY['name','slug','sort_order','is_active','category_id','subcategory_id'] END;
 FOREACH field IN ARRAY fields LOOP
 IF before_row->field IS DISTINCT FROM after_row->field THEN delta:=delta||jsonb_build_object(field,jsonb_build_object('before',before_row->field,'after',after_row->field));END IF;
 END LOOP;
 IF delta='{}'::jsonb THEN RETURN NULL;END IF;
 ident:=coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id');
 title:=CASE WHEN TG_TABLE_NAME='orders' THEN 'Pedido #'||coalesce(after_row->>'order_number',before_row->>'order_number') ELSE coalesce(after_row->>'name',before_row->>'name',after_row->>'title',before_row->>'title',ident) END;
 SELECT name INTO who FROM public.staff_accounts WHERE user_id=auth.uid();
 IF who IS NULL THEN who:=CASE WHEN auth.uid() IS NULL THEN 'Sistema / integración' WHEN private.has_role(auth.uid(),'admin') THEN 'Administrador' ELSE 'Usuario autenticado' END;END IF;
 INSERT INTO public.admin_change_log(actor_id,actor_name,entity,record_id,record_name,operation,source,changes)
 VALUES(auth.uid(),who,TG_TABLE_NAME,ident,title,TG_OP,coalesce(nullif(current_setting('app.change_source',true),''),'web / integración'),delta);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.capture_admin_change() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['products','categories','subcategories','product_types','brands','home_slides','orders','staff_accounts'] LOOP
 EXECUTE format('CREATE TRIGGER capture_admin_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.capture_admin_change()',t);
 END LOOP;
END $$;
-- Confirm exactly the previewed snapshot, atomically, with inventory lock ordering.
CREATE FUNCTION public.admin_apply_product_preview(rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE expected int; matched int;
BEGIN
 IF NOT private.can_access_module('productos') THEN RAISE EXCEPTION 'Sin permiso de Productos' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Vista previa inválida';END IF;
 expected:=jsonb_array_length(rows);
 IF expected NOT BETWEEN 1 AND 10000 OR EXISTS(SELECT 1 FROM jsonb_array_elements(rows) r WHERE jsonb_typeof(r->'expected_updated_at') IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'Vista previa inválida';END IF;
 IF (SELECT count(DISTINCT r->>'id') FROM jsonb_array_elements(rows) r)<>expected THEN RAISE EXCEPTION 'Artículos repetidos';END IF;
 PERFORM pg_advisory_xact_lock(872344001);
 PERFORM 1 FROM public.products WHERE id IN(SELECT (r->>'id')::uuid FROM jsonb_array_elements(rows) r) ORDER BY id FOR UPDATE;
 SELECT count(*) INTO matched FROM jsonb_array_elements(rows) r JOIN public.products p ON p.id=(r->>'id')::uuid AND p.updated_at=(r->>'expected_updated_at')::timestamptz;
 IF matched<>expected THEN RAISE EXCEPTION 'Hay artículos modificados desde la vista previa. Volvé a cargar el Excel; no se aplicó ningún cambio.' USING ERRCODE='40001';END IF;
 PERFORM set_config('app.change_source','excel',true);
 RETURN public.update_products_from_excel(rows);
END $$;
REVOKE ALL ON FUNCTION public.admin_apply_product_preview(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_product_preview(jsonb) TO authenticated;
CREATE POLICY staff_customers_read ON public.orders FOR SELECT TO authenticated USING(private.can_access_module('clientes') OR private.can_access_module('alertas'));
CREATE POLICY staff_customers_items_read ON public.order_items FOR SELECT TO authenticated USING(private.can_access_module('clientes'));
CREATE POLICY staff_customers_payments_read ON public.order_payment_attempts FOR SELECT TO authenticated USING(private.can_access_module('clientes'));
CREATE FUNCTION public.admin_customer_list(term text DEFAULT '',page_number int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;BEGIN
 IF NOT private.can_access_module('clientes') THEN RAISE EXCEPTION 'Sin permiso de Clientes' USING ERRCODE='42501';END IF;
 IF page_number<0 OR page_number>100000 OR length(term)>200 THEN RAISE EXCEPTION 'Filtro inválido';END IF;
 WITH base AS MATERIALIZED (
 SELECT o.*,lower(btrim(coalesce(nullif(o.customer_account_email,''),o.customer_email))) customer_key,
 (o.status IN ('paid','preparing','shipped','delivered') AND o.mp_payment_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.order_payment_attempts a WHERE a.order_id=o.id AND a.payment_id=o.mp_payment_id AND a.state='approved')) verified
 FROM public.orders o
 ), grouped AS (
 SELECT customer_key email,(array_agg(customer_name ORDER BY created_at DESC,id DESC))[1] name,
 (array_agg(customer_whatsapp ORDER BY created_at DESC,id DESC))[1] whatsapp,
 count(*) orders,count(*) FILTER(WHERE verified) paid_orders,
 coalesce(sum(total) FILTER(WHERE verified),0) spent,max(created_at) last_order,
 count(*) FILTER(WHERE status IN ('pending_payment','recovery_pending','recovery_notified','payment_rejected','abandoned','abandoned_final')) unpaid_orders
 FROM base GROUP BY customer_key
 ), filtered AS MATERIALIZED (
 SELECT * FROM grouped WHERE strpos(lower(coalesce(name,'')||' '||coalesce(email,'')||' '||coalesce(whatsapp,'')),lower(btrim(term)))>0
 ), paged AS(SELECT * FROM filtered ORDER BY last_order DESC,email LIMIT 25 OFFSET page_number*25)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY last_order DESC,email) FROM paged p),'[]'::jsonb)) INTO result;
 RETURN result;END $$;
CREATE FUNCTION public.admin_customer_orders(customer_key text,page_number int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;BEGIN
 IF NOT private.can_access_module('clientes') THEN RAISE EXCEPTION 'Sin permiso de Clientes' USING ERRCODE='42501';END IF;
 IF length(customer_key)>254 OR page_number<0 OR page_number>100000 THEN RAISE EXCEPTION 'Filtro inválido';END IF;
 WITH scoped AS MATERIALIZED (
 SELECT o.id,o.order_number,o.status,o.created_at,o.total,
 (o.status IN ('paid','preparing','shipped','delivered') AND EXISTS(SELECT 1 FROM public.order_payment_attempts a WHERE a.order_id=o.id AND a.payment_id=o.mp_payment_id AND a.state='approved')) verified,
 coalesce((SELECT jsonb_agg(jsonb_build_object('name',i.product_name,'quantity',i.quantity,'total',i.line_total) ORDER BY i.id) FROM public.order_items i WHERE i.order_id=o.id),'[]'::jsonb) items
 FROM public.orders o WHERE lower(btrim(coalesce(nullif(o.customer_account_email,''),o.customer_email)))=lower(btrim(customer_key))
 ), paged AS(SELECT * FROM scoped ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET page_number*20)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM scoped),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY created_at DESC,id DESC) FROM paged p),'[]'::jsonb)) INTO result;
 RETURN result;END $$;
CREATE FUNCTION public.admin_business_alerts(kind text DEFAULT 'sin_stock',threshold int DEFAULT 5,page_number int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;BEGIN
 IF NOT private.can_access_module('alertas') THEN RAISE EXCEPTION 'Sin permiso de Alertas' USING ERRCODE='42501';END IF;
 IF threshold NOT BETWEEN 1 AND 100000 OR page_number<0 OR page_number>100000 OR kind NOT IN ('sin_stock','stock_bajo','sin_imagen','precio_cero','sin_codigo','pedido_revision','pedido_pendiente') THEN RAISE EXCEPTION 'Filtro inválido';END IF;
 WITH alerts AS MATERIALIZED (
 SELECT p.id::text id,p.name label,k.kind,
 CASE k.kind WHEN 'precio_cero' THEN 'Precio de venta en cero' WHEN 'sin_imagen' THEN 'Sin imagen cargada' WHEN 'sin_codigo' THEN 'Sin código de artículo' ELSE 'Stock actual: '||p.stock END detail,'/admin/productos' route
 FROM public.products p CROSS JOIN LATERAL (VALUES
 ('sin_stock',p.stock=0),('stock_bajo',p.stock BETWEEN 1 AND threshold),('sin_imagen',coalesce(array_length(p.image_urls,1),0)=0 AND nullif(btrim(p.thumbnail_url),'') IS NULL),('precio_cero',p.price=0),('sin_codigo',nullif(btrim(p.article_code),'') IS NULL)) k(kind,matched)
 WHERE p.is_active AND k.matched
 UNION ALL
 SELECT o.id::text,'Pedido #'||o.order_number,k.kind,
 CASE k.kind WHEN 'pedido_revision' THEN 'Revisar pago o stock' ELSE 'Sin pago confirmado; creado hace más de 24 horas' END,'/admin/pedidos'
 FROM public.orders o CROSS JOIN LATERAL (VALUES ('pedido_revision',o.needs_review),('pedido_pendiente',o.status IN ('pending_payment','recovery_pending','recovery_notified','payment_rejected','abandoned') AND o.created_at<now()-interval '24 hours')) k(kind,matched)
 WHERE o.archived_at IS NULL AND k.matched
 ), grouped AS(SELECT a.kind,count(*) n FROM alerts a GROUP BY a.kind),paged AS(SELECT * FROM alerts a WHERE a.kind=admin_business_alerts.kind ORDER BY label,id LIMIT 25 OFFSET page_number*25)
 SELECT jsonb_build_object('counts',coalesce((SELECT jsonb_object_agg(g.kind,g.n) FROM grouped g),'{}'::jsonb),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY label,id) FROM paged p),'[]'::jsonb)) INTO result;
 RETURN result;END $$;
REVOKE ALL ON FUNCTION public.admin_customer_list(text,int),public.admin_customer_orders(text,int),public.admin_business_alerts(text,int,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_customer_list(text,int),public.admin_customer_orders(text,int),public.admin_business_alerts(text,int,int) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
