import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/favorites";
import { StockNotice, RelatedProducts } from "@/components/shopping-tools";
import { formatARS } from "@/lib/format";
import { useCart } from "@/lib/cart-context";

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, description, price, stock, image_urls, is_active, category_id, subcategory_id, category:categories(name, slug)",
        )
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const Route = createFileRoute("/producto/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Perfumería El Arcángel` },
          {
            name: "description",
            content:
              loaderData.description?.slice(0, 155) ??
              `Comprá ${loaderData.name} en Perfumería El Arcángel.`,
          },
          { property: "og:title", content: loaderData.name },
          {
            property: "og:description",
            content: loaderData.description?.slice(0, 155) ?? `Comprá ${loaderData.name}.`,
          },
          { property: "og:type", content: "product" },
          { name: "twitter:card", content: "summary_large_image" },
          ...(loaderData.image_urls?.[0]?.startsWith("https://")
            ? [
                { property: "og:image", content: loaderData.image_urls[0] },
                { name: "twitter:image", content: loaderData.image_urls[0] },
              ]
            : []),
        ]
      : [],
  }),
  component: ProductDetail,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl">Producto no encontrado</h1>
        <Link to="/productos" className="mt-6 inline-block text-primary underline">
          Volver al catálogo
        </Link>
      </main>
      <SiteFooter />
    </div>
  ),
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(productQuery(slug));
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);

  if (!p) return null;
  const out = p.stock <= 0;
  const images = p.image_urls?.length ? p.image_urls : [];

  const onAdd = () => {
    addItem(
      {
        productId: p.id,
        slug: p.slug,
        name: p.name,
        price: Number(p.price),
        imageUrl: images[0] ?? null,
        maxStock: p.stock,
      },
      qty,
    );
    toast.success(`${p.name} agregado al carrito`);
  };

  const onBuy = () => {
    onAdd();
    navigate({ to: "/carrito" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/productos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Catálogo
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded-lg border border-border bg-secondary/40">
              {images[activeImg] ? (
                <img src={images[activeImg]} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center font-serif text-4xl text-muted-foreground/40">
                  El Arcángel
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {images.map((url, i) => (
                  <button
                    key={url}
                    onClick={() => setActiveImg(i)}
                    className={`aspect-square overflow-hidden rounded border-2 transition-colors ${
                      i === activeImg ? "border-primary" : "border-transparent hover:border-border"
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {p.category?.name && (
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {p.category.name}
              </span>
            )}
            <div className="mt-3">
              <FavoriteButton id={p.id} />
            </div>
            <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{p.name}</h1>
            <div className="mt-4 text-3xl font-medium text-primary">{formatARS(p.price)}</div>

            {p.description && (
              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {p.description}
              </p>
            )}

            <div className="mt-8 space-y-4">
              {out ? (
                <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                  Producto sin stock por el momento.
                  <StockNotice id={p.id} />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Cantidad</span>
                    <div className="flex items-center rounded-md border border-border">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="px-3 py-2 hover:bg-accent/10"
                        aria-label="Restar"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-10 text-center text-sm font-medium">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.min(p.stock, q + 1))}
                        className="px-3 py-2 hover:bg-accent/10"
                        aria-label="Sumar"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">{p.stock} disponibles</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="lg" onClick={onAdd} variant="outline">
                      <ShoppingBag className="mr-2 h-4 w-4" /> Agregar al carrito
                    </Button>
                    <Button size="lg" onClick={onBuy}>
                      Comprar ahora
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <RelatedProducts id={p.id} category={p.category_id} brand={p.subcategory_id} />
      </main>
      <SiteFooter />
    </div>
  );
}
