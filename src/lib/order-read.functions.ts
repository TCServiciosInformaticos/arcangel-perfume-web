import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { OrderForWhatsapp } from "@/lib/whatsapp";

export const getOrderForWhatsapp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ order: OrderForWhatsapp; storeWhatsapp: string } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, customer_name, customer_email, customer_whatsapp, delivery_method, delivery_street, delivery_number, delivery_apartment, delivery_city, delivery_zip, delivery_day, delivery_time_slot, notes, subtotal, shipping_cost, total, mp_payment_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return null;
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("product_name, quantity, unit_price")
      .eq("order_id", data.orderId);
    const { data: settings } = await supabaseAdmin.from("settings").select("store_whatsapp").eq("id", 1).single();
    return {
      order: { ...order, items: items ?? [] } as OrderForWhatsapp,
      storeWhatsapp: settings?.store_whatsapp ?? "5491125124333",
    };
  });

export const markOrderWhatsappSent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("orders").update({ whatsapp_sent: true }).eq("id", data.orderId);
    return { ok: true };
  });
