import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subcategoriesForCategory, typesForBrand } from "@/lib/category-selection";
import { CATALOG_PAGE_SIZE, catalogHeading, catalogSearch } from "@/lib/catalog-navigation";
import { Button } from "@/components/ui/button";
import { useWebMCP } from "use-webmcp-tool";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";
import { catalogLookupsQuery, catalogPageQuery } from "@/lib/store-catalog";

export const Route = createFileRoute("/productos")({
  validateSearch: catalogSearch,
  head: ({ match }) => {
    const catalog = (match.loaderData ?? {}) as {
      categories?: Array<{ id: string; name: string; slug: string }>;
      subcategories?: Array<{ id: string; name: string; category_id: string }>;
      types?: Array<{ id: string; name: string; subcategory_id: string }>;
    };
    const heading = catalogHeading({
      categories: catalog.categories ?? [],
      subcategories: catalog.subcategories ?? [],
      types: catalog.types ?? [],
      search: match.search,
    });
    const title = `${heading.title} — Perfumería El Arcángel`;
    const description =
      heading.subtitle ||
      "Explorá el catálogo de El Arcángel con precios, ofertas y envío en la zona.";
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
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const [lookups, page] = await Promise.all([
      context.queryClient.ensureQueryData(catalogLookupsQuery),
      context.queryClient.ensureQueryData(catalogPageQuery(deps)),
    ]);
    return { ...lookups, ...page };
  },
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(catalogLookupsQuery);
  const { data: result } = useSuspenseQuery(catalogPageQuery(search));
  const navigate = Route.useNavigate();
  const q = search.q ?? "";
  const cat =
    data.categories.find((c) => c.slug === search.categoria || c.id === search.categoria)?.id ??
    "all";
  const subcat = search.subcategoria ?? "all";
  const brandTypes = subcat === "all" ? [] : typesForBrand(data.types, subcat);
  const tipo = brandTypes.some((t) => t.id === search.tipo) ? search.tipo! : "all";
  const sort = search.orden ?? "recent";

  const totalPages = Math.max(1, Math.ceil(result.total / CATALOG_PAGE_SIZE));
  const page = result.page;
  const pageItems = result.products;
  const [queryText, setQueryText] = useState(q);
  const queryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(queryTimer.current);
    setQueryText(q);
  }, [search]);
  useEffect(() => () => clearTimeout(queryTimer.current), []);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .flatMap((n, i, arr) => (i > 0 && n - arr[i - 1] > 1 ? [0, n] : [n]));

  function goToPage(n: number) {
    navigate({ search: { ...search, pagina: n > 1 ? n : undefined } });
  }

  const heading = catalogHeading({
    categories: data.categories,
    subcategories: data.subcategories,
    types: data.types,
    search,
    count: result.total,
  });

  async function changeQuery(value: string) {
    clearTimeout(queryTimer.current);
    if (typeof value !== "string") throw new Error("La búsqueda debe ser un texto.");
    await navigate({
      search: { ...search, q: value || undefined, pagina: undefined },
      replace: true,
      resetScroll: false,
    });
  }

  useWebMCP({
    name: "read_catalog",
    description:
      "Consulta los productos mostrados con los filtros actuales; devuelve los artículos de la página actual con ID, precio en ARS y stock.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () =>
      runWebMCPTool("read_catalog", () =>
        pageItems.length === 0
          ? "No hay productos en esta vista."
          : `${result.total} productos en total; página ${page} con ${pageItems.length} artículos:\n${pageItems.map((p) => `${p.id}: ${p.name} | ARS ${p.price} | Stock ${p.stock}`).join("\n")}`,
      ),
  });
  useWebMCP({
    name: "read_catalog_filters",
    description:
      "Consulta la búsqueda, categoría y marca seleccionadas y las categorías disponibles sin cambiar la pantalla.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () =>
      runWebMCPTool(
        "read_catalog_filters",
        () =>
          `Búsqueda: ${q || "ninguna"}; categoría: ${cat}; marca: ${subcat}; orden: ${sort}.\nCategorías: ${data.categories.map((c) => `${c.id}: ${c.name}`).join("; ")}`,
      ),
  });
  useWebMCP({
    name: "search_catalog",
    description:
      "Cambia el texto del buscador de productos, manteniendo los demás filtros seleccionados.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto para buscar; vacío para quitar la búsqueda." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    execute: ({ query }: { query: string }) =>
      runWebMCPTool("search_catalog", async () => {
        await changeQuery(query);
        return "Búsqueda actualizada.";
      }),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border bg-secondary/30">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-primary">
              {heading.eyebrow}
            </span>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{heading.title}</h1>
            {heading.subtitle ? (
              <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                {heading.subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar producto…"
                value={queryText}
                maxLength={200}
                onChange={(e) => {
                  const value = e.target.value;
                  setQueryText(value);
                  clearTimeout(queryTimer.current);
                  queryTimer.current = setTimeout(() => {
                    void changeQuery(value);
                  }, 250);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={cat}
              onValueChange={(value) =>
                navigate({
                  search: {
                    ...search,
                    categoria: data.categories.find((c) => c.id === value)?.slug,
                    subcategoria: undefined,
                    tipo: undefined,
                    pagina: undefined,
                  },
                  resetScroll: false,
                })
              }
            >
              <SelectTrigger aria-label="Categoría" className="lg:w-48">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {data.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={subcat}
              onValueChange={(value) =>
                navigate({
                  search: {
                    ...search,
                    subcategoria: value === "all" ? undefined : value,
                    tipo: undefined,
                    pagina: undefined,
                  },
                  resetScroll: false,
                })
              }
            >
              <SelectTrigger aria-label="Marca" className="lg:w-52">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                {(cat === "all"
                  ? data.subcategories
                  : subcategoriesForCategory(data.subcategories, cat)
                ).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {brandTypes.length > 0 && (
              <Select
                value={tipo}
                onValueChange={(value) =>
                  navigate({
                    search: {
                      ...search,
                      tipo: value === "all" ? undefined : value,
                      pagina: undefined,
                    },
                    resetScroll: false,
                  })
                }
              >
                <SelectTrigger aria-label="Tipo de producto" className="lg:w-48">
                  <SelectValue placeholder="Tipo de producto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {brandTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={sort}
              onValueChange={(value) =>
                navigate({
                  search: {
                    ...search,
                    orden: value === "recent" ? undefined : value,
                    pagina: undefined,
                  },
                  resetScroll: false,
                })
              }
            >
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Más recientes</SelectItem>
                <SelectItem value="price-asc">Precio: menor</SelectItem>
                <SelectItem value="price-desc">Precio: mayor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pageItems.length === 0 ? (
            <div className="mt-10 rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <p className="font-serif text-xl text-foreground">No encontramos productos</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Probá con otros filtros o eliminá la búsqueda.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                {pageItems.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav
                  aria-label="Páginas del catálogo"
                  className="mt-10 flex flex-wrap items-center justify-center gap-2"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    Anterior
                  </Button>
                  {pageNumbers.map((n, i) =>
                    n === 0 ? (
                      <span key={`gap-${i}`} className="px-1 text-muted-foreground">
                        …
                      </span>
                    ) : (
                      <Button
                        key={n}
                        size="sm"
                        variant={n === page ? "default" : "outline"}
                        aria-current={n === page ? "page" : undefined}
                        onClick={() => goToPage(n)}
                      >
                        {n}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                  >
                    Siguiente
                  </Button>
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
