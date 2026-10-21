import test from "node:test";
import assert from "node:assert/strict";
process.env.SUPABASE_URL = "https://commerce-fixture.example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-private-key";
process.env.ORDER_ACCESS_SECRET = "fixture-order-secret";
const productId = "11111111-1111-4111-8111-111111111111";
test("commerce quote uses verified account identity and strips private cost snapshots", async () => {
  const original = globalThis.fetch;
  let payload: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/auth/v1/user"))
      return Response.json({
        id: "22222222-2222-4222-8222-222222222222",
        email: "fixture@example.invalid",
        email_confirmed_at: new Date().toISOString(),
        is_anonymous: false,
      });
    if (url.includes("/rpc/commerce_quote")) {
      payload = JSON.parse(String(init?.body));
      return Response.json({
        amount: 90,
        discount: 10,
        items: [
          {
            product_id: productId,
            product_name: "Fixture",
            quantity: 1,
            unit_price: 90,
            line_total: 90,
            unit_cost: 12,
          },
        ],
      });
    }
    throw new Error(`Unexpected fixture request: ${url}`);
  };
  try {
    const { quoteCart } = await import("./commerce.server");
    const result = await quoteCart({
      items: [{ productId, quantity: 1 }],
      coupon_code: "FIXTURE",
      accessToken: "fixture-access-token",
    });
    assert.equal(result.amount, 90);
    assert.equal("unit_cost" in result.items[0], false);
    assert.equal(
      (payload?.payload as Record<string, unknown>).verified_user_id,
      "22222222-2222-4222-8222-222222222222",
    );
    assert.equal(
      (payload?.payload as Record<string, unknown>).verified_user_email,
      "fixture@example.invalid",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("unconfirmed accounts cannot use verified shopper operations and invalid order capability cannot repeat a purchase", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      id: "22222222-2222-4222-8222-222222222222",
      email: "fixture@example.invalid",
      email_confirmed_at: null,
    });
  };
  try {
    const { verifiedShopper, loadRepeatPurchase } = await import("./commerce.server");
    await assert.rejects(verifiedShopper("fixture-access-token"), /email confirmado/);
    assert.equal(calls, 1);
    await assert.rejects(
      loadRepeatPurchase({ orderId: productId, token: "0".repeat(64) }),
      /Enlace de compra inválido/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
