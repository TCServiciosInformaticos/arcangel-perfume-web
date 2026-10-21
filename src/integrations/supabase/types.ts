export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
          website?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payment_attempts: {
        Row: {
          id: string
          order_id: string
          preference_id: string | null
          checkout_url: string | null
          payment_id: string | null
          state: string
          total: number
          subtotal: number
          shipping_cost: number
          items: Json
          expires_at: string
          created_at: string
          last_error: string | null
        }
        Insert: {
          id?: string
          order_id?: string
          preference_id?: string | null
          checkout_url?: string | null
          payment_id?: string | null
          state?: string
          total?: number
          subtotal?: number
          shipping_cost?: number
          items?: Json
          expires_at?: string
          created_at?: string
          last_error?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          preference_id?: string | null
          checkout_url?: string | null
          payment_id?: string | null
          state?: string
          total?: number
          subtotal?: number
          shipping_cost?: number
          items?: Json
          expires_at?: string
          created_at?: string
          last_error?: string | null
        }
        Relationships: []
      }
      order_events: {
        Row: {
          id: number
          order_id: string
          kind: string
          detail: Json
          created_at: string
        }
        Insert: {
          id?: number
          order_id?: string
          kind?: string
          detail?: Json
          created_at?: string
        }
        Update: {
          id?: number
          order_id?: string
          kind?: string
          detail?: Json
          created_at?: string
        }
        Relationships: []
      }
      order_stock_reservations: {
        Row: {
          order_id: string
          product_id: string
          attempt_id: string
          quantity: number
          expires_at: string
        }
        Insert: {
          order_id?: string
          product_id?: string
          attempt_id?: string
          quantity?: number
          expires_at?: string
        }
        Update: {
          order_id?: string
          product_id?: string
          attempt_id?: string
          quantity?: number
          expires_at?: string
        }
        Relationships: []
      }
      order_recovery_emails: {
        Row: {
          id: string
          order_id: string
          state: string
          payload: Json | null
          lease_token: string | null
          lease_until: string | null
          next_attempt_at: string
          attempts: number
          first_send_at: string | null
          sent_at: string | null
          provider_email_id: string | null
          last_error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id?: string
          state?: string
          payload?: Json | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          attempts?: number
          first_send_at?: string | null
          sent_at?: string | null
          provider_email_id?: string | null
          last_error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          state?: string
          payload?: Json | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          attempts?: number
          first_send_at?: string | null
          sent_at?: string | null
          provider_email_id?: string | null
          last_error?: string | null
          created_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          recovery_due_at: string
          recovery_sent_at: string | null
          checkout_key: string | null
          abandon_at: string
          reservation_until: string | null
          stock_committed_at: string | null
          needs_review: boolean
          review_reason: string | null
          last_reconciled_at: string | null
          archived_at: string | null

          created_at: string
          customer_email: string
          customer_name: string
          customer_whatsapp: string
          delivery_apartment: string | null
          delivery_city: string | null
          delivery_day: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_number: string | null
          delivery_street: string | null
          delivery_time_slot: Database["public"]["Enums"]["time_slot"] | null
          delivery_zip: string | null
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          notes: string | null
          order_number: number
          pickup_branch: string | null
          shipping_cost: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          whatsapp_sent: boolean
        }
        Insert: {
          recovery_due_at?: string
          recovery_sent_at?: string | null
          checkout_key?: string | null
          abandon_at?: string
          reservation_until?: string | null
          stock_committed_at?: string | null
          needs_review?: boolean
          review_reason?: string | null
          last_reconciled_at?: string | null
          archived_at?: string | null

          created_at?: string
          customer_email: string
          customer_name: string
          customer_whatsapp: string
          delivery_apartment?: string | null
          delivery_city?: string | null
          delivery_day?: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_number?: string | null
          delivery_street?: string | null
          delivery_time_slot?: Database["public"]["Enums"]["time_slot"] | null
          delivery_zip?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          notes?: string | null
          order_number?: number
          pickup_branch?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at?: string
          whatsapp_sent?: boolean
        }
        Update: {
          recovery_due_at?: string
          recovery_sent_at?: string | null
          checkout_key?: string | null
          abandon_at?: string
          reservation_until?: string | null
          stock_committed_at?: string | null
          needs_review?: boolean
          review_reason?: string | null
          last_reconciled_at?: string | null
          archived_at?: string | null

          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_whatsapp?: string
          delivery_apartment?: string | null
          delivery_city?: string | null
          delivery_day?: string | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          delivery_number?: string | null
          delivery_street?: string | null
          delivery_time_slot?: Database["public"]["Enums"]["time_slot"] | null
          delivery_zip?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          notes?: string | null
          order_number?: number
          pickup_branch?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          whatsapp_sent?: boolean
        }
        Relationships: []
      }
      product_types: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          subcategory_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          subcategory_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_types_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          article_code: string | null
          category_id: string | null
          compare_at_price: number | null
          created_at: string
          description: string | null
          id: string
          image_urls: string[]
          is_active: boolean
          is_featured: boolean
          name: string
          price: number
          product_type_id: string | null
          slug: string
          stock: number
          subcategory_id: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          article_code?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_urls?: string[]
          is_active?: boolean
          is_featured?: boolean
          name: string
          price: number
          product_type_id?: string | null
          slug: string
          stock?: number
          subcategory_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          article_code?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_urls?: string[]
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price?: number
          product_type_id?: string | null
          slug?: string
          stock?: number
          subcategory_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_product_type_subcategory_fkey"
            columns: ["subcategory_id", "product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["subcategory_id", "id"]
          },
          {
            foreignKeyName: "products_subcategory_category_fkey"
            columns: ["category_id", "subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["category_id", "id"]
          },
        ]
      }
      settings: {
        Row: {
          hero_subtitle: string | null
          id: number
          pickup_address: string | null
          shipping_cost: number
          shipping_zones: string | null
          store_email: string | null
          store_hours: string | null
          store_name: string
          store_whatsapp: string
          updated_at: string
        }
        Insert: {
          hero_subtitle?: string | null
          id?: number
          pickup_address?: string | null
          shipping_cost?: number
          shipping_zones?: string | null
          store_email?: string | null
          store_hours?: string | null
          store_name?: string
          store_whatsapp?: string
          updated_at?: string
        }
        Update: {
          hero_subtitle?: string | null
          id?: number
          pickup_address?: string | null
          shipping_cost?: number
          shipping_zones?: string | null
          store_email?: string | null
          store_hours?: string | null
          store_name?: string
          store_whatsapp?: string
          updated_at?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_price_policy: {
        Args: {
          p_adjust_compare?: boolean
          p_mode: string
          p_percentage: number
          p_rows: Json
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      get_order_recovery_enabled: { Args: Record<string, never>; Returns: boolean }
      claim_order_recovery_email: { Args: Record<string, never>; Returns: Json }
      prepare_order_recovery_email: { Args: {eid:string;lease:string;body:Json}; Returns: Json }
      authorize_order_recovery_send: { Args: {eid:string;lease:string}; Returns: boolean }
      finish_order_recovery_email: { Args: {eid:string;lease:string;provider_id:string}; Returns: undefined }
      fail_order_recovery_email: { Args: {eid:string;lease:string;error_code:string;permanent?:boolean}; Returns: undefined }
      reserve_order_checkout: { Args: {payload: Json; existing_id?: string | null; request_key?: string | null}; Returns: Json }
      attach_order_preference: { Args: {attempt_id: string; preference: string; checkout: string}; Returns: undefined }
      fail_order_attempt: { Args: {attempt_id: string}; Returns: undefined }
      apply_verified_order_payment: { Args: {attempt_id: string; payment: string; provider_status: string}; Returns: undefined }
      expire_order_reservations: { Args: Record<string, never>; Returns: undefined }
      admin_order_action: { Args: {oid: string; action: string; note?: string | null}; Returns: undefined }
      authorize_order_job: { Args: {provided_token: string}; Returns: boolean }
      update_products_from_excel: { Args: { rows: Json }; Returns: number }
    }
    Enums: {
      app_role: "admin"
      delivery_method: "pickup" | "shipping"
      order_status:
        | "recovery_pending"
        | "recovery_notified"
        | "abandoned_final"
        | "abandoned"
        | "payment_rejected"
        | "pending_payment"
        | "paid"
        | "preparing"
        | "shipped"
        | "delivered"
        | "cancelled"
      time_slot: "morning" | "afternoon" | "evening"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
      delivery_method: ["pickup", "shipping"],
      order_status: [
        "recovery_pending",
        "recovery_notified",
        "abandoned_final",
        "abandoned",
        "payment_rejected",
        "pending_payment",
        "paid",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      time_slot: ["morning", "afternoon", "evening"],
    },
  },
} as const
