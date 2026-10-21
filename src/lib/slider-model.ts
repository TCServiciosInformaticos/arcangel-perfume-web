import { z } from "zod";
export const slideFormSchema = z
  .object({
    title: z.string().trim().min(1, "Ingresá un título.").max(100),
    subtitle: z.string().max(500),
    alt_text: z.string().max(200),
    image_path: z.string().min(1, "Subí una imagen."),
    mobile_position: z.number().int().min(0).max(100),
    destination: z.enum(["catalog", "offers", "category"]),
    category_id: z.string().uuid().nullable(),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.destination === "category" && !v.category_id)
      ctx.addIssue({ code: "custom", path: ["category_id"], message: "Elegí una categoría." });
    if (v.destination !== "category" && v.category_id !== null)
      ctx.addIssue({
        code: "custom",
        path: ["category_id"],
        message: "El destino no usa categoría.",
      });
  });
export function moveSlide<T>(rows: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function slideSearch(
  destination: string,
  categorySlug?: string | null,
): { categoria?: string; ofertas?: boolean } {
  return destination === "offers"
    ? { ofertas: true }
    : destination === "category" && categorySlug
      ? { categoria: categorySlug }
      : {};
}
export function validateSliderFile(file: Pick<File, "type" | "size">) {
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type))
    throw new Error("Elegí una imagen JPG, PNG, WebP o AVIF.");
  if (file.size > 12 * 1024 * 1024 || file.size === 0)
    throw new Error("La imagen debe pesar entre 1 byte y 12 MB.");
}
