import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPaidOrderEmail, paidOrderSnapshotSchema, PAID_ORDER_RECIPIENTS } from "./paid-order-email";
import type { Json } from "@/integrations/supabase/types";

const payloadSchema = z.object({from:z.string(),to:z.array(z.email()).length(1),subject:z.string(),text:z.string(),html:z.string()});
const jobSchema = z.object({id:z.uuid(),order_id:z.uuid(),lease_token:z.uuid(),recipient:z.enum(["ventas","bogado","peron"]),snapshot:paidOrderSnapshotSchema,payload:payloadSchema.nullable()});
export function paidOrderEmailReadiness() {
  const from = process.env.ORDER_NOTIFICATION_FROM_EMAIL ?? "";
  const address = from.match(/<([^<>]+)>$/)?.[1] ?? from;
  const checks = {
    enabled: process.env.ORDER_NOTIFICATION_EMAIL_ENABLED === "true",
    provider: !!process.env.RESEND_API_KEY,
    sender: !/[\r\n]/.test(from) && z.email().safeParse(address).success,
    database: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  return {ready:Object.values(checks).every(Boolean),checks};
}
class ProviderError extends Error { constructor(readonly permanent:boolean) {super("Email no confirmado");} }
export async function processPaidOrderEmails(orderId?:string) {
  if (!paidOrderEmailReadiness().ready) return {enabled:false,sent:0,failed:0,skipped:0};
  let sent=0,failed=0,skipped=0;
  for(let i=0;i<(orderId?2:4);i++) {
    const claim=await supabaseAdmin.rpc("claim_paid_order_email",{oid:orderId??undefined});
    if(claim.error) throw claim.error;
    if(!claim.data) break;
    // Parse identifiers first so malformed snapshots can be recorded as a failure.
    const identity=z.object({id:z.uuid(),lease_token:z.uuid()}).parse(claim.data);
    let stage="prepare";
    try {
      const job=jobSchema.parse(claim.data);
      let payload=job.payload;
      if(!payload) {
        const body={from:process.env.ORDER_NOTIFICATION_FROM_EMAIL!,...buildPaidOrderEmail(job.snapshot,job.recipient)};
        const frozen=await supabaseAdmin.rpc("prepare_paid_order_email",{eid:job.id,lease:job.lease_token,body:body as Json});
        if(frozen.error) throw frozen.error;
        payload=payloadSchema.parse(frozen.data);
      }
      if(payload.to[0]!==PAID_ORDER_RECIPIENTS[job.recipient]) throw new ProviderError(true);
      const gate=await supabaseAdmin.rpc("authorize_paid_order_send",{eid:job.id,lease:job.lease_token});
      if(gate.error) throw gate.error;
      if(!gate.data) {skipped++;continue;}
      stage="provider";
      const response=await fetch("https://api.resend.com/emails",{
        method:"POST",signal:AbortSignal.timeout(20000),
        headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`paid-order/${job.id}`},
        body:JSON.stringify(payload),
      });
      if(!response.ok) throw new ProviderError(response.status>=400&&response.status<500&&![408,409,429].includes(response.status));
      const provider=z.object({id:z.string().min(1)}).parse(await response.json());
      stage="confirm";
      const done=await supabaseAdmin.rpc("finish_paid_order_email",{eid:job.id,lease:job.lease_token,provider_id:provider.id});
      if(done.error) throw done.error;
      sent++;
    } catch(error) {
      // Never log payloads, customer details, provider responses or credentials.
      const result=await supabaseAdmin.rpc("fail_paid_order_email",{eid:identity.id,lease:identity.lease_token,
        permanent:(error instanceof ProviderError&&error.permanent)||(stage==="prepare"&&error instanceof z.ZodError)});
      if(result.error) throw result.error;
      failed++;
    }
  }
  return {enabled:true,sent,failed,skipped};
}
