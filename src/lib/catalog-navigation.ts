import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const navigationCategoriesQuery = queryOptions({
  queryKey: ["navigation-categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("id,name,slug").order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
});

type CatalogSearch = {
  categoria?: string;
  subcategoria?: string;
  tipo?: string;
  q?: string;
  ofertas?: boolean;
  orden?: string;
  pagina?: number;
};

export const CATALOG_PAGE_SIZE = 24;

export function catalogSearch(search: Record<string, unknown>): CatalogSearch {
  const page = Number(search.pagina);
  return {
    categoria: typeof search.categoria === "string" ? search.categoria : undefined,
    subcategoria: typeof search.subcategoria === "string" ? search.subcategoria : undefined,
    tipo: typeof search.tipo === "string" ? search.tipo : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    ofertas: search.ofertas === true || search.ofertas === "true" ? true : undefined,
    orden: search.orden === "price-asc" || search.orden === "price-desc" ? search.orden : undefined,
    pagina: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}

type CatalogOption = { id: string; name: string; slug?: string; category_id?: string };

/** Títulos propios por categoría; si agregás una nueva, usa su nombre tal cual. */
const CATEGORY_TITLES: Record<string, string> = {
  perfumes: "Nuestras fragancias",
  limpieza: "Productos de limpieza",
  cabello: "Todo para tu cabello",
  "skin-care": "Cuidado de la piel",
  "make-up": "Maquillaje",
  accesorios: "Accesorios",
};

export type CatalogHeading = { eyebrow: string; title: string; subtitle: string };

export function catalogHeading({
  categories,
  subcategories,
  types = [],
  search,
  count,
}: {
  categories: CatalogOption[];
  subcategories: CatalogOption[];
  types?: CatalogOption[];
  search: CatalogSearch;
  count?: number;
}): CatalogHeading {
  const category = categories.find((c) => c.slug === search.categoria || c.id === search.categoria);
  const subcategory = subcategories.find((s) => s.id === search.subcategoria);
  const countLine = (word: string) =>
    count === undefined ? "" : `${count} ${count === 1 ? "producto" : "productos"} ${word}.`;
  const available = countLine(count === 1 ? "disponible" : "disponibles");
  const discounted = countLine("con descuento");
  const found = countLine(count === 1 ? "encontrado" : "encontrados");

  if (search.q?.trim()) {
    return { eyebrow: "Catálogo", title: `Resultados para “${search.q.trim()}”`, subtitle: found };
  }
  const type = subcategory ? types.find((t) => t.id === search.tipo) : undefined;
  if (subcategory && type) {
    return { eyebrow: subcategory.name, title: type.name, subtitle: available };
  }
  if (subcategory) {
    return { eyebrow: "Catálogo", title: subcategory.name, subtitle: available };
  }
  if (category) {
    return {
      eyebrow: "Catálogo",
      title: search.ofertas ? `Ofertas de ${category.name}` : CATEGORY_TITLES[category.slug ?? ""] ?? category.name,
      subtitle: search.ofertas ? discounted : available,
    };
  }
  if (search.ofertas) {
    return { eyebrow: "Catálogo", title: "Ofertas", subtitle: discounted };
  }
  return {
    eyebrow: "Catálogo",
    title: "Todo el catálogo",
    subtitle: "Perfumes, limpieza, cuidado capilar y más, con envío en la zona y retiro en el local.",
  };
}