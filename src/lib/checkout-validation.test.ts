import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { CheckoutSchema, isPaymentConfirmed, paymentMatchesOrder } from "./checkout-validation";
import { signOrderAccess, verifyOrderAccess, verifyMercadoPagoSignature } from "./payment-security.server";
import { buildOrderMessage, buildWhatsappLink, type OrderForWhatsapp } from "./whatsapp";

const id = "11111111-1111-4111-8111-111111111111";
const purchase = { items: [{ productId: id, quantity: 2 }], customer_name: "Cliente de prueba", customer_email: "cliente@example.com", customer_whatsapp: "+54 9 11 5555 0000", delivery_method: "pickup" as const };

describe("Reglas de compra", () => {
  test("WhatsApp se habilita solo con pago confirmado, no por volver a la página", () => {
    expect(isPaymentConfirmed("pending_payment", "123")).toBe(false);
    expect(isPaymentConfirmed("paid", null)).toBe(false);
    expect(isPaymentConfirmed("paid", "123")).toBe(true);
    expect(isPaymentConfirmed("cancelled", "123")).toBe(false);
  });
  test("el pago debe coincidir con importe, pedido y moneda ARS", () => {
    const payment = { external_reference: id, currency_id: "ARS", transaction_amount: 12000 };
    expect(paymentMatchesOrder(payment, { id, total: 12000 })).toBe(true);
    expect(paymentMatchesOrder(payment, { id, total: 12001 })).toBe(false);
    expect(paymentMatchesOrder({ ...payment, currency_id: "USD" }, { id, total: 12000 })).toBe(false);
  });
  test("envío exige dirección; retiro no", () => {
    expect(CheckoutSchema.safeParse(purchase).success).toBe(true);
    expect(CheckoutSchema.safeParse({ ...purchase, delivery_method: "shipping" }).success).toBe(false);
    expect(CheckoutSchema.safeParse({ ...purchase, delivery_method: "shipping", delivery_street: "Calle", delivery_number: "12", delivery_city: "Gran Bourg" }).success).toBe(true);
  });
  test("no se pueden duplicar líneas para eludir stock", () => {
    expect(CheckoutSchema.safeParse({ ...purchase, items: [purchase.items[0], purchase.items[0]] }).success).toBe(false);
  });
  test("acceso de invitado no permite leer otro pedido ni alterar el permiso", () => {
    const secret = "test-only-signing-key";
    const token = signOrderAccess(id, secret);
    expect(verifyOrderAccess(id, token, secret)).toBe(true);
    expect(verifyOrderAccess("22222222-2222-4222-8222-222222222222", token, secret)).toBe(false);
    expect(verifyOrderAccess(id, "0".repeat(64), secret)).toBe(false);
  });
  test("webhook requiere firma válida para ese id y request", () => {
    const secret = "test-only-webhook-key";
    const hash = createHmac("sha256", secret).update("id:123;request-id:req-test;ts:1704908010;").digest("hex");
    expect(verifyMercadoPagoSignature(`ts=1704908010,v1=${hash}`, "req-test", "123", secret)).toBe(true);
    expect(verifyMercadoPagoSignature(`ts=1704908010,v1=${hash}`, "req-test", "124", secret)).toBe(false);
    expect(verifyMercadoPagoSignature(null, "req-test", "123", secret)).toBe(false);
  });
  test("WhatsApp contiene los datos, cantidades y entrega que recibe el dueño", () => {
    const order: OrderForWhatsapp = { ...purchase, order_number: 42, delivery_method: "shipping", delivery_street: "Calle", delivery_number: "12", delivery_apartment: null, delivery_city: "Gran Bourg", delivery_zip: "1615", delivery_day: "martes", delivery_time_slot: "morning", notes: "Timbre 2", subtotal: 10000, shipping_cost: 2000, total: 12000, mp_payment_id: "123", items: [{ product_name: "Shampoo", quantity: 2, unit_price: 5000 }] };
    const url = new URL(buildWhatsappLink("+54 9 11 5555 0000", buildOrderMessage(order)));
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/5491155550000");
    const message = url.searchParams.get("text") ?? "";
    for (const value of ["Cliente de prueba", "cliente@example.com", "+54 9 11 5555 0000", "2× Shampoo", "Calle 12", "Gran Bourg", "martes", "Timbre 2"]) expect(message).toContain(value);
  });
});