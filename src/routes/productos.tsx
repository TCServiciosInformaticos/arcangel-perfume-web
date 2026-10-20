import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subcategoriesForCategory } from "@/lib/category-selection";
import { CATALOG_PAGE_SIZE, catalogHeading, catalogSearch } from "@/lib/catalog-navigation";
import { Button } from "@/components/ui/button";
import { useWebMCP } from "use-webmcp-tool";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";

const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: async () => {
    const [products, categories, subcategories] = await Promise.all([
      supabase
        .from("products")
        .select("id, slug, name, price, compare_at_price, stock, image_urls, category_id, subcategory_id, category:categories(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name, slug").order("sort_order"),
      supabase.from("subcategories").select("id,name,category_id").order("sort_order"),
    ]);
    if (products.error) throw products.error;
    if (categories.error) throw categories.error;
    if (subcategories.error) throw subcategories.error;
    return { products: products.data ?? [], categories: categories.data ?? [], subcategories: subcategories.data ?? [] };
  },
});

export const Route = createFileRoute("/productos")({
  validateSearch: catalogSearch,
  head: ({ match }) => {
    const catalog = (match.loaderData ?? {}) as {
      categories?: Array<{ id: string; name: string; slug: string }>;
      subcategories?: Array<{ id: string; name: string; category_id: string }>;
    };
    const heading = catalogHeading({
      categories: catalog.categories ?? [],
      subcategories: catalog.subcategories ?? [],
      search: match.search,
    });
    const title = `${heading.title} — Perfumería El Arcángel`;
    const description = heading.subtitle || "Explorá el catálogo de El Arcángel con precios, ofertas y envío en la zona.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: CatalogPage,
});

function CatalogPage() {
  const { data } = useSuspenseQuery(catalogQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const q = search.q ?? "";
  const cat = data.categories.find((c) => c.slug === search.categoria || c.id === search.categoria)?.id ?? "all";
  const subcat = search.subcategoria ?? "all";
  const sort = search.orden ?? "recent";

  const list = useMemo(() => {
    let l = data.products;
    if (cat !== "all") l = l.filter((p) => p.category_id === cat);
    if (subcat !== "all") l = l.filter((p) => p.subcategory_id === subcat);
    if (search.ofertas) l = l.filter((p) => p.compare_at_price !== null && Number(p.compare_at_price) > Number(p.price));
    if (q.trim()) {
      const needle = q.toLowerCase();
      l = l.filter((p) => p.name.toLowerCase().includes(needle));
    }
    if (sort === "price-asc") l = [...l].sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "price-desc") l = [...l].sort((a, b) => Number(b.price) - Number(a.price));
    return l;
  }, [data.products, q, cat, subcat, sort, search.ofertas]);

  const totalPages = Math.max(1, Math.ceil(list.length / CATALOG_PAGE_SIZE));
  const page = Math.min(search.pagina ?? 1, totalPages);
  const pageItems = list.slice((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .flatMap((n, i, arr) => (i > 0 && n - arr[i - 1] > 1 ? [0, n] : [n]));

  function goToPage(n: number) {
    navigate({ search: { ...search, pagina: n > 1 ? n : undefined } });
  }

  const heading = catalogHeading({
    categories: data.categories,
    subcategories: data.subcategories,
    search,
    count: list.length,
  });

  async function changeQuery(value: string) {
    if (typeof value !== "string") throw new Error("La búsqueda debe ser un texto.");
    await navigate({ search: { ...search, q: value || undefined, pagina: undefined }, replace: true, resetScroll: false });
  }

  useWebMCP({
    name: "read_catalog", description: "Consulta los productos mostrados con los filtros actuales; devuelve hasta 30 resultados con ID, precio en ARS y stock.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => runWebMCPTool("read_catalog", () => list.length === 0 ? "No hay productos en esta vista." : `${list.length} productos; primeros ${Math.min(30, list.length)}:\n${list.slice(0, 30).map((p) => `${p.id}: ${p.name} | ARS ${p.price} | Stock ${p.stock}`).join("\n")}`),
  });
  useWebMCP({
    name: "read_catalog_filters", description: "Consulta la búsqueda, categoría y marca seleccionadas y las categorías disponibles sin cambiar la pantalla.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => runWebMCPTool("read_catalog_filters", () => `Búsqueda: ${q || "ninguna"}; categoría: ${cat}; marca: ${subcat}; orden: ${sort}.\nCategorías: ${data.categories.map((c) => `${c.id}: ${c.name}`).join("; ")}`),
  });
  useWebMCP({
    name: "search_catalog", description: "Cambia el texto del buscador de productos, manteniendo los demás filtros seleccionados.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Texto para buscar; vacío para quitar la búsqueda." } }, required: ["query"], additionalProperties: false },
    execute: ({ query }: { query: string }) => runWebMCPTool("search_catalog", async () => { await changeQuery(query); return "Búsqueda actualizada."; }),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border bg-secondary/30">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-primary">{heading.eyebrow}</span>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{heading.title}</h1>
            {heading.subtitle ? (
              <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">{heading.subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar producto…"
                value={q}
                onChange={(e) => { void changeQuery(e.target.value); }}
                className="pl-9"
              />
            </div>
            <Select value={cat} onValueChange={(value) => navigate({ search: { ...search, categoria: data.categories.find((c) => c.id === value)?.slug, subcategoria: undefined, pagina: undefined }, resetScroll: false })}>
              <SelectTrigger aria-label="Categoría" className="lg:w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {data.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subcat} onValueChange={(value) => navigate({ search: { ...search, subcategoria: value === "all" ? undefined : value, pagina: undefined }, resetScroll: false })}>
              <SelectTrigger aria-label="Subcategoría / marca" className="lg:w-52"><SelectValue placeholder="Subcategoría / marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las subcategorías</SelectItem>
                {(cat === "all" ? data.subcategories : subcategoriesForCategory(data.subcategories, cat)).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => navigate({ search: { ...search, orden: value === "recent" ? undefined : value, pagina: undefined }, resetScroll: false })}>
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
            <>
              <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                {pageItems.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
              {totalPages > 1 && (
                <nav aria-label="Páginas del catálogo" className="mt-10 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Anterior</Button>
                  {pageNumbers.map((n, i) => n === 0
                    ? <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
                    : <Button key={n} size="sm" variant={n === page ? "default" : "outline"} aria-current={n === page ? "page" : undefined} onClick={() => goToPage(n)}>{n}</Button>)}
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>Siguiente</Button>
                </nav>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
