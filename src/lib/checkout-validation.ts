import { z } from "zod";

export const CheckoutSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(50),
  customer_name: z.string().trim().min(2).max(120),
  customer_email: z.string().trim().email().max(160),
  customer_whatsapp: z.string().trim().regex(/^\+?[\d\s()-]{8,30}$/, "Ingresá un WhatsApp válido"),
  delivery_method: z.enum(["pickup", "shipping"]),
  delivery_street: z.string().trim().max(160).nullable().optional(),
  delivery_number: z.string().trim().max(20).nullable().optional(),
  delivery_apartment: z.string().trim().max(40).nullable().optional(),
  delivery_city: z.string().trim().max(80).nullable().optional(),
  delivery_zip: z.string().trim().max(20).nullable().optional(),
  delivery_day: z.string().trim().max(40).nullable().optional(),
  delivery_time_slot: z.enum(["morning", "afternoon", "evening"]).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).superRefine((data, ctx) => {
  if (new Set(data.items.map((item) => item.productId)).size !== data.items.length) {
    ctx.addIssue({ code: "custom", path: ["items"], message: "El carrito contiene productos repetidos" });
  }
  if (data.delivery_method === "shipping") {
    for (const field of ["delivery_street", "delivery_number", "delivery_city"] as const) {
      if (!data[field]) ctx.addIssue({ code: "custom", path: [field], message: "Completá la dirección de envío" });
    }
  }
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export function isPaymentConfirmed(status: string, paymentId: string | null): boolean {
  return Boolean(paymentId) && ["paid", "preparing", "shipped", "delivered"].includes(status);
}

export function paymentMatchesOrder(payment: { external_reference?: string; currency_id?: string; transaction_amount?: number }, order: { id: string; total: number }): boolean {
  return payment.external_reference === order.id && payment.currency_id === "ARS" &&
    Number.isFinite(payment.transaction_amount) && Math.round(Number(payment.transaction_amount) * 100) === Math.round(order.total * 100);
}