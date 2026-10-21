import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };
export type Bundle = {
  id: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
  updated_at: string;
};
export type Coupon = {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minimum: number;
  category_id: string | null;
  starts_at: string;
  ends_at: string;
  max_uses: number;
  per_customer: number;
  first_purchase: boolean;
  is_active: boolean;
  updated_at: string;
};
export type CommerceDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      bundles: Table<Bundle>;
      bundle_components: Table<{ bundle_id: string; product_id: string; quantity: number }>;
      coupons: Table<Coupon>;
      product_costs: Table<{ product_id: string; unit_cost: number; updated_at: string }>;
      order_picking: Table<{
        item_id: string;
        checked: boolean;
        updated_by: string;
        updated_at: string;
      }>;
      stock_notifications: Table<{
        id: string;
        user_id: string;
        product_id: string;
        state: string;
        claimed_at: string | null;
        sent_at: string | null;
        created_at: string;
      }>;
    };
    Functions: Database["public"]["Functions"] & {
      preview_store_cart: { Args: { payload: Json }; Returns: Json };
      manage_stock_notice: { Args: { pid: string; cancel?: boolean }; Returns: boolean };
      list_store_bundles: { Args: Record<string, never>; Returns: Json };
      commerce_quote: { Args: { payload: Json; exclude_order?: string }; Returns: Json };
      admin_commerce: { Args: { action: string; payload: Json }; Returns: Json };
      admin_profit_report: { Args: { p_from: string; p_to: string }; Returns: Json };
      claim_stock_notifications: { Args: Record<string, never>; Returns: Json };
    };
  };
};
export const commerce = supabase as unknown as SupabaseClient<CommerceDatabase>;
export type StoreBundle = Bundle & {
  stock: number;
  components: { product_id: string; name: string; quantity: number }[];
};
