import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/pago-fallido")({
  head: () => ({ meta: [{ title: "Pago no procesado" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <XCircle className="mx-auto h-14 w-14 text-destructive" />
        <h1 className="mt-4 font-serif text-4xl">El pago no pudo procesarse</h1>
        <p className="mt-3 text-sm text-muted-foreground">Tu carrito sigue guardado. Probá de nuevo con otro medio de pago.</p>
        <Link to="/carrito" className="mt-8 inline-block text-primary underline">Volver al carrito</Link>
      </main>
      <SiteFooter />
    </div>
  ),
});
