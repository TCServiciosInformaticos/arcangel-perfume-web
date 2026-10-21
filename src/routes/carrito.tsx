import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { formatARS } from "@/lib/format";

export const Route = createFileRoute("/carrito")({
  head: () => ({
    meta: [
      { title: "Tu carrito — Perfumería El Arcángel" },
      { name: "description", content: "Revisá los productos en tu carrito y finalizá tu compra." },
      { property: "og:title", content: "Tu carrito — El Arcángel" },
      { property: "og:description", content: "Revisá tu pedido antes de pagar con Mercado Pago." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, updateQty, removeItem, subtotal } = useCart();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-serif text-4xl sm:text-5xl">Tu carrito</h1>

        {items.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border bg-card p-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-serif text-2xl">Todavía está vacío</p>
            <p className="mt-2 text-sm text-muted-foreground">Sumá fragancias desde el catálogo.</p>
            <Link
              to="/productos"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ver catálogo
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {items.map((it) => (
                <li key={it.productId} className="flex gap-4 p-4">
                  <Link
                    to={it.slug ? "/producto/$slug" : "/combos"}
                    params={it.slug ? { slug: it.slug } : undefined}
                    className="aspect-square h-24 w-24 flex-none overflow-hidden rounded-md bg-secondary/40"
                  >
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center font-serif text-xs text-muted-foreground/50">
                        El Arcángel
                      </div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <Link
                      to={it.slug ? "/producto/$slug" : "/combos"}
                      params={it.slug ? { slug: it.slug } : undefined}
                      className="font-medium hover:text-primary"
                    >
                      {it.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">{formatARS(it.price)}</span>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center rounded-md border border-border">
                        <button
                          onClick={() => updateQty(it.productId, it.quantity - 1)}
                          className="px-2 py-1.5 hover:bg-accent/10"
                          aria-label="Restar"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm">{it.quantity}</span>
                        <button
                          onClick={() => updateQty(it.productId, it.quantity + 1)}
                          className="px-2 py-1.5 hover:bg-accent/10"
                          aria-label="Sumar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(it.productId)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="hidden text-right font-medium sm:block">
                    {formatARS(it.price * it.quantity)}
                  </div>
                </li>
              ))}
            </ul>

            <aside className="h-fit rounded-lg border border-border bg-card p-6">
              <h2 className="font-serif text-2xl">Resumen</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium">{formatARS(subtotal)}</dd>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <dt>Envío</dt>
                  <dd>Calculado en el checkout</dd>
                </div>
              </dl>
              <div className="mt-4 flex justify-between border-t border-border pt-4 text-base">
                <span className="font-medium">Total parcial</span>
                <span className="font-serif text-2xl text-primary">{formatARS(subtotal)}</span>
              </div>
              <Button asChild className="mt-6 w-full" size="lg">
                <Link to="/checkout">Continuar al checkout</Link>
              </Button>
              <Link
                to="/productos"
                className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Seguir comprando
              </Link>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
