export type PricePolicyMode = "increase" | "discount";
export type PolicyProduct = {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  updated_at: string;
  is_active: boolean;
  category_id: string | null;
  subcategory_id: string | null;
  product_type_id: string | null;
};

export function validatePercentage(value: string, mode: PricePolicyMode): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Ingresá un porcentaje válido, con hasta dos decimales.");
  const percentage = Number(normalized);
  if (!Number.isFinite(percentage) || percentage <= 0) throw new Error("El porcentaje debe ser mayor que cero.");
  if (mode === "discount" && percentage > 100) throw new Error("El descuento no puede superar el 100%.");
  return percentage;
}

// Decimal arithmetic avoids floating-point ceilings that add an extra peso.
export function adjustedPrice(price: number, percentage: number, mode: PricePolicyMode): number {
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(percentage) || percentage <= 0 || (mode === "discount" && percentage > 100)) throw new Error("Precio o porcentaje inválido.");
  const [whole, fraction = ""] = String(price).split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) throw new Error("Precio fuera de rango.");
  const denominator = 10n ** BigInt(fraction.length);
  const units = BigInt(whole + fraction);
  const basisPoints = BigInt(Math.round(percentage * 100));
  const multiplier = mode === "increase" ? 10000n + basisPoints : 10000n - basisPoints;
  const divisor = denominator * 10000n;
  const result = Number((units * multiplier + divisor - 1n) / divisor);
  if (!Number.isSafeInteger(result)) throw new Error("El precio resultante es demasiado grande.");
  return result;
}

export function previewPrice(product: Pick<PolicyProduct, "price" | "compare_at_price">, percentage: number, mode: PricePolicyMode, adjustCompare: boolean) {
  const price = adjustedPrice(Number(product.price), percentage, mode);
  const previous = product.compare_at_price === null ? null : adjustCompare ? adjustedPrice(Number(product.compare_at_price), percentage, mode) : Number(product.compare_at_price);
  return { price, compare_at_price: previous !== null && previous > price ? previous : null };
}