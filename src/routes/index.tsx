import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Truck, ShieldCheck, Instagram, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import heroImg from "@/assets/hero-perfumes.jpg";

const SELECT = "id, slug, name, price, compare_at_price, stock, image_urls, category:categories(name)";

const featuredQuery = queryOptions({
  queryKey: ["home", "featured"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    return data ?? [];
  },
});

const salesQuery = queryOptions({
  queryKey: ["home", "sales"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq("is_active", true)
      .not("compare_at_price", "is", null)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    return (data ?? []).filter(
      (p) => p.compare_at_price != null && Number(p.compare_at_price) > Number(p.price),
    );
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Perfumería El Arcángel — Perfumes, limpieza y cabello en Gran Bourg" },
      { name: "description", content: "Perfumes, productos de limpieza y para el cabello. Dos sucursales en Gran Bourg. Comprá online y pagá con MercadoPago, con envíos por la zona." },
      { property: "og:title", content: "Perfumería El Arcángel" },
      { property: "og:description", content: "Perfumes, limpieza y cabello en Gran Bourg. Envíos por la zona y pago con MercadoPago." },
      { property: "og:image", content: heroImg },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(featuredQuery),
      context.queryClient.ensureQueryData(salesQuery),
    ]),
  component: HomePage,
});


function HomePage() {
  const { data: featured } = useSuspenseQuery(featuredQuery);
  const { data: sales } = useSuspenseQuery(salesQuery);


  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground">
          <img
            src={heroImg}
            alt="Perfumes premium en superficie de mármol con iluminación cálida"
            width={1920}
            height={1280}
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-sidebar via-sidebar/85 to-sidebar/30" />
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-sidebar-primary">
              Perfumería · Limpieza · Cabello
            </span>
            <h1 className="mt-4 max-w-2xl font-serif text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              Todo lo que tu casa y tu estilo necesitan, en Gran Bourg.
            </h1>
            <p className="mt-6 max-w-xl text-base text-sidebar-foreground/80 sm:text-lg">
              Después de pagar con MercadoPago recibí el producto en tu casa o retiralo por tu sucursal más cercana.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/productos"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Ver catálogo <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://www.instagram.com/perfumeriaelarcangel/"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-md border border-sidebar-border/40 bg-sidebar/40 px-6 py-3 text-sm font-medium text-sidebar-foreground backdrop-blur transition-colors hover:bg-sidebar/60"
              >
                <Instagram className="h-4 w-4" /> Instagram
              </a>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-b border-border bg-secondary/30">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
            {[
              { icon: Sparkles, t: "Variedad", d: "Perfumes, limpieza y línea capilar en un mismo lugar." },
              { icon: Truck, t: "Envíos en la zona", d: "Repartimos por Gran Bourg y alrededores." },
              { icon: ShieldCheck, t: "Pago seguro", d: "Checkout con MercadoPago, todas las tarjetas." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex items-start gap-3">
                <span className="rounded-md bg-primary/15 p-2 text-primary"><Icon className="h-5 w-5" /></span>
                <div>
                  <div className="font-medium text-foreground">{t}</div>
                  <p className="text-sm text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-primary">Destacados</span>
              <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Lo más buscado</h2>
            </div>
            <Link to="/productos" className="hidden text-sm font-medium text-primary hover:underline sm:inline">
              Ver todo →
            </Link>
          </div>
          {featured.length === 0 ? (
            <div className="mt-10 rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <p className="font-serif text-2xl text-foreground">Pronto cargamos el catálogo</p>
              <p className="mt-2 text-sm text-muted-foreground">Iniciá sesión en el panel admin para agregar tus productos.</p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {featured.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </section>

        {/* Instagram CTA */}
        <section className="border-t border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-sidebar p-8 text-primary-foreground sm:p-12">
              <div className="absolute -right-8 -top-8 opacity-10">
                <Instagram className="h-56 w-56" strokeWidth={1.2} />
              </div>
              <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
                <div>
                  <span className="text-xs font-medium uppercase tracking-[0.3em] text-primary-foreground/80">
                    Seguinos
                  </span>
                  <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">
                    Novedades, promos y lanzamientos en Instagram
                  </h2>
                  <p className="mt-3 max-w-xl text-sm text-primary-foreground/85 sm:text-base">
                    Enterate primero de las nuevas fragancias, descuentos y productos que llegan al local.
                  </p>
                </div>
                <a
                  href="https://www.instagram.com/perfumeriaelarcangel/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 self-start rounded-md bg-primary-foreground px-6 py-3 text-sm font-medium text-primary shadow-sm transition-transform hover:scale-[1.02] md:self-center"
                >
                  <Instagram className="h-4 w-4" /> @perfumeriaelarcangel
                </a>
              </div>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
