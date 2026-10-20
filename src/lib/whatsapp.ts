import { branchLabel } from "@/lib/branches";

// Build a wa.me click-to-chat link with a pre-filled message.
// Phone must be E.164 digits only, no + or spaces.
export function buildWhatsappLink(phone: string, message: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

export type OrderForWhatsapp = {
  order_number: number;
  customer_name: string;
  customer_email: string;
  customer_whatsapp: string;
  delivery_method: "pickup" | "shipping";
  delivery_street: string | null;
  delivery_number: string | null;
  delivery_apartment: string | null;
  delivery_city: string | null;
  delivery_zip: string | null;
  delivery_day: string | null;
  delivery_time_slot: "morning" | "afternoon" | "evening" | null;
  notes: string | null;
  pickup_branch?: string | null;
  subtotal: number | string;
  shipping_cost: number | string;
  total: number | string;
  mp_payment_id: string | null;
  items: Array<{ product_name: string; quantity: number; unit_price: number | string }>;
};

const SLOT_LABEL: Record<string, string> = {
  morning: "Mañana (9–13 h)",
  afternoon: "Tarde (13–18 h)",
  evening: "Noche (18–21 h)",
};

const fmtMoney = (v: number | string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(
    Number(v) || 0,
  );

export function buildOrderMessage(o: OrderForWhatsapp): string {
  const lines: string[] = [];
  lines.push(`🛍️ *Nuevo pedido #${o.order_number}* — Perfumería El Arcángel`);
  lines.push("");
  lines.push(`👤 *Cliente:* ${o.customer_name}`);
  lines.push(`✉️ Email: ${o.customer_email}`);
  lines.push(`📱 WhatsApp: ${o.customer_whatsapp}`);
  lines.push("");
  if (o.delivery_method === "pickup") {
    lines.push("🏬 *Retira en sucursal*");
    const branch = branchLabel(o.pickup_branch);
    if (branch) lines.push(`📍 ${branch}`);
  } else {
    lines.push("🚚 *Envío a domicilio*");
    const addr = [
      o.delivery_street,
      o.delivery_number,
      o.delivery_apartment ? `dpto. ${o.delivery_apartment}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`📍 ${addr}`);
    lines.push(`${o.delivery_city ?? ""}${o.delivery_zip ? ` — CP ${o.delivery_zip}` : ""}`);
    if (o.delivery_day) lines.push(`📅 Día: ${o.delivery_day}`);
    if (o.delivery_time_slot) lines.push(`🕐 Franja: ${SLOT_LABEL[o.delivery_time_slot]}`);
  }
  if (o.notes) {
    lines.push("");
    lines.push(`📝 Notas: ${o.notes}`);
  }
  lines.push("");
  lines.push("*Productos:*");
  for (const it of o.items) {
    lines.push(` • ${it.quantity}× ${it.product_name} — ${fmtMoney(Number(it.unit_price) * it.quantity)}`);
  }
  lines.push("");
  lines.push(`Subtotal: ${fmtMoney(o.subtotal)}`);
  if (Number(o.shipping_cost) > 0) lines.push(`Envío: ${fmtMoney(o.shipping_cost)}`);
  lines.push(`*Total: ${fmtMoney(o.total)}*`);
  lines.push("");
  lines.push(`✅ Pago aprobado (MercadoPago${o.mp_payment_id ? ` — id ${o.mp_payment_id}` : ""})`);
  return lines.join("\n");
}
