export type SourceProduct = {
  name: string;
  source_url: string;
  source_price: number;
  description: string;
};

export function prepareCatalogProduct(product: SourceProduct, imageUrls: string[], categoryId: string, options: { discountPercent?: number; roundToPesos?: boolean } = {}) {
  if (!product.name.trim() || !product.description.trim()) throw new Error("Falta nombre o descripción");
  if (!Number.isFinite(product.source_price) || product.source_price <= 0) throw new Error("Falta precio publicado válido");
  const source = new URL(product.source_url);
  const sourceSlug = source.pathname.split("/").filter(Boolean).at(-1);
  const allowedHosts = ["bmdistribuidora.com.ar", "www.bmdistribuidora.com.ar", "thelmaylouise.com.ar", "www.thelmaylouise.com.ar"];
  if (!sourceSlug || source.protocol !== "https:" || !allowedHosts.includes(source.hostname)) throw new Error("Origen inválido");
  if (imageUrls.length === 0 || imageUrls.some(url => !url.startsWith("/__l5e/assets-v1/"))) throw new Error("Faltan imágenes almacenadas");
  const discount = options.discountPercent ?? 0;
  if (!Number.isFinite(discount) || discount < 0 || discount >= 100) throw new Error("Descuento inválido");
  const adjustedPrice = product.source_price * (1 - discount / 100);
  const price = options.roundToPesos ? Math.round(adjustedPrice) : Math.round(adjustedPrice * 100) / 100;
  if (price <= 0) throw new Error("Precio final inválido");
  return {
    name: product.name.trim(),
    slug: sourceSlug,
    description: product.description.trim(),
    price,
    stock: 0,
    category_id: categoryId,
    image_urls: imageUrls,
    is_active: true,
    is_featured: false,
  };
}