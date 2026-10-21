import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/restock-notifications")({
  server: {
    handlers: {
      GET: async () => {
        const { restockMailReady } = await import("@/lib/restock-email.server");
        return Response.json(
          { enabled: restockMailReady() },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
        if (!token || !/^[a-f0-9]{64}$/.test(token))
          return new Response("Unauthorized", { status: 401 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const a = await supabaseAdmin.rpc("authorize_order_job", { provided_token: token });
          if (a.error || !a.data) return new Response("Unauthorized", { status: 401 });
          const { processRestockMail } = await import("@/lib/restock-email.server");
          return Response.json(await processRestockMail());
        } catch {
          return new Response("Servicio no disponible", { status: 503 });
        }
      },
    },
  },
});
