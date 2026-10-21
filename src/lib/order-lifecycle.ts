export const orderStatusLabels: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  payment_rejected: "Pago rechazado",
  abandoned: "Abandonado",
  cancelled: "Cancelado",
  paid: "Pagado",
  preparing: "En preparación",
  shipped: "Enviado",
  delivered: "Entregado",
};
export const canResumeOrder = (status: string) =>
  ["pending_payment", "payment_rejected", "abandoned"].includes(status);
export function validMercadoPagoCheckout(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      [
        "www.mercadopago.com.ar",
        "www.mercadopago.com",
        "sandbox.mercadopago.com.ar",
        "sandbox.mercadopago.com",
      ].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
export function paymentDecision(
  payment: {
    id: string | number;
    external_reference: string;
    currency_id: string;
    transaction_amount: number;
  },
  orderId: string,
  attempt: { total: number; preference_id: string | null },
  merchant: { preference_id: string; payments: { id: string | number }[] },
): boolean {
  return (
    payment.external_reference === orderId &&
    payment.currency_id === "ARS" &&
    Number.isFinite(payment.transaction_amount) &&
    Math.round(payment.transaction_amount * 100) === Math.round(attempt.total * 100) &&
    merchant.preference_id === attempt.preference_id &&
    merchant.payments.some((p) => String(p.id) === String(payment.id))
  );
}

export const orderEventLabels: Record<string, string> = {
  checkout_reserved: "Reserva y nuevo intento de pago",
  payment_approved: "Pago aprobado",
  payment_rejected: "Intento de pago rechazado o cancelado",
  duplicate_payment: "Otro pago aprobado: requiere revisión",
  abandoned: "Pedido abandonado por falta de pago",
  admin_archive: "Pedido archivado",
  admin_unarchive: "Pedido desarchivado",
  admin_cancel: "Cancelado por administrador",
  admin_preparing: "En preparación",
  admin_shipped: "Enviado",
  admin_delivered: "Entregado",
  admin_resolve_stock: "Stock verificado y descontado",
  admin_resolve_review: "Revisión resuelta",
};
export const attemptStateLabels: Record<string, string> = {
  preparing: "Generando enlace",
  ready: "Disponible para pagar",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  expired: "Vencido",
};
