import { z } from "zod";
import { branchLabel } from "./branches";

export const PAID_ORDER_RECIPIENTS = {
  ventas: "ventas@perfumeriaelarcangel.com.ar",
  bogado: "bogado@perfumeriaelarcangel.com.ar",
  peron: "peron@perfumeriaelarcangel.com.ar",
} as const;
export const paidOrderSnapshotSchema = z.object({
  order_number: z.number().int(), customer_name: z.string(), customer_email: z.string(),
  customer_whatsapp: z.string(), delivery_method: z.enum(["pickup", "shipping"]),
  pickup_branch: z.string().nullable(),
  delivery_street: z.string().nullable(), delivery_number: z.string().nullable(),
  delivery_apartment: z.string().nullable(), delivery_city: z.string().nullable(),
  delivery_zip: z.string().nullable(), delivery_day: z.string().nullable(),
  delivery_time_slot: z.string().nullable(), notes: z.string().nullable(),
  total: z.number().finite().nonnegative(), shipping_cost: z.number().finite().nonnegative(),
  needs_review: z.boolean(), review_reason: z.string().nullable(),
  items: z.array(z.object({ product_name: z.string(), quantity: z.number().int().positive(),
    unit_price: z.number().finite().nonnegative(), line_total: z.number().finite().nonnegative() })).min(1),
});
export type PaidOrderSnapshot = z.infer<typeof paidOrderSnapshotSchema>;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const money = (n: number) => new Intl.NumberFormat("es-AR", {style:"currency",currency:"ARS"}).format(n);

export function buildPaidOrderEmail(order: PaidOrderSnapshot, recipient: keyof typeof PAID_ORDER_RECIPIENTS) {
  if (recipient !== "ventas" && (order.delivery_method !== "pickup" || order.pickup_branch !== recipient || order.needs_review))
    throw new Error("La sucursal no puede preparar este pedido.");
  const branch = branchLabel(order.pickup_branch);
  const warning = order.needs_review ? `ATENCIÓN: requiere revisión. No preparar hasta resolver: ${order.review_reason ?? "Revisar en el admin"}` : "";
  const delivery = order.delivery_method === "pickup"
    ? `Retiro: ${branch ?? "Sucursal sin identificar: revisar en el admin antes de preparar"}`
    : `Envío: ${[order.delivery_street,order.delivery_number,order.delivery_apartment,order.delivery_city,order.delivery_zip].filter(Boolean).join(" ")}`;
  const lines = [
    `Pedido #${order.order_number} — Pago confirmado`,
    warning,
    recipient === "ventas" ? "Nuevo pedido con pago confirmado." : "Preparar este pedido para retirar en la sucursal.",
    `Cliente: ${order.customer_name}`, `Email: ${order.customer_email}`, `WhatsApp: ${order.customer_whatsapp}`,
    delivery,
    order.delivery_method === "shipping" ? `Entrega: ${[order.delivery_day,order.delivery_time_slot].filter(Boolean).join(" · ") || "Coordinar con el cliente"}` : "",
    "", "Productos:",
    ...order.items.map(i => `${i.quantity} × ${i.product_name} — ${money(i.unit_price)} c/u — ${money(i.line_total)}`),
    `Envío: ${money(order.shipping_cost)}`, `Total pagado: ${money(order.total)}`,
    order.notes ? `Observaciones del cliente: ${order.notes}` : "",
    "", "Consultá el pedido en el panel de administración con tu cuenta de empleado.",
  ].filter(s=>s!=="");
  return {
    to: [PAID_ORDER_RECIPIENTS[recipient]],
    subject: `${warning ? "Revisar · " : ""}Pedido #${order.order_number} pagado${recipient === "ventas" ? "" : ` · Retiro ${recipient === "peron" ? "Perón" : "Bogado"}`}`,
    text: lines.join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:680px;color:#291526"><h1 style="color:#ce0874">Pedido #${order.order_number}</h1>${lines.map(s=>`<p style="white-space:pre-wrap">${escape(s)}</p>`).join("")}</div>`,
  };
}
