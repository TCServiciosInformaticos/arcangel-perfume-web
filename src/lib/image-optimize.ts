/** Redimensiona una imagen en el navegador y la convierte a WebP (formato liviano). */
export async function toWebp(file: Blob, maxSide: number, quality = 0.78): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (!blob || blob.type !== "image/webp") throw new Error("Tu navegador no pudo convertir la imagen.");
  return blob;
}

export const FULL_IMAGE_MAX = 1600;
export const THUMB_IMAGE_MAX = 480;

/** Miniatura a usar: la nueva si se generó, la guardada si la foto principal no cambió, o ninguna. */
export function resolveThumbnail(
  firstImage: string | undefined,
  generated: Record<string, string>,
  previous: { first?: string; thumb?: string | null },
): string | null {
  if (!firstImage) return null;
  if (generated[firstImage]) return generated[firstImage];
  return firstImage === previous.first ? previous.thumb ?? null : null;
}
