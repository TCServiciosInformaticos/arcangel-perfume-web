-- Transactional inventory reservations and immutable payment-attempt snapshots.
ALTER TABLE public.orders ADD COLUMN checkout_key uuid UNIQUE,
 ADD COLUMN abandon_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
 ADD COLUMN reservation_until timestamptz,
 ADD COLUMN stock_committed_at timestamptz,
 ADD COLUMN needs_review boolean NOT NULL DEFAULT false,
 ADD COLUMN review_reason text,
 ADD COLUMN last_reconciled_at timestamptz,
 ADD COLUMN archived_at timestamptz;
UPDATE public.orders SET abandon_at=created_at+interval '24 hours';
CREATE TABLE public.order_payment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id),
 preference_id text UNIQUE, checkout_url text, payment_id text UNIQUE,
 state text NOT NULL DEFAULT 'preparing' CHECK(state IN ('preparing','ready','approved','rejected','cancelled','expired')),
 total numeric(12,2) NOT NULL, subtotal numeric(12,2) NOT NULL, shipping_cost numeric(12,2) NOT NULL,
 items jsonb NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 last_error text
);
CREATE INDEX order_attempts_order ON public.order_payment_attempts(order_id,created_at DESC);
CREATE TABLE public.order_stock_reservations (
 order_id uuid NOT NULL REFERENCES public.orders(id), product_id uuid NOT NULL REFERENCES public.products(id),
 attempt_id uuid NOT NULL REFERENCES public.order_payment_attempts(id), quantity integer NOT NULL CHECK(quantity>0),
 expires_at timestamptz NOT NULL, PRIMARY KEY(order_id,product_id)
);
CREATE INDEX order_reservations_product ON public.order_stock_reservations(product_id,expires_at);
CREATE TABLE public.order_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.orders(id),
 kind text NOT NULL, detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.order_payment_attempts,public.order_stock_reservations,public.order_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.order_events_id_seq TO service_role;
GRANT SELECT ON public.order_payment_attempts,public.order_stock_reservations,public.order_events TO authenticated;
CREATE POLICY admin_read_attempts ON public.order_payment_attempts FOR SELECT TO authenticated USING(private.has_role(auth.uid(),'admin'));
CREATE POLICY admin_read_reservations ON public.order_stock_reservations FOR SELECT TO authenticated USING(private.has_role(auth.uid(),'admin'));
CREATE POLICY admin_read_order_events ON public.order_events FOR SELECT TO authenticated USING(private.has_role(auth.uid(),'admin'));
-- Import existing MP preferences so delayed notifications remain recognizable.
INSERT INTO public.order_payment_attempts(order_id,preference_id,state,total,subtotal,shipping_cost,items,expires_at)
SELECT o.id,o.mp_preference_id,'expired',o.total,o.subtotal,o.shipping_cost,
 coalesce((SELECT jsonb_agg(jsonb_build_object('product_id',i.product_id,'product_name',i.product_name,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total)) FROM public.order_items i WHERE i.order_id=o.id),'[]'::jsonb),o.created_at+interval '30 minutes'
FROM public.orders o WHERE o.mp_preference_id IS NOT NULL;

CREATE FUNCTION public.expire_order_reservations() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 DELETE FROM order_stock_reservations WHERE expires_at<=now();
 UPDATE order_payment_attempts SET state='expired' WHERE state IN ('preparing','ready') AND expires_at<=now();
 WITH changed AS (UPDATE orders SET status='abandoned' WHERE status IN ('pending_payment','payment_rejected') AND abandon_at<=now() RETURNING id)
 INSERT INTO order_events(order_id,kind) SELECT id,'abandoned' FROM changed;
END $$;

CREATE FUNCTION public.reserve_order_checkout(payload jsonb, existing_id uuid DEFAULT NULL, request_key uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE o orders%ROWTYPE; a order_payment_attempts%ROWTYPE; item jsonb; p products%ROWTYPE; amount numeric:=0; shipping numeric; units integer; snap jsonb:='[]'; until_time timestamptz:=now()+interval '30 minutes';
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 PERFORM expire_order_reservations();
 IF existing_id IS NOT NULL THEN SELECT * INTO o FROM orders WHERE id=existing_id FOR UPDATE;
 ELSIF request_key IS NOT NULL THEN SELECT * INTO o FROM orders WHERE checkout_key=request_key FOR UPDATE; END IF;
 IF existing_id IS NOT NULL AND o.id IS NULL THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
 IF o.id IS NOT NULL THEN
  IF o.status NOT IN ('pending_payment','payment_rejected','abandoned') THEN RAISE EXCEPTION 'Este pedido no admite nuevos pagos'; END IF;
  SELECT * INTO a FROM order_payment_attempts WHERE order_id=o.id AND state IN ('preparing','ready') AND expires_at>now() ORDER BY created_at DESC LIMIT 1;
  IF a.id IS NOT NULL THEN RETURN jsonb_build_object('order',to_jsonb(o),'attempt',to_jsonb(a),'new_attempt',false); END IF;
  payload:=to_jsonb(o)||jsonb_build_object('items',(SELECT jsonb_agg(jsonb_build_object('productId',product_id,'quantity',quantity)) FROM order_items WHERE order_id=o.id));
 END IF;
 IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'items') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Productos inválidos'; END IF;
 IF (SELECT count(DISTINCT value->>'productId') FROM jsonb_array_elements(payload->'items'))<>jsonb_array_length(payload->'items') THEN RAISE EXCEPTION 'Productos repetidos'; END IF;
 -- Lock products in a stable order, including against manual stock edits.
 PERFORM 1 FROM products WHERE id IN (SELECT (value->>'productId')::uuid FROM jsonb_array_elements(payload->'items')) ORDER BY id FOR UPDATE;
 FOR item IN SELECT value FROM jsonb_array_elements(payload->'items') LOOP
  SELECT * INTO p FROM products WHERE id=(item->>'productId')::uuid;
  IF p.id IS NULL OR NOT p.is_active OR p.price<=0 THEN RAISE EXCEPTION 'Producto no disponible'; END IF;
  IF (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
  units:=(item->>'quantity')::integer;
  IF units NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
  IF p.stock-coalesce((SELECT sum(quantity) FROM order_stock_reservations WHERE product_id=p.id AND expires_at>now() AND (o.id IS NULL OR order_id<>o.id)),0)<units THEN RAISE EXCEPTION 'Stock insuficiente para %',p.name; END IF;
  amount:=amount+p.price*units;
  snap:=snap||jsonb_build_array(jsonb_build_object('product_id',p.id,'product_name',p.name,'quantity',units,'unit_price',p.price,'line_total',p.price*units));
 END LOOP;
 SELECT CASE WHEN payload->>'delivery_method'='shipping' THEN shipping_cost ELSE 0 END INTO shipping FROM settings WHERE id=1;
 IF shipping IS NULL THEN RAISE EXCEPTION 'Configuración de entrega no disponible'; END IF;
 IF o.id IS NULL THEN
  INSERT INTO orders(checkout_key,customer_name,customer_email,customer_whatsapp,delivery_method,delivery_street,delivery_number,delivery_apartment,delivery_city,delivery_zip,delivery_day,delivery_time_slot,notes,pickup_branch,subtotal,shipping_cost,total)
  VALUES(request_key,payload->>'customer_name',payload->>'customer_email',payload->>'customer_whatsapp',(payload->>'delivery_method')::delivery_method,payload->>'delivery_street',payload->>'delivery_number',payload->>'delivery_apartment',payload->>'delivery_city',payload->>'delivery_zip',payload->>'delivery_day',(payload->>'delivery_time_slot')::time_slot,payload->>'notes',payload->>'pickup_branch',amount,shipping,amount+shipping) RETURNING * INTO o;
 END IF;
 INSERT INTO order_payment_attempts(order_id,total,subtotal,shipping_cost,items,expires_at) VALUES(o.id,amount+shipping,amount,shipping,snap,until_time) RETURNING * INTO a;
 DELETE FROM order_stock_reservations WHERE order_id=o.id;
 INSERT INTO order_stock_reservations(order_id,product_id,attempt_id,quantity,expires_at) SELECT o.id,(x->>'product_id')::uuid,a.id,(x->>'quantity')::integer,until_time FROM jsonb_array_elements(snap) x;
 DELETE FROM order_items WHERE order_id=o.id;
 INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,line_total) SELECT o.id,(x->>'product_id')::uuid,x->>'product_name',(x->>'quantity')::integer,(x->>'unit_price')::numeric,(x->>'line_total')::numeric FROM jsonb_array_elements(snap) x;
 UPDATE orders SET status='pending_payment',subtotal=amount,shipping_cost=shipping,total=amount+shipping,reservation_until=until_time,abandon_at=now()+interval '24 hours',archived_at=NULL WHERE id=o.id RETURNING * INTO o;
 INSERT INTO order_events(order_id,kind,detail) VALUES(o.id,'checkout_reserved',jsonb_build_object('attempt_id',a.id,'total',a.total,'expires_at',until_time));
 RETURN jsonb_build_object('order',to_jsonb(o),'attempt',to_jsonb(a),'new_attempt',true);
END $$;

CREATE FUNCTION public.attach_order_preference(attempt_id uuid, preference text, checkout text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a order_payment_attempts%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT * INTO a FROM order_payment_attempts WHERE id=attempt_id FOR UPDATE;
 IF a.id IS NULL OR a.state<>'preparing' OR a.expires_at<=now() THEN RAISE EXCEPTION 'El intento de pago venció; volvé a intentarlo'; END IF;
 UPDATE order_payment_attempts SET preference_id=preference,checkout_url=checkout,state='ready' WHERE id=a.id;
 UPDATE orders SET mp_preference_id=preference WHERE id=a.order_id;
END $$;
CREATE FUNCTION public.fail_order_attempt(attempt_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE oid uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 UPDATE order_payment_attempts SET state='cancelled',last_error='No se pudo iniciar Mercado Pago' WHERE id=attempt_id AND state='preparing' RETURNING order_id INTO oid;
 DELETE FROM order_stock_reservations WHERE order_id=oid AND order_stock_reservations.attempt_id=fail_order_attempt.attempt_id;
END $$;

CREATE FUNCTION public.apply_verified_order_payment(attempt_id uuid, payment text, provider_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
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
  FOR x IN SELECT value FROM jsonb_array_elements(a.items) LOOP
   IF NOT EXISTS(SELECT 1 FROM products p WHERE p.id=(x->>'product_id')::uuid AND p.stock-coalesce((SELECT sum(r.quantity) FROM order_stock_reservations r WHERE r.product_id=p.id AND r.order_id<>o.id AND r.expires_at>now()),0)>=(x->>'quantity')::integer) THEN insufficient:=true; END IF;
  END LOOP;
  IF NOT insufficient AND o.stock_committed_at IS NULL THEN
   UPDATE products p SET stock=p.stock-(j->>'quantity')::integer FROM jsonb_array_elements(a.items) j WHERE p.id=(j->>'product_id')::uuid;
  END IF;
  DELETE FROM order_stock_reservations WHERE order_id=o.id;
  -- Fulfil the exact presentation and price that was paid, even after a later retry.
  DELETE FROM order_items WHERE order_id=o.id;
  INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,line_total) SELECT o.id,p.id,j->>'product_name',(j->>'quantity')::integer,(j->>'unit_price')::numeric,(j->>'line_total')::numeric FROM jsonb_array_elements(a.items) j LEFT JOIN products p ON p.id=(j->>'product_id')::uuid;
  UPDATE orders SET status='paid',mp_payment_id=payment,mp_preference_id=a.preference_id,total=a.total,subtotal=a.subtotal,shipping_cost=a.shipping_cost,
   stock_committed_at=CASE WHEN NOT insufficient THEN coalesce(o.stock_committed_at,now()) ELSE o.stock_committed_at END,
   needs_review=insufficient OR o.status='cancelled',review_reason=CASE WHEN insufficient THEN 'Pago aprobado sin stock disponible: resolver entrega o devolución' WHEN o.status='cancelled' THEN 'Pago aprobado después de cancelación manual' ELSE NULL END,
   reservation_until=NULL,archived_at=NULL WHERE id=o.id;
  INSERT INTO order_events(order_id,kind,detail) VALUES(o.id,'payment_approved',jsonb_build_object('payment_id',payment,'attempt_id',a.id,'stock_issue',insufficient));
 ELSIF a.state<>'approved' AND o.status NOT IN ('paid','preparing','shipped','delivered') THEN
  UPDATE order_payment_attempts SET state=CASE WHEN provider_status='rejected' THEN 'rejected' WHEN provider_status='cancelled' THEN 'cancelled' ELSE state END WHERE id=a.id;
  IF provider_status IN ('rejected','cancelled') THEN
   DELETE FROM order_stock_reservations WHERE order_stock_reservations.attempt_id=a.id;
   UPDATE orders SET status=CASE WHEN abandon_at<=now() THEN 'abandoned'::order_status ELSE 'payment_rejected'::order_status END WHERE id=o.id AND status<>'cancelled' AND mp_preference_id=a.preference_id;
   INSERT INTO order_events(order_id,kind,detail) VALUES(o.id,'payment_rejected',jsonb_build_object('payment_id',payment,'status',provider_status,'attempt_id',a.id));
  END IF;
 END IF;
END $$;
CREATE FUNCTION public.admin_order_action(oid uuid, action text, note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s order_status; x record;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT status INTO s FROM orders WHERE id=oid FOR UPDATE;
 IF s IS NULL THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
 IF action='archive' THEN
  IF s NOT IN ('abandoned','cancelled','payment_rejected','delivered') THEN RAISE EXCEPTION 'Este pedido todavía está en curso'; END IF;
  UPDATE orders SET archived_at=now() WHERE id=oid;
 ELSIF action='unarchive' THEN UPDATE orders SET archived_at=NULL WHERE id=oid;
 ELSIF action='cancel' THEN
  IF s NOT IN ('pending_payment','abandoned','payment_rejected') THEN RAISE EXCEPTION 'Un pedido pagado requiere revisar el cobro antes de cancelar'; END IF;
  UPDATE orders SET status='cancelled' WHERE id=oid;
  DELETE FROM order_stock_reservations WHERE order_id=oid;
 ELSIF action='resolve_stock' AND s='paid' THEN
  IF EXISTS(SELECT 1 FROM orders WHERE id=oid AND stock_committed_at IS NOT NULL) THEN RAISE EXCEPTION 'El stock ya fue descontado'; END IF;
  PERFORM 1 FROM products WHERE id IN(SELECT product_id FROM order_items WHERE order_id=oid) ORDER BY id FOR UPDATE;
  FOR x IN SELECT * FROM order_items WHERE order_id=oid LOOP
   IF NOT EXISTS(SELECT 1 FROM products p WHERE p.id=x.product_id AND p.stock-coalesce((SELECT sum(r.quantity) FROM order_stock_reservations r WHERE r.product_id=p.id AND r.order_id<>oid AND r.expires_at>now()),0)>=x.quantity) THEN RAISE EXCEPTION 'Stock insuficiente para resolver el pedido'; END IF;
  END LOOP;
  UPDATE products p SET stock=p.stock-i.quantity FROM order_items i WHERE i.order_id=oid AND p.id=i.product_id;
  UPDATE orders SET stock_committed_at=now(),needs_review=false,review_reason=NULL WHERE id=oid;
 ELSIF action='resolve_review' AND s='paid' THEN
  IF note IS NULL OR length(btrim(note))<5 OR length(note)>1000 THEN RAISE EXCEPTION 'Registrá cómo se resolvió el caso'; END IF;
  IF EXISTS(SELECT 1 FROM orders WHERE id=oid AND stock_committed_at IS NULL) THEN RAISE EXCEPTION 'Primero resolvé el stock del pedido'; END IF;
  UPDATE orders SET needs_review=false,review_reason=NULL WHERE id=oid;
 ELSIF (action='preparing'  AND s='paid') OR (action='shipped' AND s='preparing') OR (action='delivered' AND s IN ('preparing','shipped')) THEN
  IF EXISTS(SELECT 1 FROM orders WHERE id=oid AND needs_review) THEN RAISE EXCEPTION 'Resolvé la revisión del pago y del stock antes de preparar'; END IF;
  UPDATE orders SET status=action::order_status WHERE id=oid;
 ELSE RAISE EXCEPTION 'Cambio de estado no permitido'; END IF;
 INSERT INTO order_events(order_id,kind,detail) VALUES(oid,'admin_'||action,jsonb_build_object('note',note));
END $$;
-- Admin writes are confined to validated actions, not arbitrary order status updates.
REVOKE UPDATE ON public.orders FROM authenticated;
GRANT INSERT ON public.order_events TO authenticated;
GRANT USAGE ON SEQUENCE public.order_events_id_seq TO authenticated;
CREATE POLICY admin_write_order_events ON public.order_events FOR INSERT TO authenticated WITH CHECK(private.has_role(auth.uid(),'admin'));
GRANT DELETE ON public.order_stock_reservations TO authenticated;
CREATE POLICY admin_release_reservations ON public.order_stock_reservations FOR DELETE TO authenticated USING(private.has_role(auth.uid(),'admin'));
-- admin_order_action remains invoker: grants only the columns it updates.
GRANT UPDATE(status,archived_at,stock_committed_at,needs_review,review_reason) ON public.orders TO authenticated;
REVOKE ALL ON FUNCTION public.admin_order_action(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_order_action(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.expire_order_reservations(),public.reserve_order_checkout(jsonb,uuid,uuid),public.attach_order_preference(uuid,text,text),public.fail_order_attempt(uuid),public.apply_verified_order_payment(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_order_reservations(),public.reserve_order_checkout(jsonb,uuid,uuid),public.attach_order_preference(uuid,text,text),public.fail_order_attempt(uuid),public.apply_verified_order_payment(uuid,text,text) TO service_role;

-- Scheduled jobs use a dedicated credential held only in the private database schema.
CREATE TABLE private.order_job_config(id boolean PRIMARY KEY DEFAULT true CHECK(id), endpoint text NOT NULL, token text NOT NULL);
REVOKE ALL ON private.order_job_config FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.order_job_config TO service_role;
INSERT INTO private.order_job_config(endpoint,token) VALUES('https://arcangel-perfume-web.vercel.app/api/public/order-maintenance',replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
CREATE FUNCTION public.authorize_order_job(provided_token text) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=public AS $auth$
 SELECT EXISTS(SELECT 1 FROM private.order_job_config WHERE token=provided_token);
$auth$;
REVOKE ALL ON FUNCTION public.authorize_order_job(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_order_job(text) TO service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
SELECT cron.schedule('arcangel-order-expiry','* * * * *','SELECT public.expire_order_reservations()');
SELECT cron.schedule('arcangel-order-reconciliation','*/10 * * * *',$job$SELECT net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=120000) FROM private.order_job_config$job$);
-- Activate after the application deployment is verified, avoiding an older webhook
-- processing orders with the new inventory protocol during a partial rollout.
SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname IN ('arcangel-order-expiry','arcangel-order-reconciliation');
NOTIFY pgrst,'reload schema';
