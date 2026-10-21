-- Wrap in BEGIN / ROLLBACK. Does not send emails or contact any provider.
DO $test$
DECLARE oid uuid:=gen_random_uuid(); paid uuid:=gen_random_uuid(); j jsonb; eid uuid; lease uuid; deadline timestamptz; before_time timestamptz:=now();
BEGIN
 UPDATE private.order_recovery_config SET enabled=true;
 INSERT INTO orders(id,customer_name,customer_email,customer_whatsapp,delivery_method,subtotal,total,recovery_due_at,abandon_at)
 VALUES(oid,'Prueba email','test@example.invalid','1111111111','pickup',100,100,now()-interval '2 hours',now()-interval '2 days');
 PERFORM expire_order_reservations();
 IF (SELECT status FROM orders WHERE id=oid)<>'recovery_pending' THEN RAISE EXCEPTION 'Unsent order finalized too early'; END IF;
 j:=claim_order_recovery_email();
 -- Other test/customer records may already be queued: isolate the test queue.
 IF j->>'order_id'<>oid::text THEN RAISE EXCEPTION 'Queue isolation required for this test'; END IF;
 eid:=(j->>'id')::uuid;lease:=(j->>'lease_token')::uuid;
 IF claim_order_recovery_email() IS NOT NULL THEN RAISE EXCEPTION 'Lease allowed concurrent claim'; END IF;
 PERFORM prepare_order_recovery_email(eid,lease,'{"to":["test@example.invalid"],"subject":"Test","text":"Immutable","html":"Test","from":"store@example.invalid"}');
 IF (prepare_order_recovery_email(eid,lease,'{"text":"Changed"}')->>'text')<>'Immutable' THEN RAISE EXCEPTION 'Payload changed between retries'; END IF;
 IF NOT authorize_order_recovery_send(eid,lease) THEN RAISE EXCEPTION 'Unpaid order not eligible'; END IF;
 PERFORM fail_order_recovery_email(eid,lease,'Temporary failure',false);
 PERFORM expire_order_reservations();
 IF (SELECT recovery_sent_at FROM orders WHERE id=oid) IS NOT NULL OR (SELECT status FROM orders WHERE id=oid)='abandoned_final' THEN RAISE EXCEPTION 'Failed send started final deadline'; END IF;
 UPDATE order_recovery_emails SET next_attempt_at=now()-interval '1 second' WHERE id=eid;
 j:=claim_order_recovery_email();lease:=(j->>'lease_token')::uuid;
 IF (j->'payload'->>'text')<>'Immutable' THEN RAISE EXCEPTION 'Retry lost original payload'; END IF;
 IF NOT authorize_order_recovery_send(eid,lease) THEN RAISE EXCEPTION 'Retry rejected'; END IF;
 PERFORM finish_order_recovery_email(eid,lease,'provider-test-'||eid);
 SELECT abandon_at INTO deadline FROM orders WHERE id=oid;
 IF (SELECT status FROM orders WHERE id=oid)<>'recovery_notified' OR deadline<>(SELECT recovery_sent_at+interval '24 hours' FROM orders WHERE id=oid) THEN RAISE EXCEPTION 'Final deadline not 24 hours after send'; END IF;
 PERFORM finish_order_recovery_email(eid,lease,'provider-test-'||eid);
 IF (SELECT abandon_at FROM orders WHERE id=oid)<>deadline THEN RAISE EXCEPTION 'Repeated ack moved deadline'; END IF;
 UPDATE orders SET abandon_at=now()+interval '1 second' WHERE id=oid;
 PERFORM expire_order_reservations();
 IF (SELECT status FROM orders WHERE id=oid)<>'recovery_notified' THEN RAISE EXCEPTION 'Finalized before deadline'; END IF;
 UPDATE orders SET abandon_at=now()-interval '1 second' WHERE id=oid;
 PERFORM expire_order_reservations();
 IF (SELECT status FROM orders WHERE id=oid)<>'abandoned_final' THEN RAISE EXCEPTION 'Final abandonment failed'; END IF;
 IF claim_order_recovery_email() IS NOT NULL THEN RAISE EXCEPTION 'Sent reminder queued twice'; END IF;
 INSERT INTO orders(id,customer_name,customer_email,customer_whatsapp,delivery_method,subtotal,total,recovery_due_at)
 VALUES(paid,'Prueba pagado','test@example.invalid','1111111111','pickup',100,100,now()-interval '2 hours');
 PERFORM expire_order_reservations();j:=claim_order_recovery_email();eid:=(j->>'id')::uuid;lease:=(j->>'lease_token')::uuid;
 PERFORM prepare_order_recovery_email(eid,lease,'{"text":"No send"}');
 UPDATE orders SET status='paid',mp_payment_id='test-paid' WHERE id=paid;
 IF authorize_order_recovery_send(eid,lease) THEN RAISE EXCEPTION 'Paid order received reminder'; END IF;
 UPDATE orders SET abandon_at=now()-interval '2 days',recovery_sent_at=now()-interval '3 days' WHERE id=paid;
 PERFORM expire_order_reservations();
 IF (SELECT status FROM orders WHERE id=paid)<>'paid' THEN RAISE EXCEPTION 'Paid order finalized as abandoned'; END IF;
 -- An ambiguous send beyond provider deduplication retention must be held.
 UPDATE orders SET status='recovery_pending',recovery_sent_at=NULL WHERE id=paid;
 UPDATE order_recovery_emails SET state='queued',first_send_at=now()-interval '24 hours',next_attempt_at=now()-interval '1 second' WHERE order_id=paid;
 PERFORM expire_order_reservations();
 IF (SELECT state FROM order_recovery_emails WHERE order_id=paid)<>'review' THEN RAISE EXCEPTION 'Ambiguous send retried outside deduplication window'; END IF;
END $test$;
