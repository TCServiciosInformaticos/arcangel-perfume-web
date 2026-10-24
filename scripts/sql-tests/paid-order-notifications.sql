-- Run as postgres in a single transaction. Synthetic fixtures are rolled back;
-- explicit order_number avoids consuming the production order sequence.
BEGIN;
SET LOCAL statement_timeout='15s';
DO $$
DECLARE oid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); job jsonb; n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(872344001);
 INSERT INTO public.orders(id,order_number,customer_name,customer_email,customer_whatsapp,delivery_method,pickup_branch,subtotal,shipping_cost,total)
 VALUES(oid,-987654321,'Prueba transaccional','test@example.invalid','0000000000','pickup','peron',200,0,200);
 INSERT INTO public.order_payment_attempts(id,order_id,state,payment_id,total,subtotal,shipping_cost,items,expires_at)
 VALUES(aid,oid,'ready','test-only',200,200,0,'[{"product_name":"Producto de prueba","quantity":2,"unit_price":100,"line_total":200}]',now()+interval '1 hour');
 INSERT INTO public.order_events(order_id,kind) VALUES(oid,'payment_approved');
 IF EXISTS(SELECT 1 FROM public.paid_order_emails WHERE order_id=oid) THEN RAISE EXCEPTION 'An unpaid order queued mail'; END IF;
 UPDATE public.order_payment_attempts SET state='approved' WHERE id=aid;
 UPDATE public.orders SET status='paid',mp_payment_id='test-only' WHERE id=oid;
 INSERT INTO public.order_events(order_id,kind) VALUES(oid,'payment_approved'),(oid,'payment_approved');
 SELECT count(*) INTO n FROM public.paid_order_emails WHERE order_id=oid;
 IF n<>2 OR EXISTS(SELECT 1 FROM public.paid_order_emails WHERE order_id=oid AND recipient='bogado') THEN RAISE EXCEPTION 'Wrong pickup routing or duplicate'; END IF;
 UPDATE public.orders SET needs_review=true WHERE id=oid;
 job:=public.claim_paid_order_email(oid);
 IF job->>'recipient'<>'ventas' THEN RAISE EXCEPTION 'Branch preparation not held for review'; END IF;
 PERFORM public.prepare_paid_order_email((job->>'id')::uuid,(job->>'lease_token')::uuid,'{"from":"test@example.invalid","to":["sales@example.invalid"],"text":"frozen","html":"frozen","subject":"test"}');
 IF NOT public.authorize_paid_order_send((job->>'id')::uuid,(job->>'lease_token')::uuid) THEN RAISE EXCEPTION 'Verified paid order cannot send'; END IF;
 PERFORM public.finish_paid_order_email((job->>'id')::uuid,(job->>'lease_token')::uuid,'test-provider-id');
 PERFORM public.finish_paid_order_email((job->>'id')::uuid,(job->>'lease_token')::uuid,'test-provider-id');
 IF public.claim_paid_order_email(oid) IS NOT NULL THEN RAISE EXCEPTION 'Held branch was claimed'; END IF;
 UPDATE public.orders SET needs_review=false WHERE id=oid;
 job:=public.claim_paid_order_email(oid);
 IF job->>'recipient'<>'peron' THEN RAISE EXCEPTION 'Missing branch recipient'; END IF;
 PERFORM public.prepare_paid_order_email((job->>'id')::uuid,(job->>'lease_token')::uuid,'{"test":"unchanged"}');
 IF NOT public.authorize_paid_order_send((job->>'id')::uuid,(job->>'lease_token')::uuid) THEN RAISE EXCEPTION 'Branch not released'; END IF;
 PERFORM public.fail_paid_order_email((job->>'id')::uuid,(job->>'lease_token')::uuid,false);
 UPDATE public.paid_order_emails SET first_send_at=now()-interval '24 hours',next_attempt_at=now() WHERE id=(job->>'id')::uuid;
 IF public.claim_paid_order_email(oid) IS NOT NULL THEN RAISE EXCEPTION 'Ambiguous send retried after dedupe expiry'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.paid_order_emails WHERE id=(job->>'id')::uuid AND state='review') THEN RAISE EXCEPTION 'Ambiguous send not held'; END IF;
 -- Shipping routes to sales only, even if a stale branch was supplied.
 UPDATE public.orders SET delivery_method='shipping' WHERE id=oid;
 DELETE FROM public.paid_order_emails WHERE order_id=oid;
 INSERT INTO public.order_events(order_id,kind) VALUES(oid,'payment_approved');
 SELECT count(*) INTO n FROM public.paid_order_emails WHERE order_id=oid;
 IF n<>1 OR NOT EXISTS(SELECT 1 FROM public.paid_order_emails WHERE order_id=oid AND recipient='ventas') THEN RAISE EXCEPTION 'Shipping routed to a branch'; END IF;
 -- A status label without a matching approved attempt is never sufficient.
 UPDATE public.order_payment_attempts SET state='ready' WHERE id=aid;
 job:=public.claim_paid_order_email(oid);
 IF job IS NOT NULL THEN RAISE EXCEPTION 'Unverified payment claimed'; END IF;
END $$;
SELECT 'paid-order routing, review holds, duplicate approvals, leases, acknowledgment and dedupe-window checks passed' AS result;
ROLLBACK;
