import { test } from "node:test";
import assert from "node:assert/strict";
test("checkout conserva pedido, reserva y vencimiento; reutiliza el enlace sin crear otra preferencia", async () => {
  process.env.SUPABASE_URL = "https://database.example.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-not-a-real-token";
  process.env.ORDER_ACCESS_SECRET = "test-only-secret";
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "test-only-webhook";
  process.env.PUBLIC_SITE_URL = "https://store.example.invalid";
  const originalFetch = globalThis.fetch;
  const orderId = "11111111-1111-4111-8111-111111111111",
    attemptId = "22222222-2222-4222-8222-222222222222";
  const created = new Date().toISOString(),
    expiry = new Date(Date.now() + 30 * 60000).toISOString();
  let attached = false,
    createdPreferences = 0;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/rest/v1/settings")) return Response.json({ store_whatsapp: "541111111111" });
    if (url.includes("/rest/v1/rpc/reserve_order_checkout"))
      return Response.json({
        new_attempt: !attached,
        order: {
          id: orderId,
          order_number: 1001,
          customer_name: "Test",
          customer_email: "test@example.invalid",
        },
        attempt: {
          id: attemptId,
          state: attached ? "ready" : "preparing",
          checkout_url: attached
            ? "https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=test"
            : null,
          expires_at: expiry,
          created_at: created,
          shipping_cost: 0,
          items: [
            {
              product_id: "33333333-3333-4333-8333-333333333333",
              product_name: "Test",
              quantity: 1,
              unit_price: 100,
            },
          ],
        },
      });
    if (url === "https://api.mercadopago.com/checkout/preferences") {
      createdPreferences++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.expires, true);
      assert.equal(body.expiration_date_to, expiry);
      assert.equal(body.metadata.attempt_id, attemptId);
      assert.equal(body.external_reference, orderId);
      assert.equal(body.items[0].unit_price, 100);
      assert.equal(new Headers(init?.headers).get("X-Idempotency-Key"), attemptId);
      return Response.json({
        id: "test-pref",
        init_point: "https://www.mercadopago.com/mla/checkout/pay?pref_id=test",
        sandbox_init_point: "https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=test",
      });
    }
    if (url.includes("/rest/v1/rpc/attach_order_preference")) {
      attached = true;
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected request: " + url);
  };
  try {
    const { startOrderCheckout } = await import("./order-checkout.server");
    const first = await startOrderCheckout(null, orderId);
    const retry = await startOrderCheckout(null, orderId);
    assert.equal(first.orderId, orderId);
    assert.equal(first.reservationUntil, expiry);
    assert.match(first.init_point, /sandbox.mercadopago.com/);
    assert.equal(first.init_point, retry.init_point);
    assert.equal(first.token, retry.token);
    assert.equal(createdPreferences, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
