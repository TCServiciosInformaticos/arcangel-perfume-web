export type SalesSummary = {
  revenue?: number;
  shipping?: number;
  orders?: number;
  units?: number;
  average?: number;
  estimated_dates?: number;
};
export type SalesProduct = {
  id: string;
  name: string;
  article_code: string | null;
  category: string;
  brand: string;
  stock: number;
  is_active: boolean;
  created_at: string;
  units: number;
  revenue: number;
};
export type SalesStatistics = {
  current: SalesSummary;
  previous: SalesSummary;
  daily: { day: string; revenue: number; orders: number }[];
  products: SalesProduct[];
  categories: Breakdown[];
  brands: Breakdown[];
  statuses: Record<string, number>;
  unverified_orders: number;
  deleted_product_units: number;
  generated_at: string;
};
export type Breakdown = { name: string; units: number; revenue: number };
const salesDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function buenosAiresDate(now = new Date()) {
  return salesDateFormatter.format(now);
}
export function shiftDate(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function validateSalesDates(from: string, to: string) {
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(from) || !valid(to) || from > to)
    return "Revisá las fechas: Desde debe ser anterior o igual a Hasta.";
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 365)
    return "El período máximo es de 366 días.";
  return "";
}
export function previousSalesPeriod(from: string, to: string) {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  return { from: shiftDate(from, -days), to: shiftDate(from, -1) };
}
export function salesChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "Sin cambios" : "Sin base anterior";
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "+" : ""}${change.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}
export function rankSalesProducts(
  products: SalesProduct[],
  mode: "best" | "least" | "none" | "stock",
  metric: "units" | "revenue",
  threshold: number,
  to: string,
) {
  const eligible = products.filter((p) => buenosAiresDate(new Date(p.created_at)) <= to);
  if (mode === "stock")
    return products
      .filter((p) => p.is_active && p.stock <= threshold)
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "es"));
  if (mode === "none")
    return eligible
      .filter((p) => p.is_active && p.units === 0)
      .sort(
        (a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name, "es"),
      );
  // Keep zero sellers separate and avoid implying a past availability history.
  return eligible
    .filter((p) => p.units > 0)
    .sort(
      (a, b) =>
        (mode === "best" ? b[metric] - a[metric] : a[metric] - b[metric]) ||
        a.name.localeCompare(b.name, "es"),
    );
}
