import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Truck, Percent, ShieldCheck, MessageCircle, Tag, Instagram } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import heroImg from "@/assets/hero-banner-red.jpg";
import catPerfumes from "@/assets/cat-perfumes.jpg";
import catLimpieza from "@/assets/cat-limpieza.jpg";
import catCabello from "@/assets/cat-cabello.jpg";

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

const BENEFITS = [
  { icon: Truck, t: "¡Comprá Online!", d: "Hacé tu pedido y te lo llevamos en la zona de Gran Bourg." },
  { icon: Percent, t: "Descuentos todos los meses", d: "Los mejores precios para vos y tu familia." },
  { icon: ShieldCheck, t: "Comprá con tranquilidad", d: "Pago seguro con MercadoPago." },
  { icon: MessageCircle, t: "¡Te ayudamos!", d: "Atención por WhatsApp de lunes a sábado." },
];

const CATEGORIES = [
  { name: "Perfumes y Fragancias", img: catPerfumes },
  { name: "Limpieza del Hogar", img: catLimpieza },
  { name: "Cuidado del Cabello", img: catCabello },
];

function HomePage() {
  const { data: featured } = useSuspenseQuery(featuredQuery);
  const { data: sales } = useSuspenseQuery(salesQuery);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero banner */}
        <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
          <img
            src={heroImg}
            alt="Perfumes y productos del hogar"
            width={1920}
            height={800}
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-95"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" />
          <div className="mx-auto flex min-h-[420px] max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-xl">
              <span className="inline-block rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
                Nuevo ingreso
              </span>
              <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                Perfumes, limpieza y cabello al mejor precio.
              </h1>
              <p className="mt-4 max-w-md text-sm text-primary-foreground/90 sm:text-base">
                Comprá online y recibilo en tu casa o retiralo en una de nuestras sucursales de Gran Bourg.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/productos"
                  className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary transition-transform hover:scale-[1.02]"
                >
                  Ver catálogo <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://www.instagram.com/perfumeriaelarcangel/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/40 px-6 py-3 text-sm font-medium backdrop-blur hover:bg-primary-foreground/10"
                >
                  <Instagram className="h-4 w-4" /> Instagram
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits strip */}
        <section className="border-b border-border bg-secondary">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {BENEFITS.map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-foreground/15 text-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground">{t}</div>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Category tiles */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <Link
                key={c.name}
                to="/productos"
                className="group relative block overflow-hidden rounded-lg"
              >
                <img
                  src={c.img}
                  alt={c.name}
                  loading="lazy"
                  width={900}
                  height={900}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="text-lg font-bold text-white">{c.name}</h3>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-white/90 group-hover:text-white">
                    Ver productos <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured products */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold uppercase tracking-wide sm:text-3xl">Productos favoritos</h2>
            <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-primary" />
          </div>
          {featured.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <p className="text-xl font-semibold text-foreground">Pronto cargamos el catálogo</p>
              <p className="mt-2 text-sm text-muted-foreground">Iniciá sesión en el panel admin para agregar tus productos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {featured.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
          <div className="mt-10 text-center">
            <Link
              to="/productos"
              className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-6 py-2.5 text-sm font-semibold uppercase text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Ver todo el catálogo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Ofertas */}
        {sales.length > 0 && (
          <section className="border-y border-border bg-secondary">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
              <div className="mb-8 text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Tag className="h-3.5 w-3.5" /> Ofertas
                </span>
                <h2 className="mt-3 text-2xl font-bold uppercase tracking-wide sm:text-3xl">Promos de la semana</h2>
                <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                {sales.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
            </div>
          </section>
        )}

        {/* Instagram CTA */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-sidebar p-8 text-primary-foreground sm:p-12">
            <div className="absolute -right-8 -top-8 opacity-10">
              <Instagram className="h-56 w-56" strokeWidth={1.2} />
            </div>
            <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-foreground/80">
                  Seguinos
                </span>
                <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
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
                className="inline-flex items-center gap-2 self-start rounded-full bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary shadow-sm transition-transform hover:scale-[1.02] md:self-center"
              >
                <Instagram className="h-4 w-4" /> @perfumeriaelarcangel
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
