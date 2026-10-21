-- Feature remains off until the deployed worker and verified sender are tested.
CREATE TABLE private.order_recovery_config(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false);
REVOKE ALL ON private.order_recovery_config FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.order_recovery_config TO service_role;
INSERT INTO private.order_recovery_config(id,enabled) VALUES(true,false);
-- A final abandonment deadline exists only after the reminder is accepted.
ALTER TABLE public.orders ADD COLUMN recovery_due_at timestamptz NOT NULL DEFAULT (now()+interval '1 hour'),
 ADD COLUMN recovery_sent_at timestamptz;
CREATE TABLE public.order_recovery_emails (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','failed','review','cancelled')),
 payload jsonb,lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,first_send_at timestamptz,sent_at timestamptz,provider_email_id text UNIQUE,
 last_error text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_recovery_email_queue ON public.order_recovery_emails(next_attempt_at) WHERE state IN ('queued','sending');
ALTER TABLE public.order_recovery_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_recovery_emails FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.order_recovery_emails TO service_role;
-- Payload contains a guest order capability: never expose it through admin SELECT *.
GRANT SELECT(id,order_id,state,next_attempt_at,attempts,first_send_at,sent_at,provider_email_id,last_error,created_at) ON public.order_recovery_emails TO authenticated;
CREATE POLICY admins_read_recovery_emails ON public.order_recovery_emails FOR SELECT TO authenticated USING(private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.expire_order_reservations() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 DELETE FROM order_stock_reservations WHERE expires_at<=now();
 UPDATE order_payment_attempts SET state='expired' WHERE state IN ('preparing','ready') AND expires_at<=now();
 UPDATE order_recovery_emails e SET state='cancelled',lease_token=CASE WHEN first_send_at IS NULL THEN NULL ELSE lease_token END,lease_until=CASE WHEN first_send_at IS NULL THEN NULL ELSE lease_until END
 FROM orders o WHERE o.id=e.order_id AND o.status IN ('paid','preparing','shipped','delivered','cancelled','abandoned_final') AND e.state IN ('queued','sending');
 WITH final AS (
  UPDATE orders SET status='abandoned_final' WHERE recovery_sent_at IS NOT NULL AND abandon_at<=now()
  AND status IN ('pending_payment','payment_rejected','abandoned','recovery_pending','recovery_notified') RETURNING id
 ) INSERT INTO order_events(order_id,kind) SELECT id,'abandoned_final' FROM final;
 IF NOT (SELECT enabled FROM private.order_recovery_config WHERE id) THEN
  WITH legacy AS(UPDATE orders SET status='abandoned' WHERE recovery_sent_at IS NULL AND status IN ('pending_payment','payment_rejected') AND abandon_at<=now() RETURNING id)
  INSERT INTO order_events(order_id,kind) SELECT id,'abandoned' FROM legacy;
  RETURN;
 END IF;
 WITH due AS (
  UPDATE orders o SET status='recovery_pending' WHERE recovery_sent_at IS NULL AND recovery_due_at<=now()
  AND archived_at IS NULL AND status IN ('pending_payment','payment_rejected','abandoned')
  AND NOT EXISTS(SELECT 1 FROM order_stock_reservations r WHERE r.order_id=o.id AND r.expires_at>now()) RETURNING id
 ) INSERT INTO order_events(order_id,kind) SELECT id,'recovery_email_queued' FROM due;
 INSERT INTO order_recovery_emails(order_id)
 SELECT id FROM orders WHERE status='recovery_pending' AND recovery_sent_at IS NULL AND archived_at IS NULL
 ON CONFLICT(order_id) DO NOTHING;
 -- A provider idempotency key is retained for 24 hours. Never blindly retry an
 -- ambiguous send outside that window: hold for operator investigation instead.
 UPDATE order_recovery_emails SET state='review',last_error='Envío sin confirmar: revisar en el proveedor antes de reintentar',lease_token=NULL,lease_until=NULL
 WHERE state IN ('queued','sending') AND first_send_at<now()-interval '23 hours';
END $$;

CREATE FUNCTION public.claim_order_recovery_email() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e order_recovery_emails%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 PERFORM expire_order_reservations();
 IF NOT(SELECT enabled FROM private.order_recovery_config WHERE id) THEN RETURN NULL; END IF;
 SELECT q.* INTO e FROM order_recovery_emails q JOIN orders o ON o.id=q.order_id
 WHERE ((q.state='queued' AND q.next_attempt_at<=now()) OR(q.state='sending' AND q.lease_until<=now()))
 AND o.status IN ('pending_payment','payment_rejected','abandoned','recovery_pending','recovery_notified')
 AND o.recovery_sent_at IS NULL AND o.recovery_due_at<=now() AND o.archived_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM order_stock_reservations r WHERE r.order_id=o.id AND r.expires_at>now())
 ORDER BY q.next_attempt_at,q.id LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
 IF e.id IS NULL THEN RETURN NULL; END IF;
 UPDATE order_recovery_emails SET state='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' WHERE id=e.id RETURNING * INTO e;
 RETURN jsonb_build_object('id',e.id,'order_id',e.order_id,'lease_token',e.lease_token,'payload',e.payload);
END $$;
CREATE FUNCTION public.prepare_order_recovery_email(eid uuid,lease uuid,body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e order_recovery_emails%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT * INTO e FROM order_recovery_emails WHERE id=eid AND state='sending' AND lease_token=lease AND lease_until>now() FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'La reserva del envío venció'; END IF;
 IF jsonb_typeof(body) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Email inválido'; END IF;
 UPDATE order_recovery_emails SET payload=coalesce(payload,body) WHERE id=eid RETURNING payload INTO body;
 RETURN body;
END $$;
CREATE FUNCTION public.authorize_order_recovery_send(eid uuid,lease uuid) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e order_recovery_emails%ROWTYPE; o orders%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT * INTO e FROM order_recovery_emails WHERE id=eid AND state='sending' AND lease_token=lease AND lease_until>now() FOR UPDATE;
 IF e.id IS NULL OR e.payload IS NULL THEN RETURN false; END IF;
 IF NOT(SELECT enabled FROM private.order_recovery_config WHERE id) THEN
  UPDATE order_recovery_emails SET state='queued',next_attempt_at=now()+interval '10 minutes',lease_token=NULL,lease_until=NULL WHERE id=e.id;RETURN false;
 END IF;
 SELECT * INTO o FROM orders WHERE id=e.order_id FOR UPDATE;
 IF o.status NOT IN ('pending_payment','payment_rejected','abandoned','recovery_pending','recovery_notified') OR o.recovery_sent_at IS NOT NULL OR o.archived_at IS NOT NULL THEN
  UPDATE order_recovery_emails SET state='cancelled',lease_token=NULL,lease_until=NULL WHERE id=e.id;RETURN false;
 END IF;
 IF o.recovery_due_at>now() OR EXISTS(SELECT 1 FROM order_stock_reservations WHERE order_id=o.id AND expires_at>now()) THEN
  UPDATE order_recovery_emails SET state='queued',next_attempt_at=greatest(o.recovery_due_at,now()+interval '10 minutes'),lease_token=NULL,lease_until=NULL WHERE id=e.id;RETURN false;
 END IF;
 IF e.first_send_at<now()-interval '23 hours' THEN
  UPDATE order_recovery_emails SET state='review',last_error='Envío sin confirmar: revisar en el proveedor',lease_token=NULL,lease_until=NULL WHERE id=e.id;RETURN false;
 END IF;
 UPDATE order_recovery_emails SET first_send_at=coalesce(first_send_at,now()),attempts=attempts+1 WHERE id=e.id;
 RETURN true;
END $$;
CREATE FUNCTION public.finish_order_recovery_email(eid uuid,lease uuid,provider_id text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e order_recovery_emails%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT * INTO e FROM order_recovery_emails WHERE id=eid FOR UPDATE;
 IF e.state='sent' AND e.provider_email_id=provider_id THEN RETURN; END IF;
 IF e.lease_token IS DISTINCT FROM lease OR e.first_send_at IS NULL OR provider_id IS NULL OR length(provider_id)=0 THEN RAISE EXCEPTION 'Confirmación de email inválida'; END IF;
 UPDATE order_recovery_emails SET state='sent',provider_email_id=provider_id,sent_at=now(),last_error=NULL,lease_token=NULL,lease_until=NULL WHERE id=eid;
 UPDATE orders SET recovery_sent_at=now(),abandon_at=now()+interval '24 hours',
 status=CASE WHEN status IN ('pending_payment','payment_rejected','abandoned','recovery_pending','recovery_notified') THEN 'recovery_notified'::order_status ELSE status END
 WHERE id=e.order_id;
 INSERT INTO order_events(order_id,kind,detail) VALUES(e.order_id,'recovery_email_sent',jsonb_build_object('provider_email_id',provider_id,'final_after_hours',24));
END $$;
CREATE FUNCTION public.fail_order_recovery_email(eid uuid,lease uuid,error_code text,permanent boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 UPDATE order_recovery_emails SET state=CASE WHEN permanent THEN 'failed' ELSE 'queued' END,
 next_attempt_at=now()+interval '10 minutes',last_error=left(error_code,200),lease_token=NULL,lease_until=NULL
 WHERE id=eid AND state='sending' AND lease_token=lease;
END $$;
REVOKE ALL ON FUNCTION public.claim_order_recovery_email(),public.prepare_order_recovery_email(uuid,uuid,jsonb),public.authorize_order_recovery_send(uuid,uuid),public.finish_order_recovery_email(uuid,uuid,text),public.fail_order_recovery_email(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_recovery_email(),public.prepare_order_recovery_email(uuid,uuid,jsonb),public.authorize_order_recovery_send(uuid,uuid),public.finish_order_recovery_email(uuid,uuid,text),public.fail_order_recovery_email(uuid,uuid,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_order_checkout(payload jsonb, existing_id uuid DEFAULT NULL, request_key uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE o orders%ROWTYPE; a order_payment_attempts%ROWTYPE; item jsonb; p products%ROWTYPE; amount numeric:=0; shipping numeric; units integer; snap jsonb:='[]'; until_time timestamptz:=now()+interval '30 minutes';
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
 UPDATE orders SET status='pending_payment',subtotal=amount,shipping_cost=shipping,total=amount+shipping,reservation_until=until_time,abandon_at=CASE WHEN recovery_sent_at IS NULL THEN now()+interval '24 hours' ELSE recovery_sent_at+interval '24 hours' END,recovery_due_at=CASE WHEN recovery_sent_at IS NULL THEN now()+interval '1 hour' ELSE recovery_due_at END,archived_at=NULL WHERE id=o.id RETURNING * INTO o;
 INSERT INTO order_events(order_id,kind,detail) VALUES(o.id,'checkout_reserved',jsonb_build_object('attempt_id',a.id,'total',a.total,'expires_at',until_time));
 RETURN jsonb_build_object('order',to_jsonb(o),'attempt',to_jsonb(a),'new_attempt',true);
END $$;


CREATE OR REPLACE FUNCTION public.admin_order_action(oid uuid, action text, note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s order_status; x record;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT status INTO s FROM orders WHERE id=oid FOR UPDATE;
 IF s IS NULL THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
 IF action='archive' THEN
  IF s NOT IN ('abandoned','abandoned_final','cancelled','payment_rejected','delivered') THEN RAISE EXCEPTION 'Este pedido todavía está en curso'; END IF;
  UPDATE orders SET archived_at=now() WHERE id=oid;
 ELSIF action='unarchive' THEN UPDATE orders SET archived_at=NULL WHERE id=oid;
 ELSIF action='cancel' THEN
  IF s NOT IN ('pending_payment','abandoned','payment_rejected','recovery_pending','recovery_notified') THEN RAISE EXCEPTION 'Un pedido pagado requiere revisar el cobro antes de cancelar'; END IF;
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

CREATE OR REPLACE FUNCTION public.apply_verified_order_payment(attempt_id uuid, payment text, provider_status text)
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
   UPDATE orders SET status=CASE WHEN abandon_at<=now() THEN 'abandoned'::order_status ELSE 'payment_rejected'::order_status END WHERE id=o.id AND status NOT IN ('cancelled','abandoned_final') AND mp_preference_id=a.preference_id;
   INSERT INTO order_events(order_id,kind,detail) VALUES(o.id,'payment_rejected',jsonb_build_object('payment_id',payment,'status',provider_status,'attempt_id',a.id));
  END IF;
 END IF;
END $$;

SELECT cron.schedule('arcangel-order-recovery-email','*/5 * * * *',$job$SELECT net.http_post(url:=replace(endpoint,'/order-maintenance','/order-recovery-emails'),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=120000) FROM private.order_job_config$job$);
-- Enable only after verifying the live endpoint, provider and verified sender.
SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='arcangel-order-recovery-email';
NOTIFY pgrst,'reload schema';

CREATE FUNCTION public.get_order_recovery_enabled() RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$SELECT enabled FROM private.order_recovery_config WHERE id$$;
REVOKE ALL ON FUNCTION public.get_order_recovery_enabled() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_recovery_enabled() TO service_role;
