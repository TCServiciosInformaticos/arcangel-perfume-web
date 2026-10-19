import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: async () => {
    const [products, categories] = await Promise.all([
      supabase
        .from("products")
        .select("id, slug, name, price, stock, image_urls, category_id, category:categories(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name, slug").order("sort_order"),
    ]);
    if (products.error) throw products.error;
    if (categories.error) throw categories.error;
    return { products: products.data ?? [], categories: categories.data ?? [] };
  },
});

export const Route = createFileRoute("/productos")({
  head: () => ({
    meta: [
      { title: "Catálogo de perfumes — Perfumería El Arcángel" },
      { name: "description", content: "Explorá toda la selección de perfumes y fragancias premium. Comprá online con envío en CABA." },
      { property: "og:title", content: "Catálogo — Perfumería El Arcángel" },
      { property: "og:description", content: "Explorá toda la selección de perfumes y fragancias premium." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: CatalogPage,
});

function CatalogPage() {
  const { data } = useSuspenseQuery(catalogQuery);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<string>("recent");

  const list = useMemo(() => {
    let l = data.products;
    if (cat !== "all") l = l.filter((p) => p.category_id === cat);
    if (q.trim()) {
      const needle = q.toLowerCase();
      l = l.filter((p) => p.name.toLowerCase().includes(needle));
    }
    if (sort === "price-asc") l = [...l].sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "price-desc") l = [...l].sort((a, b) => Number(b.price) - Number(a.price));
    return l;
  }, [data.products, q, cat, sort]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border bg-secondary/30">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-primary">Catálogo</span>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Nuestras fragancias</h1>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar perfume…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="sm:w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {data.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Más recientes</SelectItem>
                <SelectItem value="price-asc">Precio: menor</SelectItem>
                <SelectItem value="price-desc">Precio: mayor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {list.length === 0 ? (
            <div className="mt-10 rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <p className="font-serif text-xl text-foreground">No encontramos productos</p>
              <p className="mt-2 text-sm text-muted-foreground">Probá con otros filtros o eliminá la búsqueda.</p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {list.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
