import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { paymentDecision } from "./order-lifecycle";
const paymentSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string(),
  external_reference: z.string().uuid(),
  currency_id: z.string(),
  transaction_amount: z.number().finite(),
  order: z
    .object({ id: z.union([z.string(), z.number()]) })
    .nullable()
    .optional(),
});
export async function mercadoGet(path: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago todavía no está configurado.");
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("No pudimos verificar el pago con Mercado Pago.");
  return r.json();
}
export async function syncMercadoPagoPayment(paymentId: string, expectedOrderId?: string) {
  const payment = paymentSchema.parse(
    await mercadoGet(`/v1/payments/${encodeURIComponent(paymentId)}`),
  );
  if (
    String(payment.id) !== paymentId ||
    (expectedOrderId && payment.external_reference !== expectedOrderId) ||
    !payment.order?.id
  )
    throw new Error("El pago no corresponde al pedido.");
  const merchant = z
    .object({
      preference_id: z.string(),
      payments: z.array(z.object({ id: z.union([z.string(), z.number()]) })),
    })
    .parse(await mercadoGet(`/merchant_orders/${encodeURIComponent(String(payment.order.id))}`));
  let attempt = await supabaseAdmin
    .from("order_payment_attempts")
    .select("id,order_id,total,preference_id")
    .eq("preference_id", merchant.preference_id)
    .maybeSingle();
  if (attempt.error) throw attempt.error;
  if (!attempt.data) {
    // Recover a preference created before a network failure or an early webhook.
    const pref = await mercadoGet(
      `/checkout/preferences/${encodeURIComponent(merchant.preference_id)}`,
    );
    const id = z.string().uuid().parse(pref.metadata?.attempt_id);
    if (pref.external_reference !== payment.external_reference)
      throw new Error("Preferencia de pago no reconocida.");
    const recovered = await supabaseAdmin
      .from("order_payment_attempts")
      .select("id,order_id,total,preference_id")
      .eq("id", id)
      .eq("order_id", payment.external_reference)
      .single();
    if (recovered.error || !recovered.data || recovered.data.preference_id)
      throw new Error("Intento de pago no reconocido.");
    if (
      !paymentDecision(
        payment,
        recovered.data.order_id,
        { ...recovered.data, preference_id: merchant.preference_id },
        merchant,
      )
    )
      throw new Error("Pago inválido.");
    const saved = await supabaseAdmin
      .from("order_payment_attempts")
      .update({ preference_id: merchant.preference_id })
      .eq("id", id)
      .is("preference_id", null);
    if (saved.error) throw saved.error;
    attempt = await supabaseAdmin
      .from("order_payment_attempts")
      .select("id,order_id,total,preference_id")
      .eq("id", id)
      .single();
  }
  if (!attempt.data || !paymentDecision(payment, attempt.data.order_id, attempt.data, merchant))
    throw new Error("El importe o la referencia del pago no corresponde al pedido.");
  const result = await supabaseAdmin.rpc("apply_verified_order_payment", {
    attempt_id: attempt.data.id,
    payment: String(payment.id),
    provider_status: payment.status,
  });
  if (result.error) throw result.error;
  return attempt.data.order_id;
}
export async function reconcileOrder(orderId: string) {
  // Full pagination: do not silently miss an approved payment after failed retries.
  let offset = 0;
  while (true) {
    const page = z
      .object({
        results: z.array(z.object({ id: z.union([z.string(), z.number()]), status: z.string() })),
        paging: z.object({ total: z.number() }),
      })
      .parse(
        await mercadoGet(
          `/v1/payments/search?external_reference=${orderId}&limit=100&offset=${offset}&sort=date_created&criteria=asc`,
        ),
      );
    for (const p of page.results) await syncMercadoPagoPayment(String(p.id), orderId);
    offset += page.results.length;
    if (offset >= page.paging.total) break;
    if (!page.results.length) throw new Error("Mercado Pago devolvió una página incompleta.");
  }
  const result = await supabaseAdmin
    .from("orders")
    .update({ last_reconciled_at: new Date().toISOString() })
    .eq("id", orderId);
  if (result.error) throw result.error;
}
export async function reconcilePendingBatch() {
  const expired = await supabaseAdmin.rpc("expire_order_reservations");
  if (expired.error) throw expired.error;
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id")
    .or("mp_preference_id.not.is.null,checkout_key.not.is.null")
    .order("last_reconciled_at", { ascending: true, nullsFirst: true })
    .limit(5);
  if (error) throw error;
  let completed = 0,
    failed = 0;
  for (const order of data ?? []) {
    try {
      await reconcileOrder(order.id);
      completed++;
    } catch {
      failed++;
      const logged = await supabaseAdmin
        .from("orders")
        .update({ last_reconciled_at: new Date().toISOString() })
        .eq("id", order.id);
      if (logged.error) throw logged.error;
    }
  }
  if (failed)
    throw new Error(
      `Conciliación parcial: ${completed} correctos y ${failed} pendientes de reintento.`,
    );
  return completed;
}
