import { test } from "node:test";
import assert from "node:assert/strict";
test("worker verifica pago, conserva idempotencia, no cuenta fallos como envío y omite pedidos pagados", async () => {
  Object.assign(process.env, {
    SUPABASE_URL: "https://database.example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    MERCADOPAGO_ACCESS_TOKEN: "TEST-not-real",
    MERCADOPAGO_WEBHOOK_SECRET: "test-webhook-secret",
    ORDER_ACCESS_SECRET: "test-secret",
    RESEND_API_KEY: "re_not_real",
    ORDER_RECOVERY_FROM_EMAIL: "Tienda <store@example.invalid>",
    ORDER_RECOVERY_EMAIL_ENABLED: "true",
    PUBLIC_SITE_URL: "https://store.example.invalid",
  });
  const original = globalThis.fetch;
  const id = "11111111-1111-4111-8111-111111111111",
    oid = "22222222-2222-4222-8222-222222222222",
    lease = "33333333-3333-4333-8333-333333333333";
  let claimed = false,
    payload: unknown = null,
    paid = false,
    failProvider = false,
    failAck = false,
    finished = 0,
    uniqueSends = 0,
    failed = 0,
    canVerify = true;
  const providerRequests = new Map<string, string>();
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.includes("/v1/payments/search")) {
      if (!canVerify) return new Response("unavailable", { status: 503 });
      return Response.json({ results: [], paging: { total: 0 } });
    }
    if (url.includes("/rpc/claim_order_recovery_email")) {
      if (claimed) return Response.json(null);
      claimed = true;
      return Response.json({ id, order_id: oid, lease_token: lease, payload });
    }
    if (url.includes("/rest/v1/orders"))
      return init?.method === "PATCH"
        ? new Response(null, { status: 204 })
        : Response.json({
            order_number: 1001,
            customer_name: "Cliente",
            customer_email: "customer@example.invalid",
          });
    if (url.includes("/rest/v1/settings")) return Response.json({ store_name: "El Arcángel" });
    if (url.includes("/rpc/prepare_order_recovery_email")) {
      payload ??= body.body;
      return Response.json(payload);
    }
    if (url.includes("/rpc/authorize_order_recovery_send")) return Response.json(!paid);
    if (url === "https://api.resend.com/emails") {
      if (failProvider) return new Response("temporary", { status: 429 });
      const key = new Headers(init?.headers).get("Idempotency-Key")!;
      assert.equal(key, "order-recovery/" + id);
      const sentBody = JSON.stringify(body);
      if (providerRequests.has(key)) assert.equal(providerRequests.get(key), sentBody);
      else {
        providerRequests.set(key, sentBody);
        uniqueSends++;
      }
      return Response.json({ id: "provider-id" });
    }
    if (url.includes("/rpc/finish_order_recovery_email")) {
      if (failAck) return Response.json({ message: "temporary failure" }, { status: 500 });
      finished++;
      return new Response(null, { status: 204 });
    }
    if (url.includes("/rpc/fail_order_recovery_email")) {
      failed++;
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected request " + url);
  };
  try {
    const { processOrderRecoveryEmails, recoveryEmailReadiness } =
      await import("./order-recovery-email.server");
    assert(recoveryEmailReadiness().ready);
    failProvider = true;
    let r = await processOrderRecoveryEmails();
    assert.equal(r.failed, 1);
    assert.equal(finished, 0);
    assert.equal(uniqueSends, 0);
    claimed = false;
    failProvider = false;
    failAck = true;
    r = await processOrderRecoveryEmails();
    assert.equal(r.failed, 1);
    assert.equal(finished, 0);
    assert.equal(uniqueSends, 1);
    claimed = false;
    failAck = false;
    r = await processOrderRecoveryEmails();
    assert.equal(r.sent, 1);
    assert.equal(uniqueSends, 1);
    assert.equal(finished, 1);
    claimed = false;
    paid = true;
    r = await processOrderRecoveryEmails();
    assert.equal(r.skipped, 1);
    assert.equal(uniqueSends, 1);
    claimed = false;
    paid = false;
    canVerify = false;
    r = await processOrderRecoveryEmails();
    assert.equal(r.failed, 1);
    assert.equal(uniqueSends, 1);
    assert(failed >= 3);
    process.env.ORDER_RECOVERY_EMAIL_ENABLED = "false";
    assert(!recoveryEmailReadiness().ready);
    await assert.rejects(processOrderRecoveryEmails(), /configurar/);
  } finally {
    globalThis.fetch = original;
  }
});
