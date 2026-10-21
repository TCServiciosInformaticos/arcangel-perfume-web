import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signOrderAccess } from "./payment-security.server";
import { validMercadoPagoCheckout } from "./order-lifecycle";
import type { CheckoutInput } from "./checkout-validation";
import type { Json } from "@/integrations/supabase/types";
const reservationSchema = z.object({
  new_attempt: z.boolean(),
  order: z.object({
    id: z.string().uuid(),
    order_number: z.number(),
    customer_name: z.string(),
    customer_email: z.string(),
  }),
  attempt: z.object({
    id: z.string().uuid(),
    state: z.string(),
    checkout_url: z.string().nullable(),
    expires_at: z.string(),
    created_at: z.string(),
    shipping_cost: z.number(),
    items: z.array(
      z.object({
        product_id: z.string().nullable(),
        product_name: z.string(),
        quantity: z.number(),
        unit_price: z.number(),
      }),
    ),
  }),
});
export async function startOrderCheckout(
  payload: CheckoutInput | null,
  existingId?: string,
  requestKey?: string,
) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN,
    secret = process.env.ORDER_ACCESS_SECRET;
  if (!accessToken || !secret || !process.env.MERCADOPAGO_WEBHOOK_SECRET)
    throw new Error(
      "El pago con Mercado Pago todavía no está habilitado. Tu carrito sigue guardado.",
    );
  const origin = new URL(process.env.PUBLIC_SITE_URL || "https://arcangel-perfume-web.lovable.app")
    .origin;
  if (!origin.startsWith("https:")) throw new Error("La tienda debe usar HTTPS.");
  const settings = await supabaseAdmin
    .from("settings")
    .select("store_whatsapp")
    .eq("id", 1)
    .single();
  if (
    settings.error ||
    !settings.data ||
    !/^\d{8,15}$/.test(settings.data.store_whatsapp.replace(/\D/g, ""))
  )
    throw new Error("La tienda necesita configurar su WhatsApp.");
  const reserved = await supabaseAdmin.rpc("reserve_order_checkout", {
    payload: payload as Json,
    existing_id: existingId ?? null,
    request_key: requestKey ?? null,
  });
  if (reserved.error) throw new Error(reserved.error.message);
  const { order, attempt, new_attempt } = reservationSchema.parse(reserved.data);
  const token = signOrderAccess(order.id, secret);
  const result = (url: string) => ({
    orderId: order.id,
    orderNumber: order.order_number,
    token,
    init_point: url,
    reservationUntil: attempt.expires_at,
  });
  if (
    attempt.state === "ready" &&
    attempt.checkout_url &&
    validMercadoPagoCheckout(attempt.checkout_url)
  )
    return result(attempt.checkout_url);
  if (!new_attempt) {
    let offset = 0;
    while (true) {
      const lookup = await fetch(
        `https://api.mercadopago.com/checkout/preferences/search?external_reference=${order.id}&limit=100&offset=${offset}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) },
      );
      if (!lookup.ok)
        throw new Error(
          "No pudimos verificar el intento de pago anterior. Reintentá en un momento.",
        );
      const found = z
        .object({
          elements: z.array(z.object({ id: z.string() })),
          next_offset: z.number(),
          total: z.number(),
        })
        .parse(await lookup.json());
      for (const candidate of found.elements) {
        const response = await fetch(
          `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(candidate.id)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok) throw new Error("No pudimos verificar la compra anterior.");
        const pref = await response.json();
        if (pref.metadata?.attempt_id !== attempt.id) continue;
        const url = accessToken.startsWith("TEST-")
          ? (pref.sandbox_init_point ?? pref.init_point)
          : pref.init_point;
        if (!validMercadoPagoCheckout(url)) throw new Error("Enlace de pago inválido.");
        const attached = await supabaseAdmin.rpc("attach_order_preference", {
          attempt_id: attempt.id,
          preference: pref.id,
          checkout: url,
        });
        if (attached.error) throw new Error(attached.error.message);
        return result(url);
      }
      if (found.next_offset >= found.total) break;
      if (found.next_offset <= offset)
        throw new Error("No pudimos completar la consulta del intento anterior.");
      offset = found.next_offset;
    }
    throw new Error(
      "Estamos verificando el intento anterior. Esperá unos segundos y retomá este mismo pedido.",
    );
  }
  // Only the creator of a new attempt contacts the preference creation endpoint.
  const items = attempt.items.map((i) => ({
    id: i.product_id ?? "deleted-product",
    title: i.product_name,
    quantity: i.quantity,
    currency_id: "ARS",
    unit_price: i.unit_price,
  }));
  if (attempt.shipping_cost > 0)
    items.push({
      id: "shipping",
      title: "Envío a domicilio",
      quantity: 1,
      currency_id: "ARS",
      unit_price: attempt.shipping_cost,
    });
  const search = `order=${order.id}&token=${token}`;
  try {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": attempt.id,
      },
      body: JSON.stringify({
        items,
        payer: { name: order.customer_name, email: order.customer_email },
        external_reference: order.id,
        back_urls: {
          success: `${origin}/gracias?${search}`,
          pending: `${origin}/pago-pendiente?${search}`,
          failure: `${origin}/pago-fallido?${search}`,
        },
        metadata: { attempt_id: attempt.id },
        auto_return: "approved",
        notification_url: `${origin}/api/public/mercadopago-webhook`,
        statement_descriptor: "EL ARCANGEL",
        expires: true,
        expiration_date_from: attempt.created_at,
        expiration_date_to: attempt.expires_at,
      }),
    });
    if (!response.ok) throw new Error("No se pudo iniciar Mercado Pago. Podés retomar el pedido.");
    const pref = z
      .object({ id: z.string(), init_point: z.string(), sandbox_init_point: z.string().optional() })
      .parse(await response.json());
    const url = accessToken.startsWith("TEST-")
      ? (pref.sandbox_init_point ?? pref.init_point)
      : pref.init_point;
    if (!validMercadoPagoCheckout(url))
      throw new Error("Mercado Pago devolvió un enlace inválido.");
    const attached = await supabaseAdmin.rpc("attach_order_preference", {
      attempt_id: attempt.id,
      preference: pref.id,
      checkout: url,
    });
    if (attached.error) {
      // Another identical retry may already have attached this preference.
      const { data } = await supabaseAdmin
        .from("order_payment_attempts")
        .select("preference_id,checkout_url,state")
        .eq("id", attempt.id)
        .single();
      if (
        data?.state === "ready" &&
        data.preference_id === pref.id &&
        data.checkout_url &&
        validMercadoPagoCheckout(data.checkout_url)
      )
        return result(data.checkout_url);
      throw new Error(attached.error.message);
    }
    return result(url);
  } catch (e) {
    // Do not discard an ambiguous network result: the provider may have created it.
    // The reservation expires automatically; retries keep the same idempotency key.
    throw e instanceof Error
      ? e
      : new Error("No pudimos iniciar el pago. Reintentá este mismo pedido.");
  }
}
