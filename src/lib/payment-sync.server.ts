import { z } from "zod";
import { paymentMatchesOrder } from "@/lib/checkout-validation";

const paymentSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string(),
  external_reference: z.string().uuid(),
  currency_id: z.string(),
  transaction_amount: z.number().finite(),
  order: z.object({ id: z.union([z.string(), z.number()]) }).nullable().optional(),
});

export async function syncMercadoPagoPayment(paymentId: string, expectedOrderId?: string) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Mercado Pago todavía no está configurado.");
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    console.error("Mercado Pago payment verification failed", response.status);
    throw new Error("No pudimos verificar el pago con Mercado Pago. Volvé a intentarlo.");
  }
  const payment = paymentSchema.parse(await response.json());
  if (String(payment.id) !== paymentId || (expectedOrderId && payment.external_reference !== expectedOrderId)) throw new Error("El pago no corresponde al pedido.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order, error } = await supabaseAdmin.from("orders").select("id, total, status, mp_payment_id, mp_preference_id").eq("id", payment.external_reference).maybeSingle();
  if (error) throw error;
  if (!order || !order.mp_preference_id || !paymentMatchesOrder(payment, order)) throw new Error("El importe del pago no corresponde al pedido.");
  if (!payment.order?.id) throw new Error("Mercado Pago no informó la referencia de la compra.");
  const merchantResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${encodeURIComponent(String(payment.order.id))}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!merchantResponse.ok) throw new Error("No pudimos verificar la referencia de la compra.");
  const merchant = z.object({ preference_id: z.string(), payments: z.array(z.object({ id: z.union([z.string(), z.number()]) })) }).parse(await merchantResponse.json());
  if (merchant.preference_id !== order.mp_preference_id || !merchant.payments.some((item) => String(item.id) === paymentId)) throw new Error("El pago no corresponde a esta compra.");
  // Never regress fulfilled/approved orders when older notifications or failed attempts arrive.
  if (["paid", "preparing", "shipped", "delivered"].includes(order.status) && order.mp_payment_id) return;
  const status = payment.status === "approved" ? "paid" : ["rejected", "cancelled"].includes(payment.status) ? "cancelled" : "pending_payment";
  const { error: updateError } = await supabaseAdmin.from("orders")
    .update({ status, mp_payment_id: String(payment.id) })
    .eq("id", order.id).in("status", ["pending_payment", "cancelled"]);
  if (updateError) throw updateError;
}