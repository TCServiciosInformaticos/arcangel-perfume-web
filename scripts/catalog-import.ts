export type SourceProduct = {
  name: string;
  source_url: string;
  source_price: number;
  description: string;
};

export function prepareCatalogProduct(product: SourceProduct, imageUrls: string[], categoryId: string) {
  if (!product.name.trim() || !product.description.trim()) throw new Error("Falta nombre o descripción");
  if (!Number.isFinite(product.source_price) || product.source_price <= 0) throw new Error("Falta precio publicado válido");
  const source = new URL(product.source_url);
  const sourceSlug = source.pathname.split("/").filter(Boolean).at(-1);
  if (!sourceSlug || !source.hostname.endsWith("bmdistribuidora.com.ar")) throw new Error("Origen inválido");
  if (imageUrls.length === 0 || imageUrls.some(url => !url.startsWith("/__l5e/assets-v1/"))) throw new Error("Faltan imágenes almacenadas");
  return {
    name: product.name.trim(),
    slug: sourceSlug,
    description: product.description.trim(),
    price: product.source_price,
    stock: 0,
    category_id: categoryId,
    image_urls: imageUrls,
    is_active: true,
    is_featured: false,
  };
}