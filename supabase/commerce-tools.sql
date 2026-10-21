-- Additive commerce tools. Applied transactionally after rollback verification.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON public.products(barcode) WHERE barcode IS NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commerce_cart jsonb, ADD COLUMN IF NOT EXISTS customer_user_id uuid, ADD COLUMN IF NOT EXISTS customer_account_email text, ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE public.order_payment_attempts ADD COLUMN IF NOT EXISTS coupon_code text, ADD COLUMN IF NOT EXISTS customer_user_id uuid;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_cost numeric(12,2);
CREATE TABLE IF NOT EXISTS public.product_costs(product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,unit_cost numeric(12,2) NOT NULL CHECK(unit_cost>=0),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.bundles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(name) BETWEEN 2 AND 160),description text NOT NULL DEFAULT '',price numeric(12,2) NOT NULL CHECK(price>0),is_active boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.bundle_components(bundle_id uuid NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,product_id uuid NOT NULL REFERENCES public.products(id),quantity int NOT NULL CHECK(quantity BETWEEN 1 AND 20),PRIMARY KEY(bundle_id,product_id));
CREATE TABLE IF NOT EXISTS public.coupons(code text PRIMARY KEY CHECK(code ~ '^[A-Z0-9_-]{3,30}$'),kind text NOT NULL CHECK(kind IN ('percent','fixed')),value numeric(12,2) NOT NULL CHECK(value>0),minimum numeric(12,2) NOT NULL DEFAULT 0 CHECK(minimum>=0),category_id uuid REFERENCES public.categories(id),starts_at timestamptz NOT NULL DEFAULT now(),ends_at timestamptz NOT NULL,max_uses int NOT NULL CHECK(max_uses>0),per_customer int NOT NULL DEFAULT 1 CHECK(per_customer>0),first_purchase boolean NOT NULL DEFAULT false,is_active boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_at>starts_at),CHECK(kind<>'percent' OR value<100));
CREATE TABLE IF NOT EXISTS public.order_picking(item_id uuid PRIMARY KEY REFERENCES public.order_items(id) ON DELETE CASCADE,checked boolean NOT NULL DEFAULT false,updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.stock_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,state text NOT NULL DEFAULT 'waiting' CHECK(state IN ('waiting','sending','sent','cancelled','review')),claimed_at timestamptz,sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,product_id));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['product_costs','bundles','bundle_components','coupons','order_picking','stock_notifications'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='admin_read_commerce') THEN EXECUTE format('CREATE POLICY admin_read_commerce ON public.%I FOR SELECT TO authenticated USING(private.has_role(auth.uid(),''admin''))',t);END IF;
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
END LOOP;END $$;
GRANT SELECT ON public.bundles,public.bundle_components TO anon;
CREATE POLICY public_bundles ON public.bundles FOR SELECT TO anon,authenticated USING(is_active);
CREATE POLICY public_bundle_components ON public.bundle_components FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.bundles b WHERE b.id=bundle_id AND b.is_active));
CREATE POLICY own_stock_notifications ON public.stock_notifications FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.list_store_bundles() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.name),'[]') FROM (
 SELECT b.id,b.name,b.description,b.price,CASE WHEN bool_and(p.is_active AND p.price>0) THEN min(floor(p.stock::numeric/c.quantity))::int ELSE 0 END stock,
 jsonb_agg(jsonb_build_object('product_id',p.id,'name',p.name,'quantity',c.quantity)) components
 FROM public.bundles b JOIN public.bundle_components c ON c.bundle_id=b.id JOIN public.products p ON p.id=c.product_id
 WHERE b.is_active GROUP BY b.id HAVING count(*)>=2 AND count(*)=(SELECT count(*) FROM public.bundle_components all_c WHERE all_c.bundle_id=b.id)) q
$$;
GRANT EXECUTE ON FUNCTION public.list_store_bundles() TO anon,authenticated;

-- Service-only quote: never accept client-supplied prices, costs or identity.
CREATE OR REPLACE FUNCTION public.commerce_quote(payload jsonb, exclude_order uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.coupons%ROWTYPE; coupon_input text:=upper(trim(coalesce(payload->>'coupon_code','')));uid uuid:=nullif(payload->>'verified_user_id','')::uuid;raw jsonb; snap jsonb; subtotal numeric; eligible_amount numeric; discount numeric:=0; n int;
BEGIN
 IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'items') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Carrito inválido';END IF;
 IF (SELECT count(DISTINCT x->>'productId') FROM jsonb_array_elements(payload->'items')x)<>jsonb_array_length(payload->'items') THEN RAISE EXCEPTION 'Productos repetidos';END IF;
 FOR raw IN SELECT value FROM jsonb_array_elements(payload->'items') LOOP
  IF (raw->>'quantity')::numeric<>trunc((raw->>'quantity')::numeric) OR (raw->>'quantity')::int NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Cantidad inválida';END IF;
  IF EXISTS(SELECT 1 FROM public.products WHERE id=(raw->>'productId')::uuid) AND EXISTS(SELECT 1 FROM public.bundles WHERE id=(raw->>'productId')::uuid) THEN RAISE EXCEPTION 'Identificador de artículo ambiguo';END IF;
  IF EXISTS(SELECT 1 FROM public.bundle_components bc JOIN public.products cp ON cp.id=bc.product_id WHERE bc.bundle_id=(raw->>'productId')::uuid AND (NOT cp.is_active OR cp.price<=0)) THEN RAISE EXCEPTION 'Un componente no está disponible';END IF;
  IF EXISTS(SELECT 1 FROM public.bundles WHERE id=(raw->>'productId')::uuid) AND (SELECT count(*) FROM public.bundle_components WHERE bundle_id=(raw->>'productId')::uuid)<2 THEN RAISE EXCEPTION 'El combo necesita al menos dos componentes';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=(raw->>'productId')::uuid AND is_active AND price>0) AND NOT EXISTS(SELECT 1 FROM public.bundles WHERE id=(raw->>'productId')::uuid AND is_active) THEN RAISE EXCEPTION 'Artículo o combo no disponible';END IF;
 END LOOP;
 WITH req AS (SELECT (x->>'productId')::uuid id,(x->>'quantity')::int qty FROM jsonb_array_elements(payload->'items')x),expanded AS (
 SELECT r.id parent,p.id,p.name,p.category_id,r.qty quantity,p.price price,p.price*r.qty target FROM req r JOIN public.products p ON p.id=r.id
 UNION ALL SELECT r.id,p.id,p.name,p.category_id,r.qty*bc.quantity,p.price,b.price*r.qty FROM req r JOIN public.bundles b ON b.id=r.id JOIN public.bundle_components bc ON bc.bundle_id=b.id JOIN public.products p ON p.id=bc.product_id
 ),weighted AS (SELECT *,sum(price*quantity) OVER(PARTITION BY parent) weight FROM expanded),units AS (
 SELECT w.*,g.i,floor(target*100*price/weight) cents,row_number() OVER(PARTITION BY parent ORDER BY id,g.i) rn FROM weighted w CROSS JOIN LATERAL generate_series(1,w.quantity)g(i)
 ),allocated AS (SELECT *,cents+CASE WHEN rn<=round(target*100)-sum(cents)OVER(PARTITION BY parent) THEN 1 ELSE 0 END final_cents FROM units)
 SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'category_id',category_id,'cents',final_cents) ORDER BY parent,id,i) INTO raw FROM allocated;
 IF raw IS NULL OR jsonb_array_length(raw)>5000 THEN RAISE EXCEPTION 'Combo vacío o carrito demasiado grande';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(raw)x LEFT JOIN public.products p ON p.id=(x->>'id')::uuid WHERE p.id IS NULL OR NOT p.is_active OR p.price<=0) THEN RAISE EXCEPTION 'Componente no disponible';END IF;
 SELECT sum((x->>'cents')::numeric)/100 INTO subtotal FROM jsonb_array_elements(raw)x;
 IF coupon_input<>'' THEN
  IF uid IS NULL THEN RAISE EXCEPTION 'Ingresá con tu cuenta y email confirmado para usar cupones';END IF;
  SELECT * INTO c FROM public.coupons WHERE coupons.code=coupon_input FOR UPDATE;
  IF c.code IS NULL OR NOT c.is_active OR now()<c.starts_at OR now()>=c.ends_at OR subtotal<c.minimum THEN RAISE EXCEPTION 'Cupón no válido, vencido o sin importe mínimo';END IF;
  SELECT count(DISTINCT a.order_id) INTO n FROM public.order_payment_attempts a WHERE a.coupon_code=c.code AND a.order_id IS DISTINCT FROM exclude_order AND (a.state='approved' OR (a.state IN ('preparing','ready') AND a.expires_at>now()));
  IF n>=c.max_uses THEN RAISE EXCEPTION 'Cupón sin usos disponibles';END IF;
  SELECT count(DISTINCT a.order_id) INTO n FROM public.order_payment_attempts a WHERE a.coupon_code=c.code AND a.customer_user_id=uid AND a.order_id IS DISTINCT FROM exclude_order AND (a.state='approved' OR (a.state IN ('preparing','ready') AND a.expires_at>now()));
  IF n>=c.per_customer OR (c.first_purchase AND EXISTS(SELECT 1 FROM public.orders o WHERE (o.customer_user_id=uid OR lower(o.customer_email)=lower(payload->>'verified_user_email')) AND o.id IS DISTINCT FROM exclude_order AND o.status IN ('paid','preparing','shipped','delivered') AND o.mp_payment_id IS NOT NULL)) THEN RAISE EXCEPTION 'Cupón no disponible para esta cuenta';END IF;
  SELECT coalesce(sum((x->>'cents')::numeric)/100,0) INTO eligible_amount FROM jsonb_array_elements(raw)x WHERE c.category_id IS NULL OR (x->>'category_id')::uuid=c.category_id;
  IF eligible_amount=0 THEN RAISE EXCEPTION 'El cupón no aplica a estos artículos';END IF;
  discount:=CASE WHEN c.kind='percent' THEN round(eligible_amount*c.value/100,2) ELSE c.value END;
  IF discount>=eligible_amount THEN RAISE EXCEPTION 'El descuento debe ser menor al importe de los artículos elegibles';END IF;
 END IF;
 WITH units AS (SELECT x,ord,CASE WHEN coupon_input<>'' AND (c.category_id IS NULL OR (x->>'category_id')::uuid=c.category_id) THEN true ELSE false END eligible FROM jsonb_array_elements(raw)WITH ORDINALITY v(x,ord)),floors AS (
 SELECT *,CASE WHEN eligible THEN floor((x->>'cents')::numeric*(eligible_total-discount*100)/eligible_total) ELSE (x->>'cents')::numeric END price FROM (SELECT *,sum(CASE WHEN eligible THEN (x->>'cents')::numeric ELSE 0 END)OVER() eligible_total FROM units)t
 ),final AS (
 SELECT x,price+CASE WHEN eligible AND sum(CASE WHEN eligible THEN 1 ELSE 0 END)OVER(ORDER BY ord)<=round(eligible_total-discount*100)-sum(CASE WHEN eligible THEN price ELSE 0 END)OVER() THEN 1 ELSE 0 END cents FROM floors
 ),grouped AS (SELECT (x->>'id')::uuid id,x->>'name' name,cents,count(*) quantity FROM final GROUP BY 1,2,3)
 SELECT jsonb_agg(jsonb_build_object('product_id',g.id,'product_name',g.name,'quantity',g.quantity,'unit_price',g.cents/100,'line_total',g.cents*g.quantity/100,'unit_cost',pc.unit_cost) ORDER BY g.id,g.cents) INTO snap FROM grouped g LEFT JOIN public.product_costs pc ON pc.product_id=g.id;
 IF jsonb_array_length(snap)>100 THEN RAISE EXCEPTION 'El carrito tiene demasiadas variantes de precio; dividilo en dos compras';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(snap)x WHERE (x->>'unit_price')::numeric<0.01) THEN RAISE EXCEPTION 'El descuento deja unidades sin precio; ajustá el combo o el cupón';END IF;
 RETURN jsonb_build_object('items',snap,'amount',subtotal-discount,'discount',discount,'coupon_code',nullif(coupon_input,''));
END $$;
REVOKE ALL ON FUNCTION public.commerce_quote(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_quote(jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_commerce(action text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE version timestamptz; bid uuid; x jsonb; item public.order_items%ROWTYPE;
BEGIN
 IF NOT coalesce(private.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(872344001);
 IF action='bundle' THEN
  bid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
  IF EXISTS(SELECT 1 FROM public.products WHERE id=bid) THEN RAISE EXCEPTION 'El identificador del combo ya corresponde a un artículo';END IF;
  SELECT updated_at INTO version FROM public.bundles WHERE id=bid FOR UPDATE;
  IF version IS NOT NULL AND version IS DISTINCT FROM nullif(payload->>'expected_updated_at','')::timestamptz THEN RAISE EXCEPTION 'El combo cambió; recargá antes de guardar';END IF;
  IF jsonb_typeof(payload->'components') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'components') NOT BETWEEN 2 AND 20 OR (SELECT count(DISTINCT j->>'product_id') FROM jsonb_array_elements(payload->'components')j)<>jsonb_array_length(payload->'components') THEN RAISE EXCEPTION 'Elegí entre 2 y 20 artículos distintos';END IF;
  INSERT INTO public.bundles(id,name,description,price,is_active) VALUES(bid,payload->>'name',coalesce(payload->>'description',''),(payload->>'price')::numeric,coalesce((payload->>'is_active')::boolean,false)) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,price=excluded.price,is_active=excluded.is_active,updated_at=now();
  DELETE FROM public.bundle_components WHERE bundle_id=bid;
  INSERT INTO public.bundle_components SELECT bid,(j->>'product_id')::uuid,(j->>'quantity')::int FROM jsonb_array_elements(payload->'components')j;
  RETURN to_jsonb(bid);
 ELSIF action='coupon' THEN
  SELECT updated_at INTO version FROM public.coupons WHERE code=upper(trim(payload->>'code')) FOR UPDATE;
  IF version IS NOT NULL AND version IS DISTINCT FROM nullif(payload->>'expected_updated_at','')::timestamptz THEN RAISE EXCEPTION 'El cupón cambió o ya existe; recargá antes de guardar';END IF;
  INSERT INTO public.coupons(code,kind,value,minimum,category_id,starts_at,ends_at,max_uses,per_customer,first_purchase,is_active) VALUES(upper(trim(payload->>'code')),payload->>'kind',(payload->>'value')::numeric,coalesce((payload->>'minimum')::numeric,0),nullif(payload->>'category_id','')::uuid,(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,(payload->>'max_uses')::int,coalesce((payload->>'per_customer')::int,1),coalesce((payload->>'first_purchase')::boolean,false),coalesce((payload->>'is_active')::boolean,false)) ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,minimum=excluded.minimum,category_id=excluded.category_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,max_uses=excluded.max_uses,per_customer=excluded.per_customer,first_purchase=excluded.first_purchase,is_active=excluded.is_active,updated_at=now();
 ELSIF action='cost' THEN
  IF nullif(payload->>'barcode','') IS NOT NULL AND payload->>'barcode' !~ '^[0-9]{8,14}$' THEN RAISE EXCEPTION 'Código de barras inválido';END IF;
  SELECT updated_at INTO version FROM public.product_costs WHERE product_id=(payload->>'product_id')::uuid FOR UPDATE;
  IF version IS NOT NULL AND version IS DISTINCT FROM nullif(payload->>'expected_updated_at','')::timestamptz THEN RAISE EXCEPTION 'El costo cambió; recargá antes de guardar';END IF;
  SELECT updated_at INTO version FROM public.products WHERE id=(payload->>'product_id')::uuid FOR UPDATE;
  IF version IS NULL OR version IS DISTINCT FROM nullif(payload->>'expected_product_updated_at','')::timestamptz THEN RAISE EXCEPTION 'El artículo cambió; volvé a buscarlo antes de guardar';END IF;
  UPDATE public.products SET barcode=nullif(trim(payload->>'barcode'),'') WHERE id=(payload->>'product_id')::uuid;
  IF nullif(payload->>'unit_cost','') IS NOT NULL THEN INSERT INTO public.product_costs(product_id,unit_cost) VALUES((payload->>'product_id')::uuid,(payload->>'unit_cost')::numeric) ON CONFLICT(product_id) DO UPDATE SET unit_cost=excluded.unit_cost,updated_at=now();END IF;
  RETURN jsonb_build_object('cost_updated_at',(SELECT updated_at FROM public.product_costs WHERE product_id=(payload->>'product_id')::uuid),'product_updated_at',(SELECT updated_at FROM public.products WHERE id=(payload->>'product_id')::uuid));
 ELSIF action='pick' THEN
  SELECT * INTO item FROM public.order_items WHERE id=(payload->>'item_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=item.order_id AND status IN ('paid','preparing') AND stock_committed_at IS NOT NULL AND NOT needs_review) THEN RAISE EXCEPTION 'El pedido debe estar pagado, con stock confirmado y sin revisión pendiente';END IF;
  INSERT INTO public.order_picking(item_id,checked,updated_by) VALUES(item.id,(payload->>'checked')::boolean,auth.uid()) ON CONFLICT(item_id) DO UPDATE SET checked=excluded.checked,updated_by=excluded.updated_by,updated_at=now();
 ELSE RAISE EXCEPTION 'Acción inválida';END IF;
 RETURN 'true'::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.admin_commerce(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_commerce(text,jsonb) TO authenticated;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['product_costs','bundles','bundle_components','coupons','order_picking'] LOOP
 EXECUTE format('GRANT INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
 EXECUTE format('CREATE POLICY admin_write_commerce ON public.%I FOR ALL TO authenticated USING(private.has_role(auth.uid(),''admin'')) WITH CHECK(private.has_role(auth.uid(),''admin''))',t);
END LOOP;END $$;

CREATE OR REPLACE FUNCTION public.reserve_order_checkout(payload jsonb, existing_id uuid DEFAULT NULL::uuid, request_key uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE quote jsonb; o orders%ROWTYPE; a order_payment_attempts%ROWTYPE; item jsonb; p products%ROWTYPE; amount numeric:=0; shipping numeric; units integer; snap jsonb:='[]'; until_time timestamptz:=now()+interval '30 minutes';
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 PERFORM expire_order_reservations();
 IF existing_id IS NOT NULL THEN SELECT * INTO o FROM orders WHERE id=existing_id FOR UPDATE;
 ELSIF request_key IS NOT NULL THEN SELECT * INTO o FROM orders WHERE checkout_key=request_key FOR UPDATE; END IF;
 IF existing_id IS NOT NULL AND o.id IS NULL THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
 IF o.id IS NOT NULL THEN
  IF o.recovery_sent_at IS NOT NULL AND o.abandon_at<=now() THEN RAISE EXCEPTION 'El plazo de recuperación del pedido venció'; END IF;
  IF o.status NOT IN ('pending_payment','payment_rejected','abandoned','recovery_pending','recovery_notified') THEN RAISE EXCEPTION 'Este pedido no admite nuevos pagos'; END IF;
  SELECT * INTO a FROM order_payment_attempts WHERE order_id=o.id AND state IN ('preparing','ready') AND expires_at>now() ORDER BY created_at DESC LIMIT 1;
  IF a.id IS NOT NULL THEN RETURN jsonb_build_object('order',to_jsonb(o),'attempt',to_jsonb(a),'new_attempt',false); END IF;
  payload:=to_jsonb(o)||jsonb_build_object('verified_user_id',o.customer_user_id,'verified_user_email',o.customer_account_email,'items',coalesce(o.commerce_cart,(SELECT jsonb_agg(jsonb_build_object('productId',product_id,'quantity',quantity)) FROM order_items WHERE order_id=o.id)));
 END IF;
 quote:=public.commerce_quote(payload,o.id); snap:=quote->'items';
 PERFORM 1 FROM products WHERE id IN(SELECT (x->>'product_id')::uuid FROM jsonb_array_elements(snap)x) ORDER BY id FOR UPDATE;
 quote:=public.commerce_quote(payload,o.id); snap:=quote->'items'; amount:=(quote->>'amount')::numeric;
 FOR item IN SELECT jsonb_build_object('product_id',x->>'product_id','quantity',sum((x->>'quantity')::int)) FROM jsonb_array_elements(snap)x GROUP BY x->>'product_id' LOOP
  SELECT * INTO p FROM products WHERE id=(item->>'product_id')::uuid;
  units:=(item->>'quantity')::int;
  IF p.stock-coalesce((SELECT sum(quantity) FROM order_stock_reservations WHERE product_id=p.id AND expires_at>now() AND (o.id IS NULL OR order_id<>o.id)),0)<units THEN RAISE EXCEPTION 'Stock insuficiente para %',p.name;END IF;
 END LOOP;
 SELECT CASE WHEN payload->>'delivery_method'='shipping' THEN shipping_cost ELSE 0 END INTO shipping FROM settings WHERE id=1;
 IF shipping IS NULL THEN RAISE EXCEPTION 'Configuración de entrega no disponible'; END IF;
 IF o.id IS NULL THEN
  INSERT INTO orders(checkout_key,customer_name,customer_email,customer_whatsapp,delivery_method,delivery_street,delivery_number,delivery_apartment,delivery_city,delivery_zip,delivery_day,delivery_time_slot,notes,pickup_branch,subtotal,shipping_cost,total)
  VALUES(request_key,payload->>'customer_name',payload->>'customer_email',payload->>'customer_whatsapp',(payload->>'delivery_method')::delivery_method,payload->>'delivery_street',payload->>'delivery_number',payload->>'delivery_apartment',payload->>'delivery_city',payload->>'delivery_zip',payload->>'delivery_day',(payload->>'delivery_time_slot')::time_slot,payload->>'notes',payload->>'pickup_branch',amount,shipping,amount+shipping) RETURNING * INTO o;
 END IF;
 UPDATE orders SET commerce_cart=payload->'items',customer_user_id=nullif(payload->>'verified_user_id','')::uuid,customer_account_email=payload->>'verified_user_email',coupon_code=quote->>'coupon_code' WHERE id=o.id;
 INSERT INTO order_payment_attempts(order_id,total,subtotal,shipping_cost,items,expires_at) VALUES(o.id,amount+shipping,amount,shipping,snap,until_time) RETURNING * INTO a;
 UPDATE order_payment_attempts SET coupon_code=quote->>'coupon_code',customer_user_id=nullif(payload->>'verified_user_id','')::uuid WHERE id=a.id;
 DELETE FROM order_stock_reservations WHERE order_id=o.id;
 INSERT INTO order_stock_reservations(order_id,product_id,attempt_id,quantity,expires_at) SELECT o.id,(x->>'product_id')::uuid,a.id,sum((x->>'quantity')::integer),until_time FROM jsonb_array_elements(snap) x GROUP BY x->>'product_id';
 DELETE FROM order_items WHERE order_id=o.id;
 INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,line_total,unit_cost) SELECT o.id,(x->>'product_id')::uuid,x->>'product_name',(x->>'quantity')::integer,(x->>'unit_price')::numeric,(x->>'line_total')::numeric,(x->>'unit_cost')::numeric FROM jsonb_array_elements(snap) x;
 UPDATE orders SET status='pending_payment',subtotal=amount,shipping_cost=shipping,total=amount+shipping,reservation_until=until_time,abandon_at=CASE WHEN recovery_sent_at IS NULL THEN now()+interval '24 hours' ELSE recovery_sent_at+interval '24 hours' END,recovery_due_at=CASE WHEN recovery_sent_at IS NULL THEN now()+interval '1 hour' ELSE recovery_due_at END,archived_at=NULL WHERE id=o.id RETURNING * INTO o;
 INSERT INTO order_events(order_id,kind,detail) VALUES(o.id,'checkout_reserved',jsonb_build_object('attempt_id',a.id,'total',a.total,'expires_at',until_time));
 RETURN jsonb_build_object('order',to_jsonb(o),'attempt',to_jsonb(a),'new_attempt',true);
END $function$
;

CREATE OR REPLACE FUNCTION public.apply_verified_order_payment(attempt_id uuid, payment text, provider_status text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE a order_payment_attempts%ROWTYPE; o orders%ROWTYPE; x jsonb; insufficient boolean:=false;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT * INTO a FROM order_payment_attempts WHERE id=attempt_id FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Intento no encontrado'; END IF;
 SELECT * INTO o FROM orders WHERE id=a.order_id FOR UPDATE;
 IF a.payment_id=payment AND a.state='approved' THEN RETURN; END IF;
 IF provider_status='approved' THEN
  UPDATE order_payment_attempts SET state='approved',payment_id=payment WHERE id=a.id;
  IF o.mp_payment_id IS NOT NULL AND o.status IN ('paid','preparing','shipped','delivered') THEN
   IF o.mp_payment_id<>payment THEN
    UPDATE orders SET needs_review=true,review_reason='Se detectó otro pago aprobado para el mismo pedido' WHERE id=o.id;
    INSERT INTO order_events(order_id,kind,detail) VALUES(o.id,'duplicate_payment',jsonb_build_object('payment_id',payment,'attempt_id',a.id));
   END IF;
   RETURN;
  END IF;
  PERFORM 1 FROM products WHERE id IN(SELECT (j->>'product_id')::uuid FROM jsonb_array_elements(a.items) j) ORDER BY id FOR UPDATE;
  FOR x IN SELECT jsonb_build_object('product_id',j->>'product_id','quantity',sum((j->>'quantity')::int)) FROM jsonb_array_elements(a.items)j GROUP BY j->>'product_id' LOOP
   IF NOT EXISTS(SELECT 1 FROM products p WHERE p.id=(x->>'product_id')::uuid AND p.stock-coalesce((SELECT sum(r.quantity) FROM order_stock_reservations r WHERE r.product_id=p.id AND r.order_id<>o.id AND r.expires_at>now()),0)>=(x->>'quantity')::integer) THEN insufficient:=true; END IF;
  END LOOP;
  IF NOT insufficient AND o.stock_committed_at IS NULL THEN
   UPDATE products p SET stock=p.stock-j.quantity FROM (SELECT (units.value->>'product_id')::uuid id,sum((units.value->>'quantity')::int)::int quantity FROM jsonb_array_elements(a.items)units(value) GROUP BY units.value->>'product_id')j WHERE p.id=j.id;
  END IF;
  DELETE FROM order_stock_reservations WHERE order_id=o.id;
  -- Fulfil the exact presentation and price that was paid, even after a later retry.
  DELETE FROM order_items WHERE order_id=o.id;
  INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,line_total,unit_cost) SELECT o.id,p.id,j->>'product_name',(j->>'quantity')::integer,(j->>'unit_price')::numeric,(j->>'line_total')::numeric,(j->>'unit_cost')::numeric FROM jsonb_array_elements(a.items) j LEFT JOIN products p ON p.id=(j->>'product_id')::uuid;
  UPDATE orders SET status='paid',mp_payment_id=payment,mp_preference_id=a.preference_id,total=a.total,subtotal=a.subtotal,shipping_cost=a.shipping_cost,
   stock_committed_at=CASE WHEN NOT insufficient THEN coalesce(o.stock_committed_at,now()) ELSE o.stock_committed_at END,
   needs_review=insufficient OR o.status='cancelled',review_reason=CASE WHEN insufficient THEN 'Pago aprobado sin stock disponible: resolver entrega o devolución' WHEN o.status='cancelled' THEN 'Pago aprobado después de cancelación manual' ELSE NULL END,
   reservation_until=NULL,archived_at=NULL WHERE id=o.id;
  IF a.coupon_code IS NOT NULL AND EXISTS(SELECT 1 FROM public.coupons c WHERE c.code=a.coupon_code AND (
    (SELECT count(DISTINCT z.order_id) FROM public.order_payment_attempts z WHERE z.coupon_code=c.code AND z.state='approved')>c.max_uses OR
    (SELECT count(DISTINCT z.order_id) FROM public.order_payment_attempts z WHERE z.coupon_code=c.code AND z.state='approved' AND z.customer_user_id=a.customer_user_id)>c.per_customer)) THEN
   UPDATE orders SET needs_review=true,review_reason=concat_ws('; ',review_reason,'El cupón superó su límite por una aprobación posterior al vencimiento de la reserva') WHERE id=o.id;
   INSERT INTO order_events(order_id,kind) VALUES(o.id,'coupon_late_review');
  END IF;
  INSERT INTO order_events(order_id,kind,detail) VALUES(o.id,'payment_approved',jsonb_build_object('payment_id',payment,'attempt_id',a.id,'stock_issue',insufficient));
 ELSIF a.state<>'approved' AND o.status NOT IN ('paid','preparing','shipped','delivered') THEN
  UPDATE order_payment_attempts SET state=CASE WHEN provider_status='rejected' THEN 'rejected' WHEN provider_status='cancelled' THEN 'cancelled' ELSE state END WHERE id=a.id;
  IF provider_status IN ('rejected','cancelled') THEN
   DELETE FROM order_stock_reservations WHERE order_stock_reservations.attempt_id=a.id;
   UPDATE orders SET status=CASE WHEN abandon_at<=now() THEN 'abandoned'::order_status ELSE 'payment_rejected'::order_status END WHERE id=o.id AND status NOT IN ('cancelled','abandoned_final') AND mp_preference_id=a.preference_id;
   INSERT INTO order_events(order_id,kind,detail) VALUES(o.id,'payment_rejected',jsonb_build_object('payment_id',payment,'status',provider_status,'attempt_id',a.id));
  END IF;
 END IF;
END $function$
;
CREATE OR REPLACE FUNCTION public.admin_profit_report(p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb;BEGIN
 IF NOT coalesce(private.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501';END IF;
 IF p_to<p_from OR p_to-p_from>365 THEN RAISE EXCEPTION 'Período inválido';END IF;
 WITH paid AS(SELECT o.id,coalesce((SELECT min(e.created_at) FROM public.order_events e WHERE e.order_id=o.id AND e.kind='payment_approved' AND e.detail->>'payment_id'=o.mp_payment_id),(SELECT min(a.created_at) FROM public.order_payment_attempts a WHERE a.order_id=o.id AND a.payment_id=o.mp_payment_id AND a.state='approved')) paid_at FROM public.orders o WHERE o.status IN ('paid','preparing','shipped','delivered') AND o.stock_committed_at IS NOT NULL AND NOT o.needs_review AND EXISTS(SELECT 1 FROM public.order_payment_attempts a WHERE a.order_id=o.id AND a.payment_id=o.mp_payment_id AND a.state='approved')),
 rows AS(SELECT i.* FROM paid p JOIN public.order_items i ON i.order_id=p.id WHERE (p.paid_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_from AND p_to),summary AS(SELECT product_id,product_name,sum(quantity) units,sum(line_total) revenue,sum(unit_cost*quantity) cost,sum(line_total-unit_cost*quantity) margin FROM rows WHERE unit_cost IS NOT NULL GROUP BY product_id,product_name)
 SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY margin DESC) FROM summary s),'[]'),'unknown_cost_units',(SELECT coalesce(sum(quantity),0) FROM rows WHERE unit_cost IS NULL),'known_margin',(SELECT coalesce(sum(margin),0) FROM summary)) INTO r;
 RETURN r;END $$;
REVOKE ALL ON FUNCTION public.admin_profit_report(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_profit_report(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_stock_notifications() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb;BEGIN
 UPDATE public.stock_notifications SET state='review' WHERE state='sending' AND claimed_at<now()-interval '15 minutes';
 WITH picked AS(SELECT s.id FROM public.stock_notifications s JOIN public.products p ON p.id=s.product_id WHERE s.state='waiting' AND p.stock>0 AND p.is_active ORDER BY s.created_at LIMIT 20 FOR UPDATE OF s SKIP LOCKED),changed AS(UPDATE public.stock_notifications s SET state='sending',claimed_at=now() FROM picked p WHERE s.id=p.id RETURNING s.*) SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') INTO r FROM changed c;RETURN r;END $$;
REVOKE ALL ON FUNCTION public.claim_stock_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stock_notifications() TO service_role;
-- Opt-in worker remains inactive until domain/provider configuration is verified.
SELECT cron.schedule('arcangel-restock-notifications','*/5 * * * *',$job$SELECT net.http_post(url:=replace(endpoint,'/order-maintenance','/restock-notifications'),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=120000) FROM private.order_job_config$job$);
SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='arcangel-restock-notifications';

CREATE OR REPLACE FUNCTION public.preview_store_cart(payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.coupons%ROWTYPE; coupon_input text:=upper(trim(coalesce(payload->>'coupon_code','')));uid uuid:=nullif(payload->>'verified_user_id','')::uuid;raw jsonb; snap jsonb; subtotal numeric; eligible_amount numeric; discount numeric:=0; n int;
BEGIN
 IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'items') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Carrito inválido';END IF;
 IF (SELECT count(DISTINCT x->>'productId') FROM jsonb_array_elements(payload->'items')x)<>jsonb_array_length(payload->'items') THEN RAISE EXCEPTION 'Productos repetidos';END IF;
 FOR raw IN SELECT value FROM jsonb_array_elements(payload->'items') LOOP
  IF (raw->>'quantity')::numeric<>trunc((raw->>'quantity')::numeric) OR (raw->>'quantity')::int NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Cantidad inválida';END IF;
  IF EXISTS(SELECT 1 FROM public.products WHERE id=(raw->>'productId')::uuid) AND EXISTS(SELECT 1 FROM public.bundles WHERE id=(raw->>'productId')::uuid) THEN RAISE EXCEPTION 'Identificador de artículo ambiguo';END IF;
  IF EXISTS(SELECT 1 FROM public.bundle_components bc JOIN public.products cp ON cp.id=bc.product_id WHERE bc.bundle_id=(raw->>'productId')::uuid AND (NOT cp.is_active OR cp.price<=0)) THEN RAISE EXCEPTION 'Un componente no está disponible';END IF;
  IF EXISTS(SELECT 1 FROM public.bundles WHERE id=(raw->>'productId')::uuid) AND (SELECT count(*) FROM public.bundle_components WHERE bundle_id=(raw->>'productId')::uuid)<2 THEN RAISE EXCEPTION 'El combo necesita al menos dos componentes';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=(raw->>'productId')::uuid AND is_active AND price>0) AND NOT EXISTS(SELECT 1 FROM public.bundles WHERE id=(raw->>'productId')::uuid AND is_active) THEN RAISE EXCEPTION 'Artículo o combo no disponible';END IF;
 END LOOP;
 WITH req AS (SELECT (x->>'productId')::uuid id,(x->>'quantity')::int qty FROM jsonb_array_elements(payload->'items')x),expanded AS (
 SELECT r.id parent,p.id,p.name,p.category_id,r.qty quantity,p.price price,p.price*r.qty target FROM req r JOIN public.products p ON p.id=r.id
 UNION ALL SELECT r.id,p.id,p.name,p.category_id,r.qty*bc.quantity,p.price,b.price*r.qty FROM req r JOIN public.bundles b ON b.id=r.id JOIN public.bundle_components bc ON bc.bundle_id=b.id JOIN public.products p ON p.id=bc.product_id
 ),weighted AS (SELECT *,sum(price*quantity) OVER(PARTITION BY parent) weight FROM expanded),units AS (
 SELECT w.*,g.i,floor(target*100*price/weight) cents,row_number() OVER(PARTITION BY parent ORDER BY id,g.i) rn FROM weighted w CROSS JOIN LATERAL generate_series(1,w.quantity)g(i)
 ),allocated AS (SELECT *,cents+CASE WHEN rn<=round(target*100)-sum(cents)OVER(PARTITION BY parent) THEN 1 ELSE 0 END final_cents FROM units)
 SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'category_id',category_id,'cents',final_cents) ORDER BY parent,id,i) INTO raw FROM allocated;
 IF raw IS NULL OR jsonb_array_length(raw)>5000 THEN RAISE EXCEPTION 'Combo vacío o carrito demasiado grande';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(raw)x LEFT JOIN public.products p ON p.id=(x->>'id')::uuid WHERE p.id IS NULL OR NOT p.is_active OR p.price<=0) THEN RAISE EXCEPTION 'Componente no disponible';END IF;
 SELECT sum((x->>'cents')::numeric)/100 INTO subtotal FROM jsonb_array_elements(raw)x;
 IF coupon_input<>'' THEN RAISE EXCEPTION 'Los cupones se verifican al iniciar el pago con una cuenta confirmada';END IF;
 WITH units AS (SELECT x,ord,CASE WHEN coupon_input<>'' AND (c.category_id IS NULL OR (x->>'category_id')::uuid=c.category_id) THEN true ELSE false END eligible FROM jsonb_array_elements(raw)WITH ORDINALITY v(x,ord)),floors AS (
 SELECT *,CASE WHEN eligible THEN floor((x->>'cents')::numeric*(eligible_total-discount*100)/eligible_total) ELSE (x->>'cents')::numeric END price FROM (SELECT *,sum(CASE WHEN eligible THEN (x->>'cents')::numeric ELSE 0 END)OVER() eligible_total FROM units)t
 ),final AS (
 SELECT x,price+CASE WHEN eligible AND sum(CASE WHEN eligible THEN 1 ELSE 0 END)OVER(ORDER BY ord)<=round(eligible_total-discount*100)-sum(CASE WHEN eligible THEN price ELSE 0 END)OVER() THEN 1 ELSE 0 END cents FROM floors
 ),grouped AS (SELECT (x->>'id')::uuid id,x->>'name' name,cents,count(*) quantity FROM final GROUP BY 1,2,3)
 SELECT jsonb_agg(jsonb_build_object('product_id',g.id,'product_name',g.name,'quantity',g.quantity,'unit_price',g.cents/100,'line_total',g.cents*g.quantity/100) ORDER BY g.id,g.cents) INTO snap FROM grouped g;
 IF jsonb_array_length(snap)>100 THEN RAISE EXCEPTION 'El carrito tiene demasiadas variantes de precio; dividilo en dos compras';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(snap)x WHERE (x->>'unit_price')::numeric<0.01) THEN RAISE EXCEPTION 'El descuento deja unidades sin precio; ajustá el combo o el cupón';END IF;
 RETURN jsonb_build_object('items',snap,'amount',subtotal-discount,'discount',discount,'coupon_code',nullif(coupon_input,''));
END $$;

REVOKE ALL ON FUNCTION public.preview_store_cart(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_store_cart(jsonb) TO anon,authenticated;
CREATE OR REPLACE FUNCTION private.has_confirmed_shop_email() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND NOT coalesce(u.is_anonymous,false))
$$;
REVOKE ALL ON FUNCTION private.has_confirmed_shop_email() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.has_confirmed_shop_email() TO authenticated;
GRANT INSERT,UPDATE ON public.stock_notifications TO authenticated;
CREATE POLICY own_stock_notice_insert ON public.stock_notifications FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND private.has_confirmed_shop_email() AND state='waiting' AND EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.is_active AND p.stock<=0));
CREATE POLICY own_stock_notice_update ON public.stock_notifications FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid()) AND private.has_confirmed_shop_email()) WITH CHECK(user_id=(SELECT auth.uid()) AND state IN ('waiting','cancelled') AND (state='cancelled' OR EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.is_active AND p.stock<=0)));
CREATE OR REPLACE FUNCTION public.manage_stock_notice(pid uuid,cancel boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT private.has_confirmed_shop_email() THEN RAISE EXCEPTION 'Ingresá con una cuenta y email confirmado';END IF;
 IF cancel THEN UPDATE public.stock_notifications SET state='cancelled' WHERE user_id=auth.uid() AND product_id=pid;RETURN true;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=pid AND is_active AND stock<=0) THEN RAISE EXCEPTION 'El artículo no está agotado o ya no está disponible';END IF;
 INSERT INTO public.stock_notifications(user_id,product_id,state) VALUES(auth.uid(),pid,'waiting') ON CONFLICT(user_id,product_id) DO UPDATE SET id=gen_random_uuid(),state='waiting',claimed_at=NULL,sent_at=NULL,created_at=now();
 RETURN true;END $$;
REVOKE ALL ON FUNCTION public.manage_stock_notice(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_stock_notice(uuid,boolean) TO authenticated;

NOTIFY pgrst, 'reload_schema';
