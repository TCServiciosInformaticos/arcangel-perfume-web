import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!secret || !process.env.MERCADOPAGO_ACCESS_TOKEN) return new Response("Payment integration unavailable", { status: 503 });
        const url = new URL(request.url);
        const paymentId = url.searchParams.get("data.id");
        if (!paymentId || !/^\d{1,30}$/.test(paymentId)) return new Response("Invalid payment id", { status: 400 });
        const { verifyMercadoPagoSignature } = await import("@/lib/payment-security.server");
        if (!verifyMercadoPagoSignature(request.headers.get("x-signature"), request.headers.get("x-request-id"), paymentId, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }
        const type = url.searchParams.get("type");
        if (type && type !== "payment") return new Response("ignored", { status: 200 });
        try {
          const { syncMercadoPagoPayment } = await import("@/lib/payment-sync.server");
          await syncMercadoPagoPayment(paymentId);
          return new Response("ok", { status: 200 });
        } catch {
          console.error("Mercado Pago notification could not be processed");
          return new Response("Payment verification failed", { status: 503 });
        }
      },
    },
  },
});
