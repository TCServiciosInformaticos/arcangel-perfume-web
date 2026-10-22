import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { StaffModule } from "./staff-permissions";
export type StaffAccount = {
  user_id: string;
  name: string;
  email: string;
  modules: StaffModule[];
  enabled: boolean;
  updated_at: string;
  created_at: string;
};
type StaffDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      staff_accounts: {
        Row: StaffAccount;
        Insert: StaffAccount;
        Update: Partial<StaffAccount>;
        Relationships: [];
      };
    };
    Functions: Database["public"]["Functions"] & {
      admin_save_staff: {
        Args: {
          employee_id: string;
          employee_name: string;
          allowed_modules: string[];
          active: boolean;
          expected_version: string;
        };
        Returns: Json;
      };
    };
  };
};
export const staffClient = supabase as unknown as SupabaseClient<StaffDatabase>;
