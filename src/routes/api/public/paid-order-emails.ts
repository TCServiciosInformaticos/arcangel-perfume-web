import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/paid-order-emails")({
  server: { handlers: {
    GET: async () => {
      const { paidOrderEmailReadiness } = await import("@/lib/paid-order-email.server");
      return Response.json({protocol:"paid-order-email-v1",...paidOrderEmailReadiness()}, {headers:{"Cache-Control":"no-store"}});
    },
    POST: async ({ request }) => {
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
      if(!token || !/^[a-f0-9]{64}$/.test(token)) return new Response("Unauthorized",{status:401});
      try {
        const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
        const allowed=await supabaseAdmin.rpc("authorize_order_job",{provided_token:token});
        if(allowed.error||!allowed.data) return new Response("Unauthorized",{status:401});
        const {processPaidOrderEmails}=await import("@/lib/paid-order-email.server");
        const result=await processPaidOrderEmails();
        return Response.json(result,{status:result.failed?503:200});
      } catch {return new Response("Paid-order email service unavailable",{status:503});}
    },
  }},
});
