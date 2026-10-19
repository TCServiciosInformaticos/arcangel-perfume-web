import { createFileRoute } from "@tanstack/react-router";
import { OrderConfirmation, orderReturnSearch } from "@/components/order-confirmation";

export const Route = createFileRoute("/pago-fallido")({
  validateSearch: orderReturnSearch,
  head: () => ({ meta: [
    { title: "Pago no procesado — Perfumería El Arcángel" },
    { name: "description", content: "Revisá el estado de tu pago y volvé a intentar tu compra en El Arcángel." },
    { property: "og:title", content: "Pago no procesado — El Arcángel" },
    { property: "og:description", content: "Revisá el estado de tu pago y volvé a intentar tu compra en El Arcángel." },
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
