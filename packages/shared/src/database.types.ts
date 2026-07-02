export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          action_label: string
          body: string
          created_at: string
          generated_for: string
          id: string
          language: string
          metrics: Json
          recommendation: string
          restaurant_id: string
          title: string
        }
        Insert: {
          action_label?: string
          body: string
          created_at?: string
          generated_for: string
          id?: string
          language?: string
          metrics?: Json
          recommendation?: string
          restaurant_id: string
          title: string
        }
        Update: {
          action_label?: string
          body?: string
          created_at?: string
          generated_for?: string
          id?: string
          language?: string
          metrics?: Json
          recommendation?: string
          restaurant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_i18n: Json
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_i18n?: Json
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_i18n?: Json
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          restaurant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          restaurant_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          restaurant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          allergens: string[]
          category_id: string
          created_at: string
          description_i18n: Json
          dietary_tags: string[]
          id: string
          is_available: boolean
          is_popular: boolean
          name_i18n: Json
          photo_url: string | null
          price_millimes: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          category_id: string
          created_at?: string
          description_i18n?: Json
          dietary_tags?: string[]
          id?: string
          is_available?: boolean
          is_popular?: boolean
          name_i18n?: Json
          photo_url?: string | null
          price_millimes: number
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          category_id?: string
          created_at?: string
          description_i18n?: Json
          dietary_tags?: string[]
          id?: string
          is_available?: boolean
          is_popular?: boolean
          name_i18n?: Json
          photo_url?: string | null
          price_millimes?: number
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          id: string
          item_id: string
          max_select: number
          min_select: number
          name_i18n: Json
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          item_id: string
          max_select?: number
          min_select?: number
          name_i18n?: Json
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          item_id?: string
          max_select?: number
          min_select?: number
          name_i18n?: Json
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          group_id: string
          id: string
          is_available: boolean
          name_i18n: Json
          price_delta_millimes: number
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          group_id: string
          id?: string
          is_available?: boolean
          name_i18n?: Json
          price_delta_millimes?: number
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          group_id?: string
          id?: string
          is_available?: boolean
          name_i18n?: Json
          price_delta_millimes?: number
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifiers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          item_id: string | null
          modifiers_snapshot: Json
          name_snapshot: Json
          note: string
          order_id: string
          qty: number
          restaurant_id: string
          unit_price_millimes: number
        }
        Insert: {
          id?: string
          item_id?: string | null
          modifiers_snapshot?: Json
          name_snapshot?: Json
          note?: string
          order_id: string
          qty: number
          restaurant_id: string
          unit_price_millimes: number
        }
        Update: {
          id?: string
          item_id?: string | null
          modifiers_snapshot?: Json
          name_snapshot?: Json
          note?: string
          order_id?: string
          qty?: number
          restaurant_id?: string
          unit_price_millimes?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          id: string
          language: string
          note: string
          order_number: string
          ready_at: string | null
          restaurant_id: string
          served_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string
          total_millimes: number
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          note?: string
          order_number?: string
          ready_at?: string | null
          restaurant_id: string
          served_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id: string
          total_millimes?: number
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          note?: string
          order_number?: string
          ready_at?: string | null
          restaurant_id?: string
          served_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string
          total_millimes?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          city: string
          cover_url: string | null
          created_at: string
          currency: string
          default_language: string
          id: string
          is_active: boolean
          languages: string[]
          logo_url: string | null
          name: string
          opening_hours: Json
          phone: string
          plan: string
          slug: string
          tagline_i18n: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          default_language?: string
          id?: string
          is_active?: boolean
          languages?: string[]
          logo_url?: string | null
          name: string
          opening_hours?: Json
          phone?: string
          plan?: string
          slug: string
          tagline_i18n?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          default_language?: string
          id?: string
          is_active?: boolean
          languages?: string[]
          logo_url?: string | null
          name?: string
          opening_hours?: Json
          phone?: string
          plan?: string
          slug?: string
          tagline_i18n?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          auth_uid: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          auth_uid: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          restaurant_id: string
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          auth_uid?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          restaurant_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          qr_token: string
          restaurant_id: string
          sort_order: number
          zone: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          qr_token?: string
          restaurant_id: string
          sort_order?: number
          zone?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          qr_token?: string
          restaurant_id?: string
          sort_order?: number
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_calls: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string
          reason: Database["public"]["Enums"]["waiter_call_reason"]
          restaurant_id: string
          status: Database["public"]["Enums"]["waiter_call_status"]
          table_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          reason?: Database["public"]["Enums"]["waiter_call_reason"]
          restaurant_id: string
          status?: Database["public"]["Enums"]["waiter_call_status"]
          table_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          reason?: Database["public"]["Enums"]["waiter_call_reason"]
          restaurant_id?: string
          status?: Database["public"]["Enums"]["waiter_call_status"]
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      staff_has_role: {
        Args: { roles: Database["public"]["Enums"]["staff_role"][] }
        Returns: boolean
      }
      staff_restaurant_id: { Args: never; Returns: string }
    }
    Enums: {
      order_status: "new" | "preparing" | "ready" | "served" | "cancelled"
      staff_role: "owner" | "manager" | "waiter" | "kitchen"
      waiter_call_reason: "bill" | "water" | "cutlery" | "other"
      waiter_call_status: "open" | "acknowledged"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      order_status: ["new", "preparing", "ready", "served", "cancelled"],
      staff_role: ["owner", "manager", "waiter", "kitchen"],
      waiter_call_reason: ["bill", "water", "cutlery", "other"],
      waiter_call_status: ["open", "acknowledged"],
    },
  },
} as const

