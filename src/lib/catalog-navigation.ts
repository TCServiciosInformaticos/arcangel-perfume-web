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
  q?: string;
  ofertas?: boolean;
  orden?: string;
};

export function catalogSearch(search: Record<string, unknown>): CatalogSearch {
  return {
    categoria: typeof search.categoria === "string" ? search.categoria : undefined,
    subcategoria: typeof search.subcategoria === "string" ? search.subcategoria : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    ofertas: search.ofertas === true || search.ofertas === "true" ? true : undefined,
    orden: search.orden === "price-asc" || search.orden === "price-desc" ? search.orden : undefined,
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
  search,
  count,
}: {
  categories: CatalogOption[];
  subcategories: CatalogOption[];
  search: CatalogSearch;
  count?: number;
}): CatalogHeading {
  const category = categories.find((c) => c.slug === search.categoria || c.id === search.categoria);
  const subcategory = subcategories.find((s) => s.id === search.subcategoria);
  const available =
    count === undefined ? "" : `${count} ${count === 1 ? "producto" : "productos"} ${search.ofertas ? "con descuento" : "disponibles"}.`;

  if (search.q?.trim()) {
    return { eyebrow: "Catálogo", title: `Resultados para “${search.q.trim()}”`, subtitle: available };
  }
  if (subcategory) {
    return { eyebrow: "Catálogo", title: subcategory.name, subtitle: available };
  }
  if (category) {
    return {
      eyebrow: "Catálogo",
      title: search.ofertas ? `Ofertas de ${category.name}` : CATEGORY_TITLES[category.slug ?? ""] ?? category.name,
      subtitle: available,
    };
  }
  if (search.ofertas) {
    return { eyebrow: "Catálogo", title: "Ofertas", subtitle: available };
  }
  return {
    eyebrow: "Catálogo",
    title: "Todo el catálogo",
    subtitle: "Perfumes, limpieza, cabello y más, con envío en la zona y retiro en el local.",
  };
}