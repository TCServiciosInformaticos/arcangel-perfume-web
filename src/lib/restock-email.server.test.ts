import test from "node:test";
import assert from "node:assert/strict";
import { processRestockMail } from "./restock-email.server";
test("restock mail is off by default and never contacts a provider", async () => {
  delete process.env.RESTOCK_EMAIL_ENABLED;
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Unexpected external call");
  };
  try {
    assert.deepEqual(await processRestockMail(), { enabled: false, sent: 0, review: 0 });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previous;
  }
});
test("restock worker sends once with stable idempotency key; ambiguous sends are held for review", async () => {
  process.env.SUPABASE_URL = "https://restock-fixture.example.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-key";
  process.env.RESTOCK_EMAIL_ENABLED = "true";
  process.env.RESEND_API_KEY = "fixture-key";
  process.env.ORDER_RECOVERY_FROM_EMAIL = "fixture@example.invalid";
  process.env.PUBLIC_SITE_URL = "https://store.example.invalid";
  const original = globalThis.fetch;
  let state = "waiting",
    providerCalls = 0,
    ambiguous = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/rpc/claim_stock_notifications")) {
      if (state !== "waiting") return Response.json([]);
      state = "sending";
      return Response.json([
        {
          id: "fixture-lease",
          user_id: "33333333-3333-4333-8333-333333333333",
          product_id: "fixture-product",
        },
      ]);
    }
    if (url.includes("/auth/v1/admin/users/"))
      return Response.json({
        id: "33333333-3333-4333-8333-333333333333",
        email: "fixture@example.invalid",
        email_confirmed_at: new Date().toISOString(),
      });
    if (url.includes("/rest/v1/products"))
      return Response.json({ name: "Fixture", slug: "fixture-product", is_active: true, stock: 3 });
    if (url.includes("/rest/v1/stock_notifications")) {
      if (init?.method === "PATCH") {
        state = JSON.parse(String(init.body)).state;
        return new Response(null, { status: 204 });
      }
      return Response.json({ state });
    }
    if (url === "https://api.resend.com/emails") {
      providerCalls++;
      assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "restock-fixture-lease");
      if (ambiguous) throw new Error("Fixture network timeout");
      return Response.json({ id: "fixture-accepted" });
    }
    throw new Error("Unexpected fixture request");
  };
  try {
    assert.deepEqual(await processRestockMail(), { enabled: true, sent: 1, review: 0 });
    assert.equal(state, "sent");
    await processRestockMail();
    assert.equal(providerCalls, 1);
    state = "waiting";
    ambiguous = true;
    assert.deepEqual(await processRestockMail(), { enabled: true, sent: 0, review: 1 });
    assert.equal(state, "review");
    await processRestockMail();
    assert.equal(providerCalls, 2);
  } finally {
    globalThis.fetch = original;
    delete process.env.RESTOCK_EMAIL_ENABLED;
  }
});
