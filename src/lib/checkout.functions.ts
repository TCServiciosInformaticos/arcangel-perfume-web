import { createServerFn } from "@tanstack/react-start";

import { CheckoutSchema } from "@/lib/checkout-validation";
export type { CheckoutInput } from "@/lib/checkout-validation";

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CheckoutSchema.parse(data))
  .handler(async ({ data }) => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const signingSecret = process.env.ORDER_ACCESS_SECRET;
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!accessToken || !signingSecret || !webhookSecret) throw new Error("El pago con Mercado Pago todavía no está habilitado. Tu carrito sigue guardado.");
    const origin = new URL(process.env.PUBLIC_SITE_URL || "https://arcangel-perfume-web.lovable.app").origin;
    if (!origin.startsWith("https://")) throw new Error("La dirección de la tienda debe usar HTTPS.");
    const { signOrderAccess } = await import("@/lib/payment-security.server");
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
    const { data: settings, error: settingsError } = await supabaseAdmin.from("settings").select("shipping_cost, store_name, store_whatsapp").eq("id", 1).single();
    if (settingsError || !settings) throw new Error("No pudimos cargar los datos de la tienda.");
    if (!/^\d{8,15}$/.test(settings.store_whatsapp.replace(/\D/g, ""))) throw new Error("La tienda necesita configurar su número de WhatsApp antes de recibir pedidos.");
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
        pickup_branch: data.delivery_method === "pickup" ? data.pickup_branch ?? null : null,
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
    if (iErr) {
      await supabaseAdmin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      throw new Error("No pudimos guardar los productos del pedido.");
    }

    const token = signOrderAccess(order.id, signingSecret);
    const returnSearch = `order=${order.id}&token=${token}`;

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
        success: `${origin}/gracias?${returnSearch}`,
        pending: `${origin}/pago-pendiente?${returnSearch}`,
        failure: `${origin}/pago-fallido?${returnSearch}`,
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
      console.error("MercadoPago preference error:", mpRes.status);
      await supabaseAdmin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      throw new Error("No se pudo iniciar el pago. Probá de nuevo en un momento.");
    }
    const pref = (await mpRes.json()) as { id: string; init_point: string; sandbox_init_point?: string };
    // Test credentials (TEST-...) must use the sandbox checkout; otherwise MP rejects the payment.
    const isTestMode = accessToken.startsWith("TEST-");
    const checkoutUrl = isTestMode ? pref.sandbox_init_point || pref.init_point : pref.init_point;
    if (!pref.id || !checkoutUrl) throw new Error("Mercado Pago no devolvió un enlace de pago válido.");
    const { error: preferenceError } = await supabaseAdmin.from("orders").update({ mp_preference_id: pref.id }).eq("id", order.id);
    if (preferenceError) throw new Error("No pudimos asociar el pago a tu pedido.");

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      init_point: checkoutUrl,
      token,
    };
  });
