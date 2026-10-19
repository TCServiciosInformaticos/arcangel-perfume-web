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
import catAccesorios from "@/assets/cat-accesorios.jpg";
import catSkincare from "@/assets/cat-skincare.jpg";
import catMakeup from "@/assets/cat-makeup.jpg";

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
  { name: "Accesorios", img: catAccesorios },
  { name: "Skin care", img: catSkincare },
  { name: "Make up", img: catMakeup },
];

function SectionTitle({ title }: { kicker?: string; title: string }) {
  return <h2 className="mb-8 text-3xl font-extrabold uppercase text-foreground">{title}</h2>;
}

function HeroSlider() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);
  const go = (d: number) => setI((v) => (v + d + SLIDES.length) % SLIDES.length);
  return (
    <section className="relative h-[320px] overflow-hidden bg-secondary sm:h-[420px]">
      {SLIDES.map((s, idx) => (
        <Link key={s.title} to="/productos" className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <img src={s.img} alt={s.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/50 to-transparent" />
          <div className="absolute inset-0 mx-auto flex max-w-7xl flex-col justify-center px-16">
            <h1 className="text-5xl font-extrabold lowercase text-primary sm:text-7xl">{s.title}</h1>
            <p className="mt-4 w-fit bg-card px-4 py-2 text-lg font-semibold text-foreground sm:text-2xl">{s.sub}</p>
          </div>
        </Link>
      ))}
      <button onClick={() => go(-1)} aria-label="Anterior" className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground">
        <ChevronLeft className="h-8 w-8" />
      </button>
      <button onClick={() => go(1)} aria-label="Siguiente" className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground">
        <ChevronRight className="h-8 w-8" />
      </button>
    </section>
  );
}


function HomePage() {
  const { data: featured } = useSuspenseQuery(featuredQuery);
  const { data: sales } = useSuspenseQuery(salesQuery);

  return (
    <div className="flex min-h-screen flex-col bg-card">
      <SiteHeader />
      <main className="flex-1">
        <HeroSlider />

        <section className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-12 sm:grid-cols-4 sm:gap-x-6 sm:px-6 lg:grid-cols-7 lg:gap-x-3 lg:px-8">
          {CATEGORIES.map((c) => (
            <Link key={c.name} to="/productos" className="group flex flex-col items-center gap-4 text-center">
              <span className="block h-28 w-28 overflow-hidden rounded-full border-2 border-border shadow-sm transition-shadow duration-300 group-hover:shadow-md sm:h-28 sm:w-28 lg:h-32 lg:w-32">
                <img src={c.img} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
              </span>
              <span className="text-base font-semibold text-foreground group-hover:text-primary sm:text-lg">{c.name}</span>
            </Link>
          ))}
        </section>

        {sales.length > 0 && (
          <section className="bg-secondary">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
              <SectionTitle title="Ofertas" />
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sales.map((p) => <ProductCard key={p.id} p={p} size="lg" />)}
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionTitle title="Nuevo en El Arcángel" />
          {featured.length === 0 ? (
            <p className="py-12 text-center text-lg">Pronto cargamos el catálogo</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => <ProductCard key={p.id} p={p} size="lg" />)}
            </div>
          )}
          <div className="mt-8 text-center">
            <Link to="/productos" className="inline-flex items-center gap-1 text-sm font-semibold uppercase text-primary">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-12 sm:px-6 md:grid-cols-3 lg:px-8">
          {PROMOS.map((p) => (
            <Link key={p.t} to="/productos" className="group relative block h-64 overflow-hidden">
              <img src={p.img} alt={p.t} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-4 bottom-4 bg-card/95 p-4 text-center">
                <h3 className="text-lg font-bold uppercase text-primary">{p.t}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{p.d}</p>
              </div>
            </Link>
          ))}
        </section>

        <section className="border-y border-border">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {BENEFITS.map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex flex-col items-center text-center">
                <Icon className="h-8 w-8 text-primary" />
                <div className="mt-3 text-sm font-bold uppercase">{t}</div>
                <p className="mt-1 text-xs text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-accent py-10 text-center">
          <h2 className="text-2xl font-extrabold uppercase text-foreground">Seguinos en Instagram</h2>
          <a href="https://www.instagram.com/perfumeriaelarcangel/" target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-2 text-lg font-semibold text-primary">
            <Instagram className="h-5 w-5" /> @perfumeriaelarcangel
          </a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
