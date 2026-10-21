import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sliderImage } from "./slider-images";
import { slideSearch } from "./slider-model";
export const homeSlidesQuery = queryOptions({
  queryKey: ["home", "slides"],
  staleTime: 30000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("home_slides")
      .select(
        "id,title,subtitle,alt_text,image_path,mobile_position,destination,category:categories(slug)",
      )
      .eq("is_active", true)
      .order("sort_order")
      .order("id");
    if (error) throw error;
    return (data ?? []).map((s) => ({
      id: s.id,
      img: sliderImage(s.image_path),
      title: s.title,
      sub: s.subtitle,
      alt: s.alt_text || s.title,
      mobilePosition: s.mobile_position,
      search: slideSearch(s.destination, s.category?.slug),
    }));
  },
});
