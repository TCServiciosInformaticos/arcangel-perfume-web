import {test} from "node:test";
import assert from "node:assert/strict";
import {buildPaidOrderEmail, type PaidOrderSnapshot} from "./paid-order-email";
export const sample:PaidOrderSnapshot={order_number:1234,customer_name:'Cliente <script>alert(1)</script>',customer_email:'client@example.invalid',customer_whatsapp:'11111111',delivery_method:'pickup',pickup_branch:'peron',delivery_street:null,delivery_number:null,delivery_apartment:null,delivery_city:null,delivery_zip:null,delivery_day:null,delivery_time_slot:null,notes:'Sin bolsa & gracias',total:200,shipping_cost:0,needs_review:false,review_reason:null,items:[{product_name:'Shampoo <suave>',quantity:2,unit_price:100,line_total:200}]};
test('ventas siempre recibe; solo la sucursal de retiro puede recibir la preparación',()=>{
 assert.deepEqual(buildPaidOrderEmail(sample,'ventas').to,['ventas@perfumeriaelarcangel.com.ar']);
 assert.deepEqual(buildPaidOrderEmail(sample,'peron').to,['peron@perfumeriaelarcangel.com.ar']);
 assert.throws(()=>buildPaidOrderEmail(sample,'bogado'));
 assert.deepEqual(buildPaidOrderEmail({...sample,pickup_branch:'bogado'},'bogado').to,['bogado@perfumeriaelarcangel.com.ar']);
 const shipping={...sample,delivery_method:'shipping' as const,pickup_branch:null,delivery_street:'Calle',delivery_number:'100'};
 assert.match(buildPaidOrderEmail(shipping,'ventas').text,/Envío: Calle 100/);
 assert.throws(()=>buildPaidOrderEmail(shipping,'peron'));
 assert.throws(()=>buildPaidOrderEmail(shipping,'bogado'));
});
test('escapea datos del cliente y los productos e incluye cantidades, pago y sucursal',()=>{
 const email=buildPaidOrderEmail(sample,'peron');
 assert.ok(!email.html.includes('<script>'));
 assert.match(email.html,/&lt;script&gt;/);assert.match(email.html,/&lt;suave&gt;/);
 assert.match(email.text,/2 × Shampoo/);assert.match(email.text,/Total pagado/);assert.match(email.text,/Sucursal Perón/);
});
test('pago con revisión avisa a ventas y bloquea preparación en sucursal',()=>{
 const order={...sample,needs_review:true,review_reason:'Sin stock'};
 assert.match(buildPaidOrderEmail(order,'ventas').text,/No preparar hasta resolver: Sin stock/);
 assert.throws(()=>buildPaidOrderEmail(order,'peron'));
 assert.match(buildPaidOrderEmail({...sample,pickup_branch:'desconocida'},'ventas').text,/Sucursal sin identificar/);
});
