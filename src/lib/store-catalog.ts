import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ProductCardData } from "@/components/product-card";
import type { catalogSearch } from "./catalog-navigation";
type Search = ReturnType<typeof catalogSearch>;
export type CatalogPageResult = {
  total: number;
  page: number;
  products: (ProductCardData & {
    category_id: string | null;
    subcategory_id: string | null;
    product_type_id: string | null;
  })[];
};
export const catalogLookupsQuery = queryOptions({
  queryKey: ["catalog-lookups"],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const [categories, subcategories, types] = await Promise.all([
      supabase.from("categories").select("id,name,slug").order("sort_order"),
      supabase.from("subcategories").select("id,name,category_id").order("sort_order"),
      supabase.from("product_types").select("id,name,subcategory_id").order("sort_order"),
    ]);
    if (categories.error || subcategories.error || types.error)
      throw categories.error || subcategories.error || types.error;
    return {
      categories: categories.data ?? [],
      subcategories: subcategories.data ?? [],
      types: types.data ?? [],
    };
  },
});
export function catalogPageQuery(search: Search) {
  return queryOptions({
    queryKey: ["catalog", "page", search],
    staleTime: 30_000,
    queryFn: async () => {
      const r = await (supabase as unknown as SupabaseClient).rpc("store_catalog_page", {
        p_category: search.categoria ?? null,
        p_brand: search.subcategoria ?? null,
        p_type: search.tipo ?? null,
        p_query: search.q ?? "",
        p_offers: search.ofertas ?? false,
        p_sort: search.orden ?? "recent",
        p_page: search.pagina ?? 1,
      });
      if (r.error) throw r.error;
      return r.data as CatalogPageResult;
    },
  });
}
