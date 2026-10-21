import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildRecoveryEmail } from "./order-recovery-email";
import { signOrderAccess } from "./payment-security.server";
import { reconcileOrder } from "./payment-sync.server";
import type { Json } from "@/integrations/supabase/types";
const payloadSchema = z.object({
  from: z.string(),
  to: z.array(z.email()).length(1),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});
const claimSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  lease_token: z.string().uuid(),
  payload: payloadSchema.nullable(),
});
export function recoveryEmailReadiness() {
  const origin = process.env.PUBLIC_SITE_URL;
  let validOrigin = false;
  try {
    const u = new URL(origin ?? "");
    validOrigin = u.protocol === "https:" && !u.username && !u.password;
  } catch {
    /* require configured public origin */
  }
  const from = process.env.ORDER_RECOVERY_FROM_EMAIL ?? "";
  const address = from.match(/<([^<>]+)>$/)?.[1] ?? from;
  const validFrom = !/[\r\n]/.test(from) && z.email().safeParse(address).success;
  const checks = {
    enabled: process.env.ORDER_RECOVERY_EMAIL_ENABLED === "true",
    provider: !!process.env.RESEND_API_KEY,
    sender: validFrom,
    siteOrigin: validOrigin,
    orderAccess: !!process.env.ORDER_ACCESS_SECRET,
    paymentAccess: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
    paymentWebhook: !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
    database: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  return { ready: Object.values(checks).every(Boolean), checks };
}
export class RecoverySendError extends Error {
  constructor(public readonly permanent: boolean) {
    super("El proveedor no aceptó el email.");
  }
}
export async function sendRecoveryEmail(payload: z.infer<typeof payloadSchema>, key: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok)
    throw new RecoverySendError(
      response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status),
    );
  return z.object({ id: z.string().min(1) }).parse(await response.json()).id;
}
export async function processOrderRecoveryEmails() {
  if (!recoveryEmailReadiness().ready)
    throw new Error("Falta habilitar o configurar el correo de recuperación.");
  let sent = 0,
    skipped = 0,
    failed = 0;
  for (let i = 0; i < 5; i++) {
    const claimed = await supabaseAdmin.rpc("claim_order_recovery_email");
    if (claimed.error) throw claimed.error;
    if (!claimed.data) break;
    const job = claimSchema.parse(claimed.data);
    let stage = "payment_verification";
    try {
      // Fail closed if Mercado Pago cannot confirm that the order is still unpaid.
      await reconcileOrder(job.order_id);
      stage = "prepare";
      let payload = job.payload;
      if (!payload) {
        const order = await supabaseAdmin
          .from("orders")
          .select("order_number,customer_name,customer_email")
          .eq("id", job.order_id)
          .single();
        if (order.error || !order.data) throw new Error("No se pudo consultar el pedido.");
        const email = z.email().parse(order.data.customer_email);
        const settings = await supabaseAdmin
          .from("settings")
          .select("store_name")
          .eq("id", 1)
          .single();
        if (settings.error || !settings.data) throw new Error("No se pudo consultar la tienda.");
        const origin = new URL(process.env.PUBLIC_SITE_URL!).origin;
        const url = `${origin}/pago-pendiente?order=${job.order_id}&token=${signOrderAccess(job.order_id, process.env.ORDER_ACCESS_SECRET!)}`;
        const body = {
          from: process.env.ORDER_RECOVERY_FROM_EMAIL!,
          to: [email],
          ...buildRecoveryEmail({
            name: order.data.customer_name,
            orderNumber: order.data.order_number,
            recoveryUrl: url,
            storeName: settings.data.store_name.replace(/[\r\n]/g, " "),
          }),
        };
        const frozen = await supabaseAdmin.rpc("prepare_order_recovery_email", {
          eid: job.id,
          lease: job.lease_token,
          body: body as Json,
        });
        if (frozen.error) throw frozen.error;
        payload = payloadSchema.parse(frozen.data);
      }
      const gate = await supabaseAdmin.rpc("authorize_order_recovery_send", {
        eid: job.id,
        lease: job.lease_token,
      });
      if (gate.error) throw gate.error;
      if (!gate.data) {
        skipped++;
        continue;
      }
      stage = "provider";
      const id = await sendRecoveryEmail(payload, `order-recovery/${job.id}`);
      stage = "confirm";
      const accepted = await supabaseAdmin.rpc("finish_order_recovery_email", {
        eid: job.id,
        lease: job.lease_token,
        provider_id: id,
      });
      if (accepted.error) throw accepted.error;
      sent++;
    } catch (e) {
      // Never log the API key, customer address, signed link, or provider response body.
      const permanent =
        (e instanceof RecoverySendError && e.permanent) ||
        (stage === "prepare" && e instanceof z.ZodError);
      const recorded = await supabaseAdmin.rpc("fail_order_recovery_email", {
        eid: job.id,
        lease: job.lease_token,
        error_code:
          stage === "payment_verification"
            ? "No se pudo verificar el pago; envío postergado"
            : stage === "confirm"
              ? "El proveedor pudo aceptar el email; confirmación pendiente"
              : permanent
                ? "Email rechazado: revisar destinatario o remitente"
                : "Envío temporalmente fallido; se reintentará",
        permanent,
      });
      if (recorded.error) throw recorded.error;
      failed++;
    }
  }
  return { sent, skipped, failed };
}
