import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommerceDatabase } from "./commerce-client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { verifyOrderAccess } from "./payment-security.server";
const db = supabaseAdmin as unknown as SupabaseClient<CommerceDatabase>;
export async function verifiedShopper(token?: string) {
  if (!token) return undefined;
  const r = await supabaseAdmin.auth.getUser(token);
  if (r.error || !r.data.user?.email_confirmed_at || r.data.user.is_anonymous)
    throw new Error("Ingresá con una cuenta y email confirmado.");
  return r.data.user;
}
export async function quoteCart(data: {
  items: { productId: string; quantity: number }[];
  coupon_code?: string;
  accessToken?: string;
}) {
  const user = await verifiedShopper(data.accessToken);
  const r = await db.rpc("commerce_quote", {
    payload: {
      items: data.items,
      coupon_code: data.coupon_code,
      verified_user_id: user?.id,
      verified_user_email: user?.email,
    } as Json,
  });
  if (r.error) throw new Error(r.error.message);
  const q = r.data as {
    amount: number;
    discount: number;
    items: {
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }[];
  };
  return {
    amount: q.amount,
    discount: q.discount,
    items: q.items.map(({ product_id, product_name, quantity, unit_price, line_total }) => ({
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total,
    })),
  };
}
export async function loadRepeatPurchase(data: { orderId: string; token: string }) {
  const secret = process.env.ORDER_ACCESS_SECRET;
  if (!secret || !verifyOrderAccess(data.orderId, data.token, secret))
    throw new Error("Enlace de compra inválido.");
  const o = await supabaseAdmin
    .from("orders")
    .select("status,mp_payment_id")
    .eq("id", data.orderId)
    .single();
  if (
    o.error ||
    !o.data?.mp_payment_id ||
    !["paid", "preparing", "shipped", "delivered"].includes(o.data.status)
  )
    throw new Error("La compra no tiene pago confirmado.");
  const rows = await supabaseAdmin
    .from("order_items")
    .select("product_id,quantity")
    .eq("order_id", data.orderId);
  if (rows.error) throw new Error("No se pudo leer la compra.");
  const quantities = new Map<string, number>();
  for (const i of rows.data ?? [])
    if (i.product_id)
      quantities.set(i.product_id, (quantities.get(i.product_id) ?? 0) + i.quantity);
  if (!quantities.size) return { items: [], unavailable: rows.data?.length ?? 0 };
  const p = await supabaseAdmin
    .from("products")
    .select("id,slug,name,price,stock,image_urls")
    .in("id", [...quantities.keys()])
    .eq("is_active", true)
    .gt("stock", 0)
    .gt("price", 0);
  if (p.error) throw new Error("No se pudo verificar el stock.");
  return {
    items: (p.data ?? []).map((i) => ({
      productId: i.id,
      slug: i.slug,
      name: i.name,
      price: Number(i.price),
      quantity: Math.min(quantities.get(i.id) ?? 1, i.stock, 50),
      maxStock: i.stock,
      imageUrl: i.image_urls[0] ?? null,
    })),
    unavailable: quantities.size - (p.data?.length ?? 0),
  };
}
