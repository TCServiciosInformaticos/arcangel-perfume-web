import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Truck, Percent, ShieldCheck, MessageCircle, Instagram, ChevronLeft, ChevronRight } from "lucide-react";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  { icon: Truck, t: "Llegamos a tu puerta", d: "Repartimos en Gran Bourg y zonas aledañas." },
  { icon: Percent, t: "Precios que cuidan tu bolsillo", d: "Promociones nuevas todo el año." },
  { icon: ShieldCheck, t: "Comprá tranquila", d: "Abonás con MercadoPago, 100% protegido." },
  { icon: MessageCircle, t: "Te ayudamos a elegir", d: "Escribinos por WhatsApp y te asesoramos." },
];

const SLIDES = [
  { img: heroImg, title: "El Arcángel", sub: "Tu perfumería de barrio, ahora también online" },
  { img: catPerfumes, title: "Perfumes", sub: "La fragancia que te representa está acá" },
  { img: catCabello, title: "Cabello", sub: "Todo lo que tu pelo necesita, en un solo lugar" },
];

const PROMOS = [
  { img: catLimpieza, t: "Pedí desde tu casa", d: "Hacé tu compra online y te la acercamos nosotros." },
  { img: catPerfumes, t: "Descuentos imperdibles", d: "Perfumes seleccionados con precios especiales." },
  { img: catCabello, t: "Pasá a retirar", d: "Te esperamos en cualquiera de nuestras dos sucursales." },
];

const CATEGORIES = [
  { name: "Perfumes", img: catPerfumes },
  { name: "Limpieza", img: catLimpieza },
  { name: "Cabello", img: catCabello },
  { name: "Higiene personal", img: heroImg },
];

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-8">
      <span className="text-xs font-bold uppercase tracking-[0.3em] text-primary">{kicker}</span>
      <h2 className="mt-1 text-3xl font-bold text-foreground sm:text-4xl">{title}</h2>
    </div>
  );
}

function HeroSlider() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);
  const go = (d: number) => setI((v) => (v + d + SLIDES.length) % SLIDES.length);
  return (
    <section className="relative h-[460px] overflow-hidden bg-sidebar sm:h-[600px]">
      {SLIDES.map((s, idx) => (
        <div key={s.title} className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "opacity-0"}`}>
          <img src={s.img} alt={s.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-sidebar/70 via-sidebar/20 to-transparent" />
          <div className="absolute inset-0 mx-auto flex max-w-7xl flex-col justify-center px-4 text-sidebar-foreground sm:px-6 lg:px-8">
            <h1 className="text-5xl font-extrabold sm:text-7xl">{s.title}</h1>
            <p className="mt-3 max-w-md text-base uppercase tracking-wide sm:text-lg">{s.sub}</p>
            <Link to="/productos" className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Ver catálogo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ))}
      <button onClick={() => go(-1)} aria-label="Anterior" className="absolute left-6 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-card text-foreground shadow">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button onClick={() => go(1)} aria-label="Siguiente" className="absolute right-6 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-card text-foreground shadow">
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((s, idx) => (
          <button key={s.title} onClick={() => setI(idx)} aria-label={`Slide ${idx + 1}`} className={`h-2 rounded-full transition-all ${idx === i ? "w-8 bg-primary" : "w-2 bg-card"}`} />
        ))}
      </div>
    </section>
  );
}

function HomePage() {
  const { data: featured } = useSuspenseQuery(featuredQuery);
  const { data: sales } = useSuspenseQuery(salesQuery);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <HeroSlider />

        {/* Categorías circulares */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionTitle kicker="Nuestros rubros" title="¿Qué estás buscando hoy?" />
          <div className="flex gap-6 overflow-x-auto pb-2 sm:gap-10">
            {CATEGORIES.map((c) => (
              <Link key={c.name} to="/productos" className="group flex w-32 shrink-0 flex-col items-center gap-3 sm:w-40">
                <span className="block aspect-square w-full overflow-hidden rounded-full border-4 border-card shadow-md ring-1 ring-border transition-all group-hover:ring-primary">
                  <img src={c.img} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                </span>
                <span className="text-center text-sm font-semibold text-foreground group-hover:text-primary">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Promo cards */}
        <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 sm:px-6 md:grid-cols-3 lg:px-8">
          {PROMOS.map((p) => (
            <Link key={p.t} to="/productos" className="group relative block h-72 overflow-hidden rounded-3xl">
              <img src={p.img} alt={p.t} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-sidebar/85 via-sidebar/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-sidebar-foreground">
                <h3 className="text-xl font-bold">{p.t}</h3>
                <p className="mt-1 text-sm opacity-90">{p.d}</p>
                <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-card px-4 py-2 text-xs font-semibold text-foreground">
                  Ver más <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </section>

        {/* Destacados */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <SectionTitle kicker="Favoritos de nuestros clientes" title="Los más pedidos" />
            <Link to="/productos" className="mb-8 hidden items-center gap-1 text-sm font-semibold text-primary sm:inline-flex">
              Ver catálogo completo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {featured.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
              <p className="text-xl font-semibold">Pronto cargamos el catálogo</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {featured.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </section>

        {sales.length > 0 && (
          <section className="bg-secondary">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <SectionTitle kicker="Aprovechá" title="Ofertas vigentes" />
              <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                {sales.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
            </div>
          </section>
        )}

        {/* Beneficios */}
        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {BENEFITS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-bold">{t}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{d}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-sidebar p-8 text-sidebar-foreground sm:p-12 md:flex-row md:items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-sidebar-primary">Estamos cerca tuyo</span>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Enterate primero de las novedades en Instagram</h2>
            </div>
            <a href="https://www.instagram.com/perfumeriaelarcangel/" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
              <Instagram className="h-4 w-4" /> @perfumeriaelarcangel
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
