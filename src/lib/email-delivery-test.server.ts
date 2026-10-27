import { createHash, timingSafeEqual } from "node:crypto";
import { buildPaidOrderEmail, type PaidOrderSnapshot } from "./paid-order-email";
import { paidOrderEmailReadiness } from "./paid-order-email.server";

// Temporary, single-purpose, time-limited test. Only a SHA-256 digest is stored.
const digest = "852a539e4000d50da6468317e2d17b123fefda2207eba01eb54bec74de5f1ff4";
const expiresAt = 1793111391849;
const fixedKey = "delivery-test/852a539e4000d50da646";
function authorized(token:string) {
  if (Date.now() > expiresAt || !/^[0-9a-f]{64}$/.test(token)) return false;
  const actual=createHash("sha256").update(token).digest();
  return timingSafeEqual(actual,Buffer.from(digest,"hex"));
}
const sample: PaidOrderSnapshot = {
  order_number:999999, customer_name:"CLIENTE DE PRUEBA",customer_email:"prueba@example.invalid",customer_whatsapp:"0000000000",
  delivery_method:"pickup",pickup_branch:"peron",delivery_street:null,delivery_number:null,delivery_apartment:null,
  delivery_city:null,delivery_zip:null,delivery_day:null,delivery_time_slot:null,notes:"PRUEBA: NO ES UN PEDIDO REAL. NO PREPARAR.",
  total:100,shipping_cost:0,needs_review:false,review_reason:null,
  items:[{product_name:"Producto ficticio de prueba",quantity:1,unit_price:100,line_total:100}],
};
const mailHeaders=()=>({Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"});
export async function deliveryTest(request:Request) {
  const token=request.headers.get("x-delivery-test")??"";
  if (!authorized(token)) return new Response("Unauthorized",{status:401});
  if (!paidOrderEmailReadiness().ready) return Response.json({error:"email_not_configured"},{status:503});
  const data=await request.json().catch(()=>null);
  if (data?.action==="send") {
    const result=[];
    for (const {recipient,branch,number} of [
      {recipient:"ventas",branch:"peron",number:999991},
      {recipient:"peron",branch:"peron",number:999991},
      {recipient:"ventas",branch:"bogado",number:999992},
      {recipient:"bogado",branch:"bogado",number:999992},
    ] as const) {
      const order={...sample,order_number:number,pickup_branch:branch};
      const email=buildPaidOrderEmail(order,recipient);
      const body={from:process.env.ORDER_NOTIFICATION_FROM_EMAIL!,...email,
        subject:`PRUEBA — NO PREPARAR — ${email.subject}`,
        text:`ESTO ES UNA PRUEBA. NO ES UNA COMPRA REAL. NO PREPARAR.\n\n${email.text}`,
        html:`<h2>PRUEBA: NO ES UNA COMPRA REAL. NO PREPARAR.</h2>${email.html}`};
      try {
        const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{...mailHeaders(),"Idempotency-Key":`${fixedKey}/${number}/${recipient}`},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
        if(!r.ok) {result.push({recipient,order:number,accepted:false,status:r.status});continue;}
        const response=await r.json();
        if(typeof response.id!=="string" || !/^[a-zA-Z0-9-]{1,80}$/.test(response.id)) {result.push({recipient,order:number,accepted:false,status:"invalid_response"});continue;}
        result.push({recipient,order:number,accepted:true,id:response.id});
      } catch {result.push({recipient,order:number,accepted:false,status:"network_error"});}
    }
    return Response.json({result},{headers:{"Cache-Control":"no-store"}});
  }
  if(data?.action==="status" && Array.isArray(data.ids) && data.ids.length<=3) {
    const result=[];
    for (const id of data.ids) {
      if(typeof id!=="string"||!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return new Response("Invalid request",{status:400});
      try {
        const r=await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`,{headers:mailHeaders(),signal:AbortSignal.timeout(10000)});
        if(!r.ok){result.push({id,status:"unavailable",http:r.status});continue;}
        const x=await r.json();result.push({id,status:typeof x.last_event==="string"?x.last_event:"unknown"});
      }catch{result.push({id,status:"unavailable"});}
    }
    return Response.json({result},{headers:{"Cache-Control":"no-store"}});
  }
  return new Response("Invalid request",{status:400});
}
