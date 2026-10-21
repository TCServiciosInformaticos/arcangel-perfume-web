import { test } from "node:test";
import assert from "node:assert/strict";
import { canResumeOrder, validMercadoPagoCheckout, paymentDecision } from "./order-lifecycle";
import { signOrderAccess, verifyOrderAccess } from "./payment-security.server";
test("solo los estados impagos recuperables admiten retomar", () => {
  for (const s of ["pending_payment", "abandoned", "payment_rejected"]) assert(canResumeOrder(s));
  for (const s of ["paid", "preparing", "shipped", "delivered", "cancelled"])
    assert(!canResumeOrder(s));
});
test("las redirecciones admiten solamente checkout HTTPS de Mercado Pago", () => {
  assert(
    validMercadoPagoCheckout("https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123"),
  );
  assert(
    validMercadoPagoCheckout("https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123"),
  );
  for (const url of [
    "http://www.mercadopago.com.ar/checkout",
    "https://www.mercadopago.com.ar.evil.test",
    "javascript:alert(1)",
    "https://evil.test",
  ])
    assert(!validMercadoPagoCheckout(url));
});
test("el pago se compara con el intento histórico y no con el total de un reintento", () => {
  const payment = {
    id: "123",
    external_reference: "order-1",
    currency_id: "ARS",
    transaction_amount: 100.12,
  };
  const attempt = { total: 100.12, preference_id: "pref-old" };
  const merchant = { preference_id: "pref-old", payments: [{ id: 123 }] };
  assert(paymentDecision(payment, "order-1", attempt, merchant));
  for (const p of [
    { ...payment, transaction_amount: 100.11 },
    { ...payment, currency_id: "USD" },
    { ...payment, external_reference: "otro" },
    { ...payment, id: "456" },
  ])
    assert(!paymentDecision(p, "order-1", attempt, merchant));
  assert(!paymentDecision(payment, "order-1", { ...attempt, total: 200 }, merchant));
  assert(!paymentDecision(payment, "order-1", attempt, { ...merchant, preference_id: "pref-new" }));
});
test("el enlace de recuperación queda vinculado a un único pedido", () => {
  const token = signOrderAccess("order-1", "test-secret");
  assert(verifyOrderAccess("order-1", token, "test-secret"));
  assert(!verifyOrderAccess("order-2", token, "test-secret"));
  assert(!verifyOrderAccess("order-1", token, "wrong-secret"));
});
