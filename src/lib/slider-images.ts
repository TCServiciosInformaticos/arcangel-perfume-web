import heroImg from "@/assets/hero-banner-red.jpg";
import heroOfertas from "@/assets/hero-ofertas.jpg";
import heroPerfumes from "@/assets/hero-perfumes-bodegon.jpg";
import heroLimpieza from "@/assets/hero-limpieza.jpg";
import heroCabello from "@/assets/hero-cabello-vanity.jpg";
import heroHigiene from "@/assets/hero-higiene.jpg";
import heroAccesorios from "@/assets/hero-accesorios.jpg";
import heroSkincare from "@/assets/hero-skincare.jpg";
import heroMakeup from "@/assets/hero-makeup.jpg";
import { supabase } from "@/integrations/supabase/client";
export const SLIDER_BUCKET = "slider-images";
const defaults: Record<string, string> = {
  "builtin:hero-banner-red": heroImg,
  "builtin:hero-ofertas": heroOfertas,
  "builtin:hero-perfumes-bodegon": heroPerfumes,
  "builtin:hero-limpieza": heroLimpieza,
  "builtin:hero-cabello-vanity": heroCabello,
  "builtin:hero-higiene": heroHigiene,
  "builtin:hero-accesorios": heroAccesorios,
  "builtin:hero-skincare": heroSkincare,
  "builtin:hero-makeup": heroMakeup,
};
export function sliderImage(path: string) {
  return defaults[path] ?? supabase.storage.from(SLIDER_BUCKET).getPublicUrl(path).data.publicUrl;
}
