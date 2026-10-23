/** Customer-facing wording; payment confirmation always comes from verified server state. */
export function orderConfirmationCopy(status: string | undefined, paymentConfirmed: boolean) {
  if (paymentConfirmed) {
    const messages: Record<string, string> = {
      preparing: "Recibimos tu pago y estamos preparando tu pedido.",
      shipped: "Recibimos tu pago. Tu pedido figura como enviado.",
      delivered: "Recibimos tu pago. Tu pedido figura como entregado. ¡Gracias por elegirnos!",
    };
    return {
      title: "¡Gracias por tu compra!",
      label:
        (
          {
            preparing: "En preparación",
            shipped: "Pedido enviado",
            delivered: "Pedido entregado",
          } as Record<string, string>
        )[status ?? ""] ?? "Pago aprobado",
      description:
        messages[status ?? ""] ?? "Recibimos tu pago. Tu pedido ya está registrado en El Arcángel.",
    };
  }
  switch (status) {
    case "cancelled":
      return {
        title: "Tu pedido fue cancelado",
        label: "Pedido cancelado",
        description:
          "Este pedido está cancelado. Podés revisar tu carrito o volver al catálogo para iniciar una nueva compra.",
      };
    case "abandoned_final":
      return {
        title: "El plazo de tu pedido finalizó",
        label: "Pedido vencido",
        description:
          "El plazo para retomar este pedido terminó. Si querés comprar estos productos, iniciá una nueva compra desde el catálogo.",
      };
    case "payment_rejected":
      return {
        title: "Tu pago no fue aprobado",
        label: "Pago no aprobado",
        description:
          "Este intento de pago no fue aprobado por Mercado Pago. Podés volver a intentarlo en el mismo pedido.",
      };
    case "abandoned":
    case "recovery_pending":
    case "recovery_notified":
      return {
        title: "Todavía podés completar tu compra",
        label: "Pedido pendiente de pago",
        description:
          "No tenemos un pago confirmado para este pedido. Podés retomarlo desde esta página; revisaremos los precios y la disponibilidad antes de continuar.",
      };
    default:
      return {
        title: status ? "Estamos verificando tu pago" : "Estado de tu pedido",
        label: "Pago pendiente de confirmación",
        description:
          "Tu pedido está registrado, pero todavía no tenemos la confirmación del pago. Si ya pagaste, consultá el estado antes de volver a intentarlo.",
      };
  }
}
