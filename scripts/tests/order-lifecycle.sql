-- Run inside a transaction, then ROLLBACK: no customer orders are changed.
DO $test$
DECLARE pid uuid:=gen_random_uuid(); p jsonb; r jsonb; r2 jsonb; oid uuid; aid uuid; second_order uuid; second_attempt uuid; late_order uuid; late_attempt uuid; old_price numeric;
BEGIN
 INSERT INTO products(id,name,slug,price,stock) VALUES(pid,'Prueba de reserva temporal','test-reservation-'||pid,100,2);
 p:=jsonb_build_object('customer_name','Prueba técnica','customer_email','test@example.invalid','customer_whatsapp','1111111111','delivery_method','pickup','pickup_branch','bogado','items',jsonb_build_array(jsonb_build_object('productId',pid,'quantity',2)));
 r:=reserve_order_checkout(p,NULL,'22222222-2222-4222-8222-222222222222');oid:=(r->'order'->>'id')::uuid;aid:=(r->'attempt'->>'id')::uuid;
 IF (SELECT stock FROM products WHERE id=pid)<>2 OR (SELECT sum(quantity) FROM order_stock_reservations WHERE order_id=oid)<>2 THEN RAISE EXCEPTION 'Reservation changed physical stock'; END IF;
 r2:=reserve_order_checkout(p,NULL,'22222222-2222-4222-8222-222222222222');
 IF r2->'order'->>'id'<>oid::text OR r2->'attempt'->>'id'<>aid::text OR (r2->>'new_attempt')::boolean THEN RAISE EXCEPTION 'Checkout not idempotent'; END IF;
 BEGIN
  PERFORM reserve_order_checkout(p,NULL,gen_random_uuid());RAISE EXCEPTION 'Overselling allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Stock insuficiente%' THEN RAISE; END IF; END;
 PERFORM attach_order_preference(aid,'TEST-PREF-'||aid,'https://www.mercadopago.com.ar/checkout/test');
 PERFORM apply_verified_order_payment(aid,'TEST-PAY-'||aid,'approved');
 PERFORM apply_verified_order_payment(aid,'TEST-PAY-'||aid,'approved');
 IF (SELECT stock FROM products WHERE id=pid)<>0 OR (SELECT status FROM orders WHERE id=oid)<>'paid' THEN RAISE EXCEPTION 'Payment not applied exactly once'; END IF;
 PERFORM apply_verified_order_payment(aid,'TEST-PAY-'||aid,'rejected');
 IF (SELECT status FROM orders WHERE id=oid)<>'paid' THEN RAISE EXCEPTION 'Late rejection regressed paid order'; END IF;
 PERFORM apply_verified_order_payment(aid,'TEST-SECOND-PAY-'||aid,'approved');
 IF NOT(SELECT needs_review FROM orders WHERE id=oid) OR (SELECT stock FROM products WHERE id=pid)<>0 THEN RAISE EXCEPTION 'Duplicate payment not flagged'; END IF;
 UPDATE products SET stock=2 WHERE id=pid;
 r:=reserve_order_checkout(p,NULL,gen_random_uuid());late_order:=(r->'order'->>'id')::uuid;late_attempt:=(r->'attempt'->>'id')::uuid;
 PERFORM attach_order_preference(late_attempt,'TEST-PREF-'||late_attempt,'https://www.mercadopago.com.ar/checkout/test');
 UPDATE order_stock_reservations SET expires_at=now()-interval '1 second' WHERE order_id=late_order;
 UPDATE order_payment_attempts SET expires_at=now()-interval '1 second' WHERE id=late_attempt;
 UPDATE orders SET abandon_at=now()-interval '1 second',recovery_due_at=now()-interval '1 second' WHERE id=late_order;
 PERFORM expire_order_reservations();
 IF EXISTS(SELECT 1 FROM order_stock_reservations WHERE order_id=late_order) OR (SELECT status FROM orders WHERE id=late_order) NOT IN ('abandoned','recovery_pending') THEN RAISE EXCEPTION 'Expiry failed'; END IF;
 -- A second customer owns the available units after the first reservation expires.
 r:=reserve_order_checkout(p,NULL,gen_random_uuid());second_order:=(r->'order'->>'id')::uuid;second_attempt:=(r->'attempt'->>'id')::uuid;
 PERFORM apply_verified_order_payment(late_attempt,'TEST-LATE-PAY-'||late_attempt,'approved');
 IF NOT(SELECT needs_review FROM orders WHERE id=late_order) OR (SELECT status FROM orders WHERE id=late_order)<>'paid' OR (SELECT stock FROM products WHERE id=pid)<>2 THEN RAISE EXCEPTION 'Late payment stole another reservation'; END IF;
 PERFORM attach_order_preference(second_attempt,'TEST-PREF-'||second_attempt,'https://www.mercadopago.com.ar/checkout/test');
 PERFORM apply_verified_order_payment(second_attempt,'TEST-PAY-'||second_attempt,'approved');
 IF (SELECT stock FROM products WHERE id=pid)<>0 THEN RAISE EXCEPTION 'Reserved second payment failed'; END IF;
 UPDATE products SET stock=2 WHERE id=pid;
 r:=reserve_order_checkout(p,NULL,gen_random_uuid());oid:=(r->'order'->>'id')::uuid;aid:=(r->'attempt'->>'id')::uuid;
 PERFORM attach_order_preference(aid,'TEST-PREF-'||aid,'https://www.mercadopago.com.ar/checkout/test');
 PERFORM apply_verified_order_payment(aid,'TEST-REJECT-'||aid,'rejected');
 IF (SELECT status FROM orders WHERE id=oid)<>'payment_rejected' OR EXISTS(SELECT 1 FROM order_stock_reservations WHERE order_id=oid) THEN RAISE EXCEPTION 'Rejection did not release reservation'; END IF;
 UPDATE products SET price=125 WHERE id=pid;
 r2:=reserve_order_checkout(NULL,oid,NULL);
 IF (r2->'order'->>'total')::numeric<>250 OR r2->'order'->>'id'<>oid::text OR r2->'attempt'->>'id'=aid::text THEN RAISE EXCEPTION 'Resume did not reprice same order'; END IF;
 -- Approval of the old price restores its immutable snapshot.
 PERFORM apply_verified_order_payment(aid,'TEST-RECOVER-'||aid,'approved');
 IF (SELECT total FROM orders WHERE id=oid)<>200 OR (SELECT stock FROM products WHERE id=pid)<>0 THEN RAISE EXCEPTION 'Historical attempt not restored'; END IF;
END $test$;
