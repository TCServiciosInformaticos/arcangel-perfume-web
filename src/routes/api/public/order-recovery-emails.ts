import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/order-recovery-emails")({
  server: {
    handlers: {
      GET: async () => {
        const { recoveryEmailReadiness } = await import("@/lib/order-recovery-email.server");
        const readiness = recoveryEmailReadiness();
        let databaseFeature = false;
        if (readiness.ready) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const enabled = await supabaseAdmin.rpc("get_order_recovery_enabled");
            databaseFeature = !enabled.error && enabled.data === true;
          } catch {
            /* unavailable server configuration */
          }
        }
        return Response.json(
          {
            protocol: "order-recovery-email-v1",
            ready: readiness.ready && databaseFeature,
            checks: { ...readiness.checks, databaseFeature },
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
          const { processOrderRecoveryEmails } = await import("@/lib/order-recovery-email.server");
          const result = await processOrderRecoveryEmails();
          return Response.json(result, { status: result.failed ? 503 : 200 });
        } catch {
          return new Response(
            "Recovery email service not ready; no final abandonment without accepted reminder",
            { status: 503 },
          );
        }
      },
    },
  },
});
