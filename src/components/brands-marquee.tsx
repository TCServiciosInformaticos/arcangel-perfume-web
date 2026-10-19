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
        <div className="flex w-max animate-[marquee_40s_linear_infinite] items-center gap-16 group-hover:[animation-play-state:paused]">
          {items.map((b, i) =>
            b.logo_url ? (
              <img
                key={`${b.id}-${i}`}
                src={b.logo_url}
                alt={b.name}
                loading="lazy"
                className="h-12 w-auto max-w-[140px] shrink-0 object-contain opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0"
              />
            ) : (
              <span key={`${b.id}-${i}`} className="shrink-0" />
            ),
          )}
        </div>
      </div>
    </section>
  );
}
