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

export function catalogSearch(search: Record<string, unknown>) {
  return {
    categoria: typeof search.categoria === "string" ? search.categoria : undefined,
    subcategoria: typeof search.subcategoria === "string" ? search.subcategoria : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    ofertas: search.ofertas === true || search.ofertas === "true" ? true : undefined,
    orden: search.orden === "price-asc" || search.orden === "price-desc" ? search.orden : undefined,
  };
}