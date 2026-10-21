import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommerceDatabase } from "./commerce-client";
export function restockMailReady() {
  return (
    process.env.RESTOCK_EMAIL_ENABLED === "true" &&
    !!process.env.RESEND_API_KEY &&
    !!process.env.ORDER_RECOVERY_FROM_EMAIL &&
    /^https:\/\//.test(process.env.PUBLIC_SITE_URL ?? "")
  );
}
export async function processRestockMail() {
  if (!restockMailReady()) return { enabled: false, sent: 0, review: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as SupabaseClient<CommerceDatabase>;
  const r = await db.rpc("claim_stock_notifications");
  if (r.error) throw new Error("No se pudieron tomar avisos.");
  const claims = r.data as { id: string; user_id: string; product_id: string }[];
  let sent = 0,
    review = 0;
  for (const row of claims) {
    try {
      const [user, p, state] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(row.user_id),
        supabaseAdmin
          .from("products")
          .select("name,slug,is_active,stock")
          .eq("id", row.product_id)
          .single(),
        db.from("stock_notifications").select("state").eq("id", row.id).maybeSingle(),
      ]);
      if (state.data?.state !== "sending") continue;
      if (
        p.error ||
        !p.data?.is_active ||
        p.data.stock <= 0 ||
        user.error ||
        !user.data.user?.email_confirmed_at ||
        !user.data.user.email
      ) {
        await db
          .from("stock_notifications")
          .update({ state: "waiting", claimed_at: null })
          .eq("id", row.id)
          .eq("state", "sending");
        continue;
      }
      const url = new URL(
        `/producto/${encodeURIComponent(p.data.slug)}`,
        process.env.PUBLIC_SITE_URL,
      ).href;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `restock-${row.id}`,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          from: process.env.ORDER_RECOVERY_FROM_EMAIL,
          to: [user.data.user.email],
          subject: "Volvió un artículo que estabas esperando · El Arcángel",
          text: `Nos pediste que te avisemos: ${p.data.name} volvió a tener stock.\n\nPodés ver el precio y la disponibilidad actual acá:\n${url}\n\nLa disponibilidad puede cambiar. Este aviso se envía una sola vez por solicitud. Podés cancelar futuras solicitudes ingresando a tu cuenta desde la ficha del artículo.\nPerfumería El Arcángel`,
        }),
      });
      if (!response.ok) throw new Error("Proveedor sin confirmación");
      const body = await response.json();
      if (typeof body.id !== "string") throw new Error("Respuesta incompleta");
      const saved = await db
        .from("stock_notifications")
        .update({ state: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("state", "sending");
      if (saved.error) throw new Error("No se pudo guardar confirmación");
      sent++;
    } catch {
      review++;
      await db
        .from("stock_notifications")
        .update({ state: "review" })
        .eq("id", row.id)
        .eq("state", "sending");
    }
  }
  return { enabled: true, sent, review };
}
