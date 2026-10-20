import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { OrderForWhatsapp } from "@/lib/whatsapp";
import { isPaymentConfirmed } from "@/lib/checkout-validation";

export const getOrderForWhatsapp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().uuid(),
    token: z.string().regex(/^[a-f0-9]{64}$/i),
    paymentId: z.string().regex(/^\d{1,30}$/).optional(),
  }).parse(d))
  .handler(async ({ data }): Promise<{ order: OrderForWhatsapp; status: string; storeWhatsapp: string | null } | null> => {
    const secret = process.env.ORDER_ACCESS_SECRET;
    const { verifyOrderAccess } = await import("@/lib/payment-security.server");
    if (!secret || !verifyOrderAccess(data.orderId, data.token, secret)) throw new Error("El enlace de este pedido no es válido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Payment status is only changed by the signature-verified Mercado Pago webhook.
    // The return page merely reads the current order state (paymentId is ignored).
    const { data: order, error } = await supabaseAdmin.from("orders")
      .select("id, order_number, status, customer_name, customer_email, customer_whatsapp, delivery_method, delivery_street, delivery_number, delivery_apartment, delivery_city, delivery_zip, delivery_day, delivery_time_slot, notes, pickup_branch, subtotal, shipping_cost, total, mp_payment_id")
      .eq("id", data.orderId).maybeSingle();
    if (error) throw new Error("No pudimos consultar el pedido.");
    if (!order) return null;
    const { data: items, error: itemError } = await supabaseAdmin.from("order_items")
      .select("product_name, quantity, unit_price").eq("order_id", data.orderId);
    if (itemError) throw new Error("No pudimos consultar los productos del pedido.");
    let storeWhatsapp: string | null = null;
    if (isPaymentConfirmed(order.status, order.mp_payment_id)) {
      const { data: settings, error: settingsError } = await supabaseAdmin.from("settings").select("store_whatsapp").eq("id", 1).single();
      if (settingsError || !settings?.store_whatsapp) throw new Error("La tienda necesita configurar su WhatsApp.");
      storeWhatsapp = settings.store_whatsapp;
    }
    return { order: { ...order, items: items ?? [] }, status: order.status, storeWhatsapp };
  });
