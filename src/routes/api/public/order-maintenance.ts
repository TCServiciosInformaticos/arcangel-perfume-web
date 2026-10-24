import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/order-maintenance")({
  server: {
    handlers: {
      GET: async () => {
        const { paidOrderEmailReadiness } = await import("@/lib/paid-order-email.server");
        return Response.json(
          {
            protocol: "order-lifecycle-v1",
            paidOrderEmails: paidOrderEmailReadiness(),
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
        );
      },
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
        if (!token || !/^[a-f0-9]{64}$/.test(token))
          return new Response("Unauthorized", { status: 401 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const allowed = await supabaseAdmin.rpc("authorize_order_job", { provided_token: token });
          if (allowed.error || !allowed.data) return new Response("Unauthorized", { status: 401 });
          const { reconcilePendingBatch } = await import("@/lib/payment-sync.server");
          // Retry queued emails even if reconciliation encounters a provider outage.
          let count = 0, reconciliationFailed = false;
          try { count = await reconcilePendingBatch(); } catch { reconciliationFailed = true; }
          const { processPaidOrderEmails } = await import("@/lib/paid-order-email.server");
          const emails = await processPaidOrderEmails();
          return Response.json({ reconciled: count, reconciliationFailed, paidOrderEmails: emails },
            { status: reconciliationFailed || emails.failed ? 503 : 200 });
        } catch {
          return new Response("Reconciliation incomplete; retry required", { status: 503 });
        }
      },
    },
  },
});
