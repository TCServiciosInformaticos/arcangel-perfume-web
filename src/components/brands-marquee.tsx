import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const brandsQuery = queryOptions({
  queryKey: ["brands"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, logo_url")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
});

export function BrandsMarquee() {
  const { data: brands = [] } = useQuery(brandsQuery);
  if (brands.length === 0) return null;
  const items = [...brands, ...brands];
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="group overflow-hidden rounded-2xl border border-border bg-card py-6 shadow-sm">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-14 group-hover:[animation-play-state:paused]">
          {items.map((b, i) => (
            <div key={`${b.id}-${i}`} className="flex shrink-0 items-center gap-3">
              {b.logo_url && <img src={b.logo_url} alt={b.name} loading="lazy" className="h-10 w-auto object-contain" />}
              <span className="whitespace-nowrap text-lg font-bold text-foreground">{b.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
