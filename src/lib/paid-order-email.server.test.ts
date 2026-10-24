import {test} from "node:test";
import assert from "node:assert/strict";
import {sample} from "./paid-order-email.test";
test('envíos congelados, reintentos idempotentes y fallos de proveedor/confirmación independientes',async()=>{
 Object.assign(process.env,{SUPABASE_URL:'https://database.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-key',RESEND_API_KEY:'re_test',ORDER_NOTIFICATION_FROM_EMAIL:'Tienda <store@example.invalid>',ORDER_NOTIFICATION_EMAIL_ENABLED:'true'});
 const original=globalThis.fetch;
 const id='11111111-1111-4111-8111-111111111111',lease='22222222-2222-4222-8222-222222222222',oid='33333333-3333-4333-8333-333333333333';
 let claimed=false,payload:unknown=null,ackFail=false,providerFail=false,gate=true,finished=0,failed=0;
 const requests=new Map<string,string>();
 globalThis.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  const b=init?.body?JSON.parse(String(init.body)):null;
  if(url.includes('/rpc/claim_paid_order_email')){
   if(claimed)return Response.json(null);claimed=true;
   return Response.json({id,order_id:oid,lease_token:lease,recipient:'peron',snapshot:sample,payload});
  }
  if(url.includes('/rpc/prepare_paid_order_email')) {payload??=b.body;return Response.json(payload);}
  if(url.includes('/rpc/authorize_paid_order_send'))return Response.json(gate);
  if(url==='https://api.resend.com/emails'){
   if(providerFail)return new Response('temporary',{status:429});
   assert.deepEqual(b.to,['peron@perfumeriaelarcangel.com.ar']);
   const key=new Headers(init?.headers).get('Idempotency-Key')!;assert.equal(key,`paid-order/${id}`);
   if(requests.has(key))assert.equal(requests.get(key),JSON.stringify(b));
   requests.set(key,JSON.stringify(b));return Response.json({id:'email-1'});
  }
  if(url.includes('/rpc/finish_paid_order_email')){if(ackFail)return Response.json({message:'temporary'},{status:503});finished++;return new Response(null,{status:204});}
  if(url.includes('/rpc/fail_paid_order_email')){failed++;assert.equal(b.permanent,false);return new Response(null,{status:204});}
  throw new Error(`Unexpected test URL: ${url}`);
 };
 try {
  const {processPaidOrderEmails}=await import('./paid-order-email.server');
  ackFail=true;assert.equal((await processPaidOrderEmails(oid)).failed,1);assert.equal(finished,0);
  claimed=false;ackFail=false;assert.equal((await processPaidOrderEmails(oid)).sent,1);assert.equal(requests.size,1);
  claimed=false;providerFail=true;assert.equal((await processPaidOrderEmails(oid)).failed,1);assert.equal(finished,1);
  claimed=false;providerFail=false;gate=false;assert.equal((await processPaidOrderEmails(oid)).skipped,1);assert.equal(finished,1);
  process.env.ORDER_NOTIFICATION_EMAIL_ENABLED='false';claimed=false;
  assert.equal((await processPaidOrderEmails()).enabled,false);assert.equal(claimed,false);assert.equal(failed,2);
 }finally{globalThis.fetch=original;}
});
