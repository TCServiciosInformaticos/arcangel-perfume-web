import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MessageCircle, Loader2 } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { getOrderForWhatsapp, markOrderWhatsappSent } from "@/lib/order-read.functions";
import { buildOrderMessage, buildWhatsappLink } from "@/lib/whatsapp";

const searchSchema = z.object({ order: z.string().uuid().optional() });

export const Route = createFileRoute("/gracias")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "¡Gracias por tu compra!" }, { name: "robots", content: "noindex" }] }),
  component: ThanksPage,
});

function ThanksPage() {
  const { order } = Route.useSearch();
  const getOrder = useServerFn(getOrderForWhatsapp);
  const markSent = useServerFn(markOrderWhatsappSent);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (!order) { setLoading(false); return; }
    getOrder({ data: { orderId: order } })
      .then((res) => {
        if (!res) { setErr("Pedido no encontrado"); return; }
        const msg = buildOrderMessage(res.order);
        const url = buildWhatsappLink(res.storeWhatsapp, msg);
        setLink(url);
        if (!opened.current) {
          opened.current = true;
          // small delay so user sees the success screen first
          setTimeout(() => {
            window.open(url, "_blank", "noopener,noreferrer");
            markSent({ data: { orderId: order } }).catch(() => {});
          }, 600);
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [order, getOrder, markSent]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center sm:p-12">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-4 font-serif text-4xl">¡Gracias por tu compra!</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Tu pago fue procesado correctamente. Para confirmar el pedido con la perfumería, abrimos WhatsApp con todos los datos listos para enviar.
          </p>
          {loading && <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-muted-foreground" />}
          {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
          {link && (
            <div className="mt-8 space-y-3">
              <Button asChild size="lg" className="w-full bg-[#25D366] hover:bg-[#1ebd5b] text-white">
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" /> Enviar pedido por WhatsApp
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Si no se abrió automáticamente, tocá el botón.<br />
                Una vez enviado, te coordinamos la entrega.
              </p>
            </div>
          )}
          <div className="mt-10">
            <Link to="/productos" className="text-sm text-primary hover:underline">Seguir comprando →</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
