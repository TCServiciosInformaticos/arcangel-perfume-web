import { createFileRoute } from "@tanstack/react-router";
import { OrderConfirmation, orderReturnSearch } from "@/components/order-confirmation";

export const Route = createFileRoute("/pago-pendiente")({
  validateSearch: orderReturnSearch,
  head: () => ({ meta: [
    { title: "Pago pendiente — Perfumería El Arcángel" },
    { name: "description", content: "Consultá la confirmación de tu pago con Mercado Pago en El Arcángel." },
    { property: "og:title", content: "Pago pendiente — El Arcángel" },
    { property: "og:description", content: "Consultá la confirmación de tu pago con Mercado Pago en El Arcángel." },
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
