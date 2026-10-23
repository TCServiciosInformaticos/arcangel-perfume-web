import { test } from "node:test";
import assert from "node:assert/strict";
import { orderConfirmationCopy } from "./checkout-copy";
test("unverified status never presents the purchase as paid", () => {
  for (const status of [
    undefined,
    "paid",
    "pending_payment",
    "payment_rejected",
    "cancelled",
    "abandoned",
    "abandoned_final",
  ]) {
    const copy = orderConfirmationCopy(status, false);
    assert.notEqual(copy.title, "¡Gracias por tu compra!");
    assert.notEqual(copy.label, "Pago aprobado");
  }
});
test("cancelled order and rejected payment give different recovery guidance", () => {
  assert.match(orderConfirmationCopy("cancelled", false).description, /nueva compra/);
  assert.match(orderConfirmationCopy("payment_rejected", false).description, /mismo pedido/);
  assert.match(orderConfirmationCopy("paid", true).description, /ya está registrado/);
});
