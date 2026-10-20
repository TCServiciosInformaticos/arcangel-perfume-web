export type SourceProduct = {
  name: string;
  source_url: string;
  source_price: number;
  description: string;
};

const ISSUE_HOSTS = ["issueprofessional.com", "www.issueprofessional.com"];
const DOAN_HOSTS = ["doan.com.ar", "www.doan.com.ar"];
const FRENZZI_HOSTS = ["frenzziargentina.com", "www.frenzziargentina.com"];
const DOAN_BRANDS: Record<string, string> = { "138": "dove", "304": "nivea", "90": "cicatricure", "170": "garnier", "126": "dermaglos" };
const CANNON_HOSTS = ["fraganciascannon.com", "www.fraganciascannon.com"];
const ZERO_PRICE_HOSTS = ["hancolor.com.ar", "www.hancolor.com.ar", ...ISSUE_HOSTS];

export function prepareCatalogProduct(product: SourceProduct, imageUrls: string[], categoryId: string, options: { discountPercent?: number; roundToPesos?: boolean; allowZeroPrice?: boolean; slugPrefix?: string } = {}) {
  if (!product.name.trim() || !product.description.trim()) throw new Error("Falta nombre o descripción");
  const source = new URL(product.source_url);
  // The owner explicitly authorized zero-price imports from these manufacturer catalogs.
  const zeroPriceAllowed = options.allowZeroPrice === true && ZERO_PRICE_HOSTS.includes(source.hostname);
  if (options.allowZeroPrice && !zeroPriceAllowed) throw new Error("Precio cero no autorizado para este origen");
  if (!Number.isFinite(product.source_price) || product.source_price < 0 || (product.source_price === 0 && !zeroPriceAllowed)) throw new Error("Falta precio publicado válido");
  const doanProductId = source.searchParams.get("product_id");
  const isDoan = DOAN_HOSTS.includes(source.hostname);
  const doanBrand = DOAN_BRANDS[source.searchParams.get("manufacturer_id") ?? ""];
  const validDoanSource = source.searchParams.get("route") === "product/product" && Boolean(doanBrand) && /^[1-9][0-9]*$/.test(doanProductId ?? "");
  const sourceSlug = isDoan ? (validDoanSource ? doanBrand + "-doan-" + doanProductId : undefined) : source.pathname.split("/").filter(Boolean).at(-1);
  const allowedHosts = ["bmdistribuidora.com.ar", "www.bmdistribuidora.com.ar", "thelmaylouise.com.ar", "www.thelmaylouise.com.ar", ...ZERO_PRICE_HOSTS, ...CANNON_HOSTS, ...DOAN_HOSTS, ...FRENZZI_HOSTS];
  if (!sourceSlug || source.protocol !== "https:" || !allowedHosts.includes(source.hostname)) throw new Error("Origen inválido");
  const storedIssueImage = (url: string) => ISSUE_HOSTS.includes(source.hostname) && /^\/catalog\/issue\/issue-[a-z0-9-]+\.webp$/.test(url);
  const storedCannonImage = (url: string) => CANNON_HOSTS.includes(source.hostname) && /^\/catalog\/cannon\/cannon-[0-9]+-[a-z0-9-]+\.webp$/.test(url);
  const storedDoanImage = (url: string) => isDoan && validDoanSource && new RegExp("^/catalog/" + doanBrand + "/" + doanBrand + "-doan-" + doanProductId + "(-[0-9]+)?[.]webp$").test(url);
  const storedFrenzziImage = (url: string) => FRENZZI_HOSTS.includes(source.hostname) && /^\/catalog\/frenzzi\/frenzzi-[a-z0-9-]+[.]webp$/.test(url);
  if (imageUrls.length === 0 || imageUrls.some(url => !url.startsWith("/__l5e/assets-v1/") && !storedIssueImage(url) && !storedCannonImage(url) && !storedDoanImage(url) && !storedFrenzziImage(url))) throw new Error("Faltan imágenes almacenadas");
  const discount = options.discountPercent ?? 0;
  if (!Number.isFinite(discount) || discount < 0 || discount >= 100) throw new Error("Descuento inválido");
  const adjustedPrice = product.source_price * (1 - discount / 100);
  const price = options.roundToPesos ? Math.ceil(adjustedPrice) : Math.round(adjustedPrice * 100) / 100;
  if (price < 0 || (price === 0 && !zeroPriceAllowed)) throw new Error("Precio final inválido");
  return {
    name: product.name.trim(),
    slug: options.slugPrefix ? `${options.slugPrefix}${sourceSlug}` : sourceSlug,
    description: product.description.trim(),
    price,
    stock: 0,
    category_id: categoryId,
    image_urls: imageUrls,
    is_active: true,
    is_featured: false,
  };
}