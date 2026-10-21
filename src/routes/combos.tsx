import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { commerce, type StoreBundle } from "@/lib/commerce-client";
import { useCart } from "@/lib/cart-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { formatARS } from "@/lib/format";
import { toast } from "sonner";
export const Route = createFileRoute("/combos")({ component: Bundles });
function Bundles() {
  const { addItem } = useCart();
  const q = useQuery({
    queryKey: ["store-bundles"],
    queryFn: async () => {
      const r = await commerce.rpc("list_store_bundles");
      if (r.error) throw r.error;
      return r.data as unknown as StoreBundle[];
    },
  });
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[60vh] max-w-6xl p-6">
        <h1 className="font-serif text-3xl">Combos y kits</h1>
        <p className="my-3 text-sm">Precios especiales con disponibilidad según sus componentes.</p>
        {q.isPending ? (
          <p>Cargando…</p>
        ) : q.isError ? (
          <p role="alert">No se pudieron cargar los combos.</p>
        ) : !q.data.length ? (
          <p>
            Pronto vas a encontrar nuevos combos.{" "}
            <Link to="/productos" className="underline">
              Ver artículos
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {q.data.map((b) => (
              <section key={b.id} className="space-y-3 rounded-xl border p-5">
                <h2 className="font-serif text-2xl">{b.name}</h2>
                <p className="text-sm">{b.description}</p>
                <ul className="text-sm">
                  {b.components.map((c) => (
                    <li key={c.product_id}>
                      {c.quantity} × {c.name}
                    </li>
                  ))}
                </ul>
                <p className="text-xl font-semibold">{formatARS(b.price)}</p>
                <Button
                  disabled={b.stock <= 0}
                  onClick={() => {
                    addItem({
                      productId: b.id,
                      slug: "",
                      name: b.name,
                      price: b.price,
                      maxStock: b.stock,
                      imageUrl: null,
                    });
                    toast.success("Combo agregado al carrito");
                  }}
                >
                  {b.stock > 0 ? "Agregar combo" : "Sin stock"}
                </Button>
              </section>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
