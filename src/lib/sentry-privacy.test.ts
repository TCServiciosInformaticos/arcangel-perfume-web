import { test } from "node:test";
import assert from "node:assert/strict";
import { privateSentryEvent, monitoringRoute, validSentryDsn } from "./sentry-privacy";
test("monitoring removes customer data, capabilities, breadcrumbs and source context", () => {
  const secret = "SECRET_CUSTOMER_DATA";
  const event = privateSentryEvent(
    {
      event_id: "event",
      user: { email: secret },
      message: secret,
      extra: { payload: secret },
      contexts: { order: { value: secret } },
      breadcrumbs: [{ message: secret }],
      request: {
        url: "https://store.test/gracias/123?token=" + secret,
        headers: { Authorization: secret },
        data: secret,
      },
      exception: {
        values: [
          {
            type: "TypeError",
            value: secret,
            stacktrace: {
              frames: [
                {
                  filename: "https://store.test/assets/app.js?token=" + secret,
                  function: "submitCheckout",
                  lineno: 12,
                  colno: 5,
                  vars: { customer: secret },
                  context_line: secret,
                },
              ],
            },
          },
        ],
      },
    },
    "browser",
    "https://store.test/producto/private-product?email=" + secret,
  );
  assert.equal(JSON.stringify(event).includes(secret), false);
  assert.equal(event.tags?.route, "/producto/:slug");
  assert.equal(event.exception?.values?.[0].stacktrace?.frames?.[0].lineno, 12);
  assert.equal(event.exception?.values?.[0].stacktrace?.frames?.[0].filename, "assets/app.js");
  assert.equal(event.user, undefined);
  assert.equal(event.request, undefined);
  assert.equal(event.breadcrumbs, undefined);
});
test("routes retain useful static screens and remove IDs and search", () => {
  assert.equal(monitoringRoute("/admin/pedidos?cliente=private"), "/admin/pedidos");
  assert.equal(monitoringRoute("/gracias/private-order?token=private"), "/:route");
  assert.equal(monitoringRoute("/api/public/order-recovery-emails?key=private"), "/api/:route");
});
test("accepts public Sentry DSNs only and rejects credentials or custom destinations", () => {
  assert.ok(validSentryDsn("https://publickey@o123.ingest.us.sentry.io/456"));
  assert.ok(validSentryDsn("https://publickey@o123.ingest.sentry.io/456"));
  for (const dsn of [
    undefined,
    "",
    "https://key:secret@o123.ingest.sentry.io/456",
    "https://key@evil.test/456",
    "http://key@o123.ingest.sentry.io/456",
  ])
    assert.equal(validSentryDsn(dsn), undefined);
});
