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
      home_slides: {
        Row: {
          id: string
          title: string
          subtitle: string
          alt_text: string
          image_path: string
          mobile_position: number
          destination: string
          category_id: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title?: string
          subtitle?: string
          alt_text?: string
          image_path?: string
          mobile_position?: number
          destination?: string
          category_id?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          subtitle?: string
          alt_text?: string
          image_path?: string
          mobile_position?: number
          destination?: string
          category_id?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [{foreignKeyName:"home_slides_category_id_fkey";columns:["category_id"];isOneToOne:false;referencedRelation:"categories";referencedColumns:["id"]}]
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
      order_events: {
        Row: {
          created_at: string
          detail: Json
          id: number
          kind: string
          order_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: never
          kind: string
          order_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: never
          kind?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          checkout_url: string | null
          created_at: string
          expires_at: string
          id: string
          items: Json
          last_error: string | null
          order_id: string
          payment_id: string | null
          preference_id: string | null
          shipping_cost: number
          state: string
          subtotal: number
          total: number
        }
        Insert: {
          checkout_url?: string | null
          created_at?: string
          expires_at: string
          id?: string
          items: Json
          last_error?: string | null
          order_id: string
          payment_id?: string | null
          preference_id?: string | null
          shipping_cost: number
          state?: string
          subtotal: number
          total: number
        }
        Update: {
          checkout_url?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          items?: Json
          last_error?: string | null
          order_id?: string
          payment_id?: string | null
          preference_id?: string | null
          shipping_cost?: number
          state?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_recovery_emails: {
        Row: {
          attempts: number
          created_at: string
          first_send_at: string | null
          id: string
          last_error: string | null
          lease_token: string | null
          lease_until: string | null
          next_attempt_at: string
          order_id: string
          payload: Json | null
          provider_email_id: string | null
          sent_at: string | null
          state: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          first_send_at?: string | null
          id?: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          order_id: string
          payload?: Json | null
          provider_email_id?: string | null
          sent_at?: string | null
          state?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          first_send_at?: string | null
          id?: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          order_id?: string
          payload?: Json | null
          provider_email_id?: string | null
          sent_at?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_recovery_emails_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stock_reservations: {
        Row: {
          attempt_id: string
          expires_at: string
          order_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          attempt_id: string
          expires_at: string
          order_id: string
          product_id: string
          quantity: number
        }
        Update: {
          attempt_id?: string
          expires_at?: string
          order_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_stock_reservations_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "order_payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          abandon_at: string
          archived_at: string | null
          checkout_key: string | null
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
          last_reconciled_at: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          needs_review: boolean
          notes: string | null
          order_number: number
          pickup_branch: string | null
          recovery_due_at: string
          recovery_sent_at: string | null
          reservation_until: string | null
          review_reason: string | null
          shipping_cost: number
          status: Database["public"]["Enums"]["order_status"]
          stock_committed_at: string | null
          subtotal: number
          total: number
          updated_at: string
          whatsapp_sent: boolean
        }
        Insert: {
          abandon_at?: string
          archived_at?: string | null
          checkout_key?: string | null
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
          last_reconciled_at?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          needs_review?: boolean
          notes?: string | null
          order_number?: number
          pickup_branch?: string | null
          recovery_due_at?: string
          recovery_sent_at?: string | null
          reservation_until?: string | null
          review_reason?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_committed_at?: string | null
          subtotal: number
          total: number
          updated_at?: string
          whatsapp_sent?: boolean
        }
        Update: {
          abandon_at?: string
          archived_at?: string | null
          checkout_key?: string | null
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
          last_reconciled_at?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          needs_review?: boolean
          notes?: string | null
          order_number?: number
          pickup_branch?: string | null
          recovery_due_at?: string
          recovery_sent_at?: string | null
          reservation_until?: string | null
          review_reason?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_committed_at?: string | null
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
      save_home_slide: { Args: {slide:Json;expected_updated_at?:string|null}; Returns:string }
      reorder_home_slides: { Args: {slides:Json}; Returns:undefined }
      delete_home_slide: { Args: {slide_id:string;expected_updated_at:string}; Returns:undefined }

      admin_order_action: {
        Args: { action: string; note?: string; oid: string }
        Returns: undefined
      }
      apply_price_policy: {
        Args: {
          p_adjust_compare?: boolean
          p_mode: string
          p_percentage: number
          p_rows: Json
        }
        Returns: number
      }
      apply_verified_order_payment: {
        Args: { attempt_id: string; payment: string; provider_status: string }
        Returns: undefined
      }
      attach_order_preference: {
        Args: { attempt_id: string; checkout: string; preference: string }
        Returns: undefined
      }
      authorize_order_job: {
        Args: { provided_token: string }
        Returns: boolean
      }
      authorize_order_recovery_send: {
        Args: { eid: string; lease: string }
        Returns: boolean
      }
      claim_order_recovery_email: { Args: never; Returns: Json }
      expire_order_reservations: { Args: never; Returns: undefined }
      fail_order_attempt: { Args: { attempt_id: string }; Returns: undefined }
      fail_order_recovery_email: {
        Args: {
          eid: string
          error_code: string
          lease: string
          permanent?: boolean
        }
        Returns: undefined
      }
      finish_order_recovery_email: {
        Args: { eid: string; lease: string; provider_id: string }
        Returns: undefined
      }
      get_order_recovery_enabled: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      prepare_order_recovery_email: {
        Args: { body: Json; eid: string; lease: string }
        Returns: Json
      }
      reserve_order_checkout: {
        Args: { existing_id?: string; payload: Json; request_key?: string }
        Returns: Json
      }
      update_products_from_excel: { Args: { rows: Json }; Returns: number }
    }
    Enums: {
      app_role: "admin"
      delivery_method: "pickup" | "shipping"
      order_status:
        | "pending_payment"
        | "paid"
        | "preparing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "abandoned"
        | "payment_rejected"
        | "recovery_pending"
        | "recovery_notified"
        | "abandoned_final"
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
        "pending_payment",
        "paid",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
        "abandoned",
        "payment_rejected",
        "recovery_pending",
        "recovery_notified",
        "abandoned_final",
      ],
      time_slot: ["morning", "afternoon", "evening"],
    },
  },
} as const
