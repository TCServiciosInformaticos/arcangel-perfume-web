import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/order-maintenance")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            protocol: "order-lifecycle-v1",
            configuration: {
              databaseUrl: !!process.env.SUPABASE_URL,
              databaseServerKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
              paymentAccessToken: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
              webhookSecret: !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
              orderAccessSecret: !!process.env.ORDER_ACCESS_SECRET,
              siteOrigin: process.env.PUBLIC_SITE_URL
                ? new URL(process.env.PUBLIC_SITE_URL).origin
                : null,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        ),
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
        if (!token || !/^[a-f0-9]{64}$/.test(token))
          return new Response("Unauthorized", { status: 401 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const allowed = await supabaseAdmin.rpc("authorize_order_job", { provided_token: token });
          if (allowed.error || !allowed.data) return new Response("Unauthorized", { status: 401 });
          const { reconcilePendingBatch } = await import("@/lib/payment-sync.server");
          const count = await reconcilePendingBatch();
          return Response.json({ reconciled: count });
        } catch {
          return new Response("Reconciliation incomplete; retry required", { status: 503 });
        }
      },
    },
  },
});
