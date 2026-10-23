import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
// These operations are installed by supabase/operations/admin-operations.sql.
export const operations = supabase as unknown as SupabaseClient;
export type AuditEntry = {
  id: string;
  occurred_at: string;
  actor_name: string;
  actor_id: string | null;
  entity: string;
  record_id: string;
  record_name: string;
  operation: string;
  source: string;
  changes: Record<string, { before: unknown; after: unknown }>;
};
export type Customer = {
  email: string;
  name: string;
  whatsapp: string;
  orders: number;
  paid_orders: number;
  spent: number;
  last_order: string;
  unpaid_orders: number;
};
export type CustomerOrder = {
  id: string;
  order_number: number;
  status: string;
  created_at: string;
  total: number;
  verified: boolean;
  items: { name: string; quantity: number; total: number }[];
};
export type PageResult<T> = { total: number; rows: T[] };
export const ALERT_LABELS = {
  sin_stock: "Sin stock",
  stock_bajo: "Stock bajo",
  sin_imagen: "Sin imagen",
  precio_cero: "Precio en cero",
  sin_codigo: "Sin código",
  pedido_revision: "Pedidos para revisar",
  pedido_pendiente: "Pedidos sin pago hace más de 24 h",
} as const;
export type AlertKind = keyof typeof ALERT_LABELS;
export type BusinessAlerts = {
  counts: Partial<Record<AlertKind, number>>;
  rows: { id: string; label: string; kind: AlertKind; detail: string; route: string }[];
};
export const adminDate = (value: string) =>
  new Date(value).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
export const auditEntities: Record<string, string> = {
  products: "Productos",
  categories: "Categorías",
  subcategories: "Marcas / subcategorías",
  product_types: "Tipos de producto",
  brands: "Marcas",
  home_slides: "Slider",
  orders: "Pedidos",
  staff_accounts: "Usuarios",
};
