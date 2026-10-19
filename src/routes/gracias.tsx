import { createFileRoute } from "@tanstack/react-router";
import { OrderConfirmation, orderReturnSearch } from "@/components/order-confirmation";

export const Route = createFileRoute("/gracias")({
  validateSearch: orderReturnSearch,
  head: () => ({ meta: [
    { title: "Confirmación de compra — Perfumería El Arcángel" },
    { name: "description", content: "Consultá el pago y enviá tu pedido por WhatsApp a Perfumería El Arcángel." },
    { property: "og:title", content: "Confirmación de compra — El Arcángel" },
    { property: "og:description", content: "Consultá el pago y enviá tu pedido por WhatsApp a Perfumería El Arcángel." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "referrer", content: "no-referrer" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  return <OrderConfirmation {...Route.useSearch()} />;
}
