import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRecoveryEmail } from "./order-recovery-email";
test("email incluye CTA seguro, texto alternativo, plazo de 24 horas y disponibilidad actual", () => {
  const r = buildRecoveryEmail({
    name: "<script>Cliente</script>",
    orderNumber: 1001,
    recoveryUrl: "https://store.example.invalid/pago-pendiente?order=123&token=test",
    storeName: "El Arcángel",
  });
  assert.match(r.html, /&lt;script&gt;Cliente/);
  assert(!r.html.includes("<script>"));
  assert.match(r.html, /Retomar mi pedido/);
  assert.match(r.text, /24 horas/);
  assert.match(r.text, /precios y la disponibilidad actuales/);
  assert.match(r.html, /order=123&amp;token=test/);
});
test("email rechaza enlaces HTTP y credenciales en URLs", () => {
  for (const recoveryUrl of ["http://example.invalid", "https://user:password@example.invalid"])
    assert.throws(() =>
      buildRecoveryEmail({ name: "Cliente", orderNumber: 1, recoveryUrl, storeName: "Tienda" }),
    );
});
