import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
});

const CheckoutSchema = z.object({
  items: z.array(CartItemSchema).min(1).max(50),
  customer_name: z.string().trim().min(2).max(120),
  customer_email: z.string().trim().email().max(160),
  customer_whatsapp: z.string().trim().min(6).max(30),
  delivery_method: z.enum(["pickup", "shipping"]),
  delivery_street: z.string().trim().max(160).nullable().optional(),
  delivery_number: z.string().trim().max(20).nullable().optional(),
  delivery_apartment: z.string().trim().max(40).nullable().optional(),
  delivery_city: z.string().trim().max(80).nullable().optional(),
  delivery_zip: z.string().trim().max(20).nullable().optional(),
  delivery_day: z.string().trim().max(40).nullable().optional(),
  delivery_time_slot: z.enum(["morning", "afternoon", "evening"]).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CheckoutSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Validate products and compute totals server-side from DB prices
    const ids = data.items.map((i) => i.productId);
    const { data: dbProducts, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, name, price, stock, is_active")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    if (!dbProducts || dbProducts.length !== ids.length) throw new Error("Producto no disponible.");

    const byId = new Map(dbProducts.map((p) => [p.id, p]));
    let subtotal = 0;
    const validated = data.items.map((it) => {
      const p = byId.get(it.productId);
      if (!p || !p.is_active) throw new Error("Producto no disponible.");
      if (p.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name}.`);
      const unit = Number(p.price);
      subtotal += unit * it.quantity;
      return {
        product_id: p.id,
        product_name: p.name,
        quantity: it.quantity,
        unit_price: unit,
        line_total: unit * it.quantity,
      };
    });

    // 2) Shipping cost from settings
    const { data: settings } = await supabaseAdmin.from("settings").select("shipping_cost, store_name").eq("id", 1).single();
    const shipping_cost = data.delivery_method === "shipping" ? Number(settings?.shipping_cost ?? 0) : 0;
    const total = subtotal + shipping_cost;

    // 3) Insert order in pending_payment state
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_whatsapp: data.customer_whatsapp,
        delivery_method: data.delivery_method,
        delivery_street: data.delivery_street ?? null,
        delivery_number: data.delivery_number ?? null,
        delivery_apartment: data.delivery_apartment ?? null,
        delivery_city: data.delivery_city ?? null,
        delivery_zip: data.delivery_zip ?? null,
        delivery_day: data.delivery_day ?? null,
        delivery_time_slot: data.delivery_time_slot ?? null,
        notes: data.notes ?? null,
        subtotal,
        shipping_cost,
        total,
        status: "pending_payment",
      })
      .select("id, order_number")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "No se pudo crear el pedido.");

    const itemsRows = validated.map((v) => ({ ...v, order_id: order.id }));
    const { error: iErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (iErr) throw new Error(iErr.message);

    // 4) Create MercadoPago preference (or fall back to no-payment mode)
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const origin = process.env.PUBLIC_SITE_URL ?? "";

    if (!accessToken) {
      // No MP configured yet — return a "demo" success so flow still completes during setup.
      await supabaseAdmin.from("orders").update({ status: "paid" }).eq("id", order.id);
      return { orderId: order.id, orderNumber: order.order_number, init_point: null, demo: true as const };
    }

    const prefItems = validated.map((v) => ({
      id: v.product_id,
      title: v.product_name,
      quantity: v.quantity,
      currency_id: "ARS",
      unit_price: v.unit_price,
    }));
    if (shipping_cost > 0) {
      prefItems.push({
        id: "shipping",
        title: "Envío a domicilio",
        quantity: 1,
        currency_id: "ARS",
        unit_price: shipping_cost,
      });
    }

    const preferenceBody = {
      items: prefItems,
      payer: {
        name: data.customer_name,
        email: data.customer_email,
      },
      external_reference: order.id,
      back_urls: {
        success: `${origin}/gracias?order=${order.id}`,
        pending: `${origin}/pago-pendiente?order=${order.id}`,
        failure: `${origin}/pago-fallido?order=${order.id}`,
      },
      auto_return: "approved",
      notification_url: `${origin}/api/public/mercadopago-webhook`,
      statement_descriptor: "EL ARCANGEL",
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(preferenceBody),
    });
    if (!mpRes.ok) {
      const txt = await mpRes.text();
      console.error("MercadoPago preference error:", mpRes.status, txt);
      throw new Error("No se pudo iniciar el pago. Probá de nuevo en un momento.");
    }
    const pref = (await mpRes.json()) as { id: string; init_point: string; sandbox_init_point?: string };
    await supabaseAdmin.from("orders").update({ mp_preference_id: pref.id }).eq("id", order.id);

    const isTest = accessToken.startsWith("TEST-");
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      init_point: isTest ? (pref.sandbox_init_point ?? pref.init_point) : pref.init_point,
      demo: false as const,
    };
  });
