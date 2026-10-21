import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, MessageCircle, XCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getOrderForWhatsapp } from "@/lib/order-read.functions";
import { buildOrderMessage, buildWhatsappLink } from "@/lib/whatsapp";
import { isPaymentConfirmed } from "@/lib/checkout-validation";
import { useCart } from "@/lib/cart-context";
import { resumeOrderCheckout, verifyOrderPayment } from "@/lib/checkout.functions";
import { canResumeOrder, orderStatusLabels } from "@/lib/order-lifecycle";
import { formatARS } from "@/lib/format";

export const orderReturnSearch = z.object({
  order: z.string().uuid().optional().catch(undefined),
  token: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional()
    .catch(undefined),
  payment_id: z.coerce
    .string()
    .regex(/^\d{1,30}$/)
    .optional()
    .catch(undefined),
});

export function OrderConfirmation({ order, token, payment_id }: z.infer<typeof orderReturnSearch>) {
  const readOrder = useServerFn(getOrderForWhatsapp);
  const resume = useServerFn(resumeOrderCheckout),
    verify = useServerFn(verifyOrderPayment);
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  async function paymentAction(action: "resume" | "verify") {
    if (!order || !token) return;
    setBusy(true);
    setActionError("");
    try {
      if (action === "resume") {
        const r = await resume({ data: { orderId: order, token } });
        window.sessionStorage.setItem("arcangel-pending-order", JSON.stringify({ orderId: order }));
        window.location.assign(r.init_point);
      } else {
        await verify({ data: { orderId: order, token } });
        setPolls(0);
        await query.refetch();
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "No pudimos procesar la solicitud.");
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  const { clear } = useCart();
  const [polls, setPolls] = useState(0);
  const query = useQuery(
    queryOptions({
      queryKey: ["checkout-return", order, token, payment_id],
      enabled: Boolean(order && token),
      queryFn: async () => {
        if (!order || !token) return null;
        setPolls((value) => value + 1);
        return readOrder({ data: { orderId: order, token, paymentId: payment_id } });
      },
      retry: false,
      refetchInterval: (q) =>
        q.state.data &&
        ["pending_payment", "recovery_notified"].includes(q.state.data.status) &&
        polls < 20
          ? 4000
          : false,
    }),
  );
  const result = query.data;
  const paid = result && isPaymentConfirmed(result.status, result.order.mp_payment_id);
  const cancelled = result?.status === "cancelled";
  const link =
    paid && result.storeWhatsapp
      ? buildWhatsappLink(result.storeWhatsapp, buildOrderMessage(result.order))
      : null;

  useEffect(() => {
    if (!paid || !order) return;
    const stored =
      window.sessionStorage.getItem("arcangel-pending-order") ||
      window.localStorage.getItem("arcangel-checkout-recovery");
    if (stored) {
      try {
        if (JSON.parse(stored).orderId === order) {
          clear();
          try {
            const recovery = JSON.parse(
              window.localStorage.getItem("arcangel-checkout-recovery") || "null",
            );
            if (recovery?.orderId === order)
              window.localStorage.removeItem("arcangel-checkout-recovery");
          } catch {
            /* keep other checkouts */
          }
          window.sessionStorage.removeItem("arcangel-pending-order");
        }
      } catch {
        /* Retain cart if no matching checkout is available. */
      }
    }
  }, [paid, order, clear]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center sm:px-6">
        {query.isFetching && !result ? (
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        ) : paid ? (
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        ) : cancelled ? (
          <XCircle className="mx-auto h-14 w-14 text-destructive" />
        ) : (
          <Clock className="mx-auto h-14 w-14 text-primary" />
        )}
        <h1 className="mt-4 text-3xl font-bold tracking-normal">
          {paid
            ? "¡Gracias por tu compra!"
            : cancelled
              ? "El pago no pudo procesarse"
              : "Confirmación de tu pedido"}
        </h1>
        {!order || !token ? (
          <p className="mt-4 text-destructive">
            Abrí el enlace que recibiste al finalizar la compra para consultar tu pedido.
          </p>
        ) : query.error ? (
          <div className="mt-4">
            <p role="alert" className="text-destructive">
              {query.error.message}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => query.refetch()}>
              Volver a verificar
            </Button>
          </div>
        ) : query.isFetching && !result ? (
          <p className="mt-4 text-muted-foreground">Verificando el pago con Mercado Pago…</p>
        ) : !result ? (
          <p className="mt-4 text-destructive">Pedido no encontrado.</p>
        ) : (
          <>
            <p className="mt-4 text-muted-foreground">
              Pedido #{result.order.order_number} · {formatARS(result.order.total)}
            </p>
            <p className="mt-2 font-medium">{orderStatusLabels[result.status] ?? result.status}</p>
            <p className="mt-4">
              {paid
                ? "Pago aprobado por Mercado Pago."
                : cancelled
                  ? "Tu carrito sigue guardado para volver a intentar el pago."
                  : result.status === "abandoned_final"
                    ? "El plazo de recuperación de este pedido finalizó. Podés iniciar una nueva compra desde el catálogo."
                    : result.status === "recovery_notified"
                      ? "Te enviamos un recordatorio para retomar tu pedido. El plazo es de 24 horas desde el aviso."
                      : result.status === "abandoned"
                        ? "Este pedido venció por falta de pago. Podés retomarlo con los precios y la disponibilidad actuales."
                        : result.status === "payment_rejected"
                          ? "Mercado Pago rechazó el intento. Podés volver a pagar este mismo pedido."
                          : "Tu pago todavía está pendiente de confirmación de Mercado Pago."}
            </p>
            {link && (
              <Button
                asChild
                size="lg"
                className="mt-8 h-auto min-h-12 w-full whitespace-normal bg-whatsapp text-ink hover:bg-whatsapp/90"
              >
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Enviar pedido al dueño por WhatsApp
                </a>
              </Button>
            )}
            {link && (
              <p className="mt-3 text-sm text-muted-foreground">
                El mensaje queda preparado con tus datos, productos y entrega; tocá Enviar en
                WhatsApp para confirmarlo.
              </p>
            )}
            {!paid && (
              <Button
                variant="outline"
                disabled={busy || query.isFetching}
                className="mt-6"
                onClick={() => paymentAction("verify")}
              >
                Verificar estado del pago
              </Button>
            )}
            {canResumeOrder(result.status) && (
              <div className="mt-4">
                <Button disabled={busy} onClick={() => paymentAction("resume")}>
                  {busy ? "Verificando…" : "Retomar pago de este pedido"}
                </Button>
                <p className="mt-2 text-sm text-muted-foreground">
                  Al generar un nuevo intento se verifican precios y stock actuales. La reserva dura
                  30 minutos.
                </p>
              </div>
            )}
            {actionError && (
              <p role="alert" className="mt-3 text-destructive">
                {actionError}
              </p>
            )}
            {cancelled && (
              <Button asChild className="mt-6">
                <Link to="/carrito">Volver a intentar</Link>
              </Button>
            )}
          </>
        )}
        <Link to="/productos" className="mt-10 inline-block text-primary underline">
          Volver al catálogo
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
