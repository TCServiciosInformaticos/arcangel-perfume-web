import { createFileRoute } from "@tanstack/react-router";

// MercadoPago payment webhook. MP sends a POST when a payment event occurs.
// We fetch the payment by id, read external_reference (= our order id), and update status.
export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
          let type = url.searchParams.get("type") || url.searchParams.get("topic");

          const ctype = request.headers.get("content-type") ?? "";
          if (ctype.includes("application/json")) {
            try {
              const body = (await request.json()) as { type?: string; action?: string; data?: { id?: string } };
              paymentId = paymentId ?? body?.data?.id ?? null;
              type = type ?? body?.type ?? body?.action ?? null;
            } catch { /* ignore body */ }
          }

          if (!paymentId || (type && !String(type).includes("payment"))) {
            return new Response("ignored", { status: 200 });
          }

          const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
          if (!accessToken) {
            console.error("MERCADOPAGO_ACCESS_TOKEN missing");
            return new Response("missing token", { status: 200 });
          }

          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!mpRes.ok) {
            console.error("MP payment fetch failed", mpRes.status, await mpRes.text());
            return new Response("upstream error", { status: 200 });
          }
          const payment = (await mpRes.json()) as {
            id: number | string;
            status: string;
            external_reference?: string;
          };

          const orderId = payment.external_reference;
          if (!orderId) return new Response("no ref", { status: 200 });

          const newStatus =
            payment.status === "approved" ? "paid" :
            payment.status === "rejected" || payment.status === "cancelled" ? "cancelled" :
            "pending_payment";

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("orders")
            .update({ status: newStatus, mp_payment_id: String(payment.id) })
            .eq("id", orderId);

          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("Webhook error", e);
          // Always 200 so MP doesn't retry forever on a permanent bug
          return new Response("error", { status: 200 });
        }
      },
    },
  },
});
