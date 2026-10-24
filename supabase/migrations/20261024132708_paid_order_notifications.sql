-- New verified approvals only; never backfill historical orders or trust a browser status.
CREATE TABLE public.paid_order_emails (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id),
 attempt_id uuid NOT NULL REFERENCES public.order_payment_attempts(id),
 recipient text NOT NULL CHECK(recipient IN ('ventas','bogado','peron')),
 snapshot jsonb NOT NULL, payload jsonb,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','failed','review','cancelled')),
 lease_token uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0, first_send_at timestamptz, sent_at timestamptz,
 provider_email_id text UNIQUE, last_error text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,recipient)
);
CREATE INDEX paid_order_email_queue ON public.paid_order_emails(next_attempt_at) WHERE state IN ('queued','sending');
CREATE INDEX paid_order_email_attempt ON public.paid_order_emails(attempt_id);
ALTER TABLE public.paid_order_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paid_order_emails FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.paid_order_emails TO service_role;
-- Snapshot/payload contain contact data; no browser read policy or grants.
CREATE FUNCTION private.queue_paid_order_emails() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE; a public.order_payment_attempts%ROWTYPE; snap jsonb;
BEGIN
 IF NEW.kind<>'payment_approved' THEN RETURN NEW; END IF;
 SELECT * INTO o FROM public.orders WHERE id=NEW.order_id;
 SELECT * INTO a FROM public.order_payment_attempts WHERE order_id=o.id AND payment_id=o.mp_payment_id AND state='approved' ORDER BY created_at,id LIMIT 1;
 IF a.id IS NULL OR o.status NOT IN ('paid','preparing','shipped','delivered') THEN RETURN NEW; END IF;
 snap:=jsonb_build_object('order_number',o.order_number,'customer_name',o.customer_name,
 'customer_email',o.customer_email,'customer_whatsapp',o.customer_whatsapp,
 'delivery_method',o.delivery_method,'pickup_branch',o.pickup_branch,'delivery_street',o.delivery_street,
 'delivery_number',o.delivery_number,'delivery_apartment',o.delivery_apartment,'delivery_city',o.delivery_city,
 'delivery_zip',o.delivery_zip,'delivery_day',o.delivery_day,'delivery_time_slot',o.delivery_time_slot,
 'notes',o.notes,'total',a.total,'shipping_cost',a.shipping_cost,
 'items',(SELECT jsonb_agg(jsonb_build_object('product_name',x->>'product_name','quantity',x->'quantity','unit_price',x->'unit_price','line_total',x->'line_total')) FROM jsonb_array_elements(a.items)x));
 INSERT INTO public.paid_order_emails(order_id,attempt_id,recipient,snapshot) VALUES(o.id,a.id,'ventas',snap) ON CONFLICT DO NOTHING;
 IF o.delivery_method='pickup' AND o.pickup_branch IN ('bogado','peron') THEN
  INSERT INTO public.paid_order_emails(order_id,attempt_id,recipient,snapshot) VALUES(o.id,a.id,o.pickup_branch,snap) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.queue_paid_order_emails() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.queue_paid_order_emails() TO service_role;
CREATE TRIGGER queue_paid_order_emails AFTER INSERT ON public.order_events FOR EACH ROW WHEN(NEW.kind='payment_approved') EXECUTE FUNCTION private.queue_paid_order_emails();

CREATE FUNCTION public.claim_paid_order_email(oid uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.paid_order_emails%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 -- Same lock order as payment processing: global inventory lock, then queue rows.
 PERFORM pg_advisory_xact_lock(872344001);
 UPDATE public.paid_order_emails SET state='review',lease_token=NULL,lease_until=NULL,last_error='Envío sin confirmar: revisar en Resend antes de reintentar'
 WHERE state IN ('queued','sending') AND first_send_at<now()-interval '23 hours';
 SELECT q.* INTO e FROM public.paid_order_emails q JOIN public.orders r ON r.id=q.order_id
 JOIN public.order_payment_attempts a ON a.id=q.attempt_id
 WHERE (oid IS NULL OR q.order_id=oid) AND ((q.state='queued' AND q.next_attempt_at<=now()) OR(q.state='sending' AND q.lease_until<=now()))
 AND a.state='approved' AND a.payment_id=r.mp_payment_id AND r.status IN ('paid','preparing','shipped','delivered')
 AND (q.recipient='ventas' OR NOT r.needs_review)
 ORDER BY q.next_attempt_at,q.id LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
 IF e.id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO o FROM public.orders WHERE id=e.order_id;
 UPDATE public.paid_order_emails SET state='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' WHERE id=e.id RETURNING * INTO e;
 RETURN jsonb_build_object('id',e.id,'order_id',e.order_id,'recipient',e.recipient,'lease_token',e.lease_token,'payload',e.payload,
 'snapshot',e.snapshot||jsonb_build_object('needs_review',o.needs_review,'review_reason',o.review_reason));
END $$;
CREATE FUNCTION public.prepare_paid_order_email(eid uuid,lease uuid,body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.paid_order_emails%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT * INTO e FROM public.paid_order_emails WHERE id=eid AND state='sending' AND lease_token=lease AND lease_until>now() FOR UPDATE;
 IF e.id IS NULL OR jsonb_typeof(body) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Envío inválido o vencido'; END IF;
 UPDATE public.paid_order_emails SET payload=coalesce(payload,body) WHERE id=eid RETURNING payload INTO body;
 RETURN body;
END $$;
CREATE FUNCTION public.authorize_paid_order_send(eid uuid,lease uuid) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.paid_order_emails%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT * INTO e FROM public.paid_order_emails WHERE id=eid AND state='sending' AND lease_token=lease AND lease_until>now() FOR UPDATE;
 IF e.id IS NULL OR e.payload IS NULL THEN RETURN false; END IF;
 SELECT * INTO o FROM public.orders WHERE id=e.order_id;
 IF o.status NOT IN ('paid','preparing','shipped','delivered') OR NOT EXISTS(SELECT 1 FROM public.order_payment_attempts a WHERE a.id=e.attempt_id AND a.state='approved' AND a.payment_id=o.mp_payment_id) THEN
  UPDATE public.paid_order_emails SET state='cancelled',lease_token=NULL,lease_until=NULL WHERE id=eid;RETURN false;
 END IF;
 IF e.recipient<>'ventas' AND o.needs_review THEN
  UPDATE public.paid_order_emails SET state='queued',next_attempt_at=now()+interval '10 minutes',lease_token=NULL,lease_until=NULL WHERE id=eid;RETURN false;
 END IF;
 IF e.first_send_at<now()-interval '23 hours' THEN
  UPDATE public.paid_order_emails SET state='review',lease_token=NULL,lease_until=NULL,last_error='Envío ambiguo fuera de ventana segura' WHERE id=eid;RETURN false;
 END IF;
 UPDATE public.paid_order_emails SET first_send_at=coalesce(first_send_at,now()),attempts=attempts+1 WHERE id=eid;
 RETURN true;
END $$;
CREATE FUNCTION public.finish_paid_order_email(eid uuid,lease uuid,provider_id text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.paid_order_emails%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 SELECT * INTO e FROM public.paid_order_emails WHERE id=eid FOR UPDATE;
 IF e.state='sent' AND e.provider_email_id=provider_id THEN RETURN; END IF;
 IF e.id IS NULL OR e.state<>'sending' OR e.lease_token IS DISTINCT FROM lease OR e.first_send_at IS NULL OR coalesce(length(provider_id),0)=0 THEN RAISE EXCEPTION 'Confirmación inválida'; END IF;
 UPDATE public.paid_order_emails SET state='sent',provider_email_id=provider_id,sent_at=now(),last_error=NULL,lease_token=NULL,lease_until=NULL WHERE id=eid;
 INSERT INTO public.order_events(order_id,kind,detail) VALUES(e.order_id,'paid_order_email_sent',jsonb_build_object('recipient',e.recipient,'provider_email_id',provider_id));
END $$;
CREATE FUNCTION public.fail_paid_order_email(eid uuid,lease uuid,permanent boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 UPDATE public.paid_order_emails SET state=CASE WHEN permanent THEN 'failed' ELSE 'queued' END,
 next_attempt_at=now()+interval '10 minutes',last_error=CASE WHEN permanent THEN 'Revisar configuración de correo o datos del pedido' ELSE 'Envío sin confirmar; reintento con la misma clave' END,lease_token=NULL,lease_until=NULL
 WHERE id=eid AND state='sending' AND lease_token=lease;
END $$;
REVOKE ALL ON FUNCTION public.claim_paid_order_email(uuid),public.prepare_paid_order_email(uuid,uuid,jsonb),public.authorize_paid_order_send(uuid,uuid),public.finish_paid_order_email(uuid,uuid,text),public.fail_paid_order_email(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_paid_order_email(uuid),public.prepare_paid_order_email(uuid,uuid,jsonb),public.authorize_paid_order_send(uuid,uuid),public.finish_paid_order_email(uuid,uuid,text),public.fail_paid_order_email(uuid,uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';

-- The destination is fixed; the existing private job token never leaves the DB
-- except as the Authorization header to this application's authenticated worker.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
INSERT INTO private.order_job_config(id,endpoint,token)
VALUES(true,'https://www.perfumeriaelarcangel.com.ar/api/public/order-maintenance',replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''))
ON CONFLICT(id) DO NOTHING;
SELECT cron.schedule('arcangel-paid-order-emails','*/5 * * * *',$job$
SELECT net.http_post(
 url:='https://www.perfumeriaelarcangel.com.ar/api/public/paid-order-emails',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
 body:='{}'::jsonb,timeout_milliseconds:=120000)
FROM private.order_job_config WHERE id;
$job$);
