import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/pago-pendiente")({
  head: () => ({ meta: [{ title: "Pago pendiente" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <Clock className="mx-auto h-14 w-14 text-primary" />
        <h1 className="mt-4 font-serif text-4xl">Tu pago está pendiente</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Cuando MercadoPago confirme el pago, te vamos a contactar para coordinar la entrega.
        </p>
        <Link to="/" className="mt-8 inline-block text-primary underline">Volver al inicio</Link>
      </main>
      <SiteFooter />
    </div>
  ),
});
