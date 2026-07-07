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
      admin_allowlist: {
        Row: {
          created_at: string
          display_name: string
          email: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
        }
        Relationships: []
      }
      ai_extractions: {
        Row: {
          created_at: string
          id: string
          image_count: number
          input_tokens: number | null
          model: string
          output_tokens: number | null
          requested_by: string | null
          restaurant_id: string
          total_bytes: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_count: number
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          requested_by?: string | null
          restaurant_id: string
          total_bytes: number
        }
        Update: {
          created_at?: string
          id?: string
          image_count?: number
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          requested_by?: string | null
          restaurant_id?: string
          total_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_extractions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_menu_imports: {
        Row: {
          created_at: string
          import_ref: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          import_ref: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          import_ref?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_menu_imports_restaurant_id_fkey"
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
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name_i18n: Json
          parent_id: string | null
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_i18n?: Json
          parent_id?: string | null
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_i18n?: Json
          parent_id?: string | null
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
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
      inventory_items: {
        Row: {
          auto_86: boolean
          category: string
          created_at: string
          id: string
          is_active: boolean
          last_alert_level: Database["public"]["Enums"]["stock_level"]
          last_alerted_at: string | null
          name: string
          note: string
          par_level: number | null
          qty_on_hand: number
          reorder_threshold: number
          restaurant_id: string
          source: string | null
          supplier_name: string
          supplier_phone: string
          track: boolean
          unit: string
          unit_cost_millimes: number | null
          updated_at: string
        }
        Insert: {
          auto_86?: boolean
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_alert_level?: Database["public"]["Enums"]["stock_level"]
          last_alerted_at?: string | null
          name: string
          note?: string
          par_level?: number | null
          qty_on_hand?: number
          reorder_threshold?: number
          restaurant_id: string
          source?: string | null
          supplier_name?: string
          supplier_phone?: string
          track?: boolean
          unit?: string
          unit_cost_millimes?: number | null
          updated_at?: string
        }
        Update: {
          auto_86?: boolean
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_alert_level?: Database["public"]["Enums"]["stock_level"]
          last_alerted_at?: string | null
          name?: string
          note?: string
          par_level?: number | null
          qty_on_hand?: number
          reorder_threshold?: number
          restaurant_id?: string
          source?: string | null
          supplier_name?: string
          supplier_phone?: string
          track?: boolean
          unit?: string
          unit_cost_millimes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      item_ingredients: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          item_id: string
          qty_per_unit: number
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          item_id: string
          qty_per_unit: number
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          item_id?: string
          qty_per_unit?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_ingredients_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_ingredients_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_ingredients_restaurant_id_fkey"
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
          rating_avg: number | null
          rating_count: number
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
          rating_avg?: number | null
          rating_count?: number
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
          rating_avg?: number | null
          rating_count?: number
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
      leads: {
        Row: {
          business_name: string
          city: string
          created_at: string
          email: string
          id: string
          ip: string | null
          locale: string
          message: string
          name: string
          phone: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          business_name?: string
          city?: string
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          locale?: string
          message?: string
          name: string
          phone?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          city?: string
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          locale?: string
          message?: string
          name?: string
          phone?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          inventory_item_id: string | null
          is_read: boolean
          read_at: string | null
          restaurant_id: string
          severity: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          inventory_item_id?: string | null
          is_read?: boolean
          read_at?: string | null
          restaurant_id: string
          severity?: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          inventory_item_id?: string | null
          is_read?: boolean
          read_at?: string | null
          restaurant_id?: string
          severity?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
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
          participant_nickname: string
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
          participant_nickname?: string
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
          participant_nickname?: string
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
      order_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          host_uid: string | null
          id: string
          restaurant_id: string
          share_code: string
          status: string
          table_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          host_uid?: string | null
          id?: string
          restaurant_id: string
          share_code: string
          status?: string
          table_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          host_uid?: string | null
          id?: string
          restaurant_id?: string
          share_code?: string
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          client_ref: string | null
          created_at: string
          created_by: string | null
          id: string
          language: string
          note: string
          order_number: string
          origin: string
          ready_at: string | null
          restaurant_id: string
          served_at: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string
          total_millimes: number
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          client_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          note?: string
          order_number?: string
          origin?: string
          ready_at?: string | null
          restaurant_id: string
          served_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id: string
          total_millimes?: number
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          client_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          note?: string
          order_number?: string
          origin?: string
          ready_at?: string | null
          restaurant_id?: string
          served_at?: string | null
          session_id?: string | null
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
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "order_sessions"
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
      platform_admins: {
        Row: {
          auth_uid: string
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          auth_uid: string
          created_at?: string
          display_name?: string
          id?: string
        }
        Update: {
          auth_uid?: string
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      platform_reviews_config: {
        Row: {
          allow_comments: boolean
          cooldown_hours: number
          id: boolean
          max_comment_len: number
          min_comment_len: number
          moderation_mode: string
          review_window_days: number
          reviews_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_comments?: boolean
          cooldown_hours?: number
          id?: boolean
          max_comment_len?: number
          min_comment_len?: number
          moderation_mode?: string
          review_window_days?: number
          reviews_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_comments?: boolean
          cooldown_hours?: number
          id?: boolean
          max_comment_len?: number
          min_comment_len?: number
          moderation_mode?: string
          review_window_days?: number
          reviews_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string
          appearance: Json
          city: string
          cover_url: string | null
          created_at: string
          currency: string
          default_language: string
          id: string
          inventory_alerts_enabled: boolean
          is_active: boolean
          languages: string[]
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          onboarding_completed_at: string | null
          opening_hours: Json
          order_seq: number
          phone: string
          plan: string
          rating_avg: number | null
          rating_count: number
          require_qr: boolean
          reviews_enabled: boolean
          slug: string
          tagline_i18n: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string
          appearance?: Json
          city?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          default_language?: string
          id?: string
          inventory_alerts_enabled?: boolean
          is_active?: boolean
          languages?: string[]
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          onboarding_completed_at?: string | null
          opening_hours?: Json
          order_seq?: number
          phone?: string
          plan?: string
          rating_avg?: number | null
          rating_count?: number
          require_qr?: boolean
          reviews_enabled?: boolean
          slug: string
          tagline_i18n?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          appearance?: Json
          city?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          default_language?: string
          id?: string
          inventory_alerts_enabled?: boolean
          is_active?: boolean
          languages?: string[]
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          onboarding_completed_at?: string | null
          opening_hours?: Json
          order_seq?: number
          phone?: string
          plan?: string
          rating_avg?: number | null
          rating_count?: number
          require_qr?: boolean
          reviews_enabled?: boolean
          slug?: string
          tagline_i18n?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          client_ref: string | null
          comment: string
          created_at: string
          created_by: string
          customer_name: string
          id: string
          item_id: string | null
          item_key: string | null
          moderated_at: string | null
          moderated_by: string | null
          order_id: string
          rating: number
          restaurant_id: string
          sentiment: string | null
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
        }
        Insert: {
          client_ref?: string | null
          comment?: string
          created_at?: string
          created_by: string
          customer_name?: string
          id?: string
          item_id?: string | null
          item_key?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          order_id: string
          rating: number
          restaurant_id: string
          sentiment?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Update: {
          client_ref?: string | null
          comment?: string
          created_at?: string
          created_by?: string
          customer_name?: string
          id?: string
          item_id?: string | null
          item_key?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          order_id?: string
          rating?: number
          restaurant_id?: string
          sentiment?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      session_cart_lines: {
        Row: {
          created_at: string
          id: string
          item_id: string
          modifier_ids: string[]
          note: string
          participant_id: string
          qty: number
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          modifier_ids?: string[]
          note?: string
          participant_id: string
          qty: number
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          modifier_ids?: string[]
          note?: string
          participant_id?: string
          qty?: number
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_cart_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cart_lines_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "session_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cart_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "order_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          auth_uid: string
          id: string
          is_host: boolean
          is_ready: boolean
          joined_at: string
          left_at: string | null
          nickname: string
          session_id: string
        }
        Insert: {
          auth_uid: string
          id?: string
          is_host?: boolean
          is_ready?: boolean
          joined_at?: string
          left_at?: string | null
          nickname?: string
          session_id: string
        }
        Update: {
          auth_uid?: string
          id?: string
          is_host?: boolean
          is_ready?: boolean
          joined_at?: string
          left_at?: string | null
          nickname?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "order_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string
          order_id: string | null
          qty_after: number
          qty_delta: number
          reason: string
          restaurant_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost_millimes: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id: string
          order_id?: string | null
          qty_after: number
          qty_delta: number
          reason?: string
          restaurant_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost_millimes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string
          order_id?: string | null
          qty_after?: number
          qty_delta?: number
          reason?: string
          restaurant_id?: string
          type?: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost_millimes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_restaurant_id_fkey"
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
      admin_leads: {
        Args: never
        Returns: {
          business_name: string
          city: string
          created_at: string
          email: string
          id: string
          ip: string | null
          locale: string
          message: string
          name: string
          phone: string
          source: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_reviews_moderation: {
        Args: { p_status?: string }
        Returns: {
          comment: string
          created_at: string
          customer_name: string
          id: string
          item_name: Json
          order_number: string
          rating: number
          restaurant_id: string
          restaurant_name: string
          sentiment: string
          status: Database["public"]["Enums"]["review_status"]
        }[]
      }
      admin_venue_overview: {
        Args: never
        Returns: {
          city: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          onboarding_completed_at: string
          order_count: number
          plan: string
          slug: string
          staff_count: number
          table_count: number
        }[]
      }
      apply_stock_change: {
        Args: {
          p_actor: string
          p_delta: number
          p_item_id: string
          p_order_id: string
          p_reason: string
          p_type: Database["public"]["Enums"]["stock_movement_type"]
          p_unit_cost: number
        }
        Returns: Json
      }
      assert_manages_inventory: {
        Args: { p_item_id: string }
        Returns: {
          auto_86: boolean
          category: string
          created_at: string
          id: string
          is_active: boolean
          last_alert_level: Database["public"]["Enums"]["stock_level"]
          last_alerted_at: string | null
          name: string
          note: string
          par_level: number | null
          qty_on_hand: number
          reorder_threshold: number
          restaurant_id: string
          source: string | null
          supplier_name: string
          supplier_phone: string
          track: boolean
          unit: string
          unit_cost_millimes: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clean_nickname: { Args: { p_nickname: string }; Returns: string }
      deplete_inventory_for_order: {
        Args: { p_actor: string; p_order_id: string }
        Returns: undefined
      }
      gen_session_code: { Args: never; Returns: string }
      import_menu_draft: {
        Args: { p_draft: Json; p_import_ref?: string; p_restaurant_id: string }
        Returns: Json
      }
      insights_metrics: {
        Args: { p_days: number; p_restaurant_id: string }
        Returns: Json
      }
      inventory_overview: { Args: { p_restaurant_id: string }; Returns: Json }
      is_platform_admin: { Args: never; Returns: boolean }
      is_session_member: { Args: { p_session: string }; Returns: boolean }
      item_reviews: { Args: { p_item_id: string }; Returns: Json }
      join_session: {
        Args: {
          p_nickname?: string
          p_session_id?: string
          p_share_code?: string
        }
        Returns: Json
      }
      leave_session: { Args: { p_session: string }; Returns: undefined }
      list_venue_tables: {
        Args: { p_slug: string }
        Returns: {
          id: string
          label: string
          sort_order: number
          zone: string
        }[]
      }
      low_stock_items: { Args: { p_restaurant_id: string }; Returns: Json }
      place_order_tx: {
        Args: {
          p_client_ref: string
          p_created_by: string
          p_language: string
          p_lines: Json
          p_note: string
          p_participant_id?: string
          p_place_mode?: string
          p_restaurant_id: string
          p_session_id?: string
          p_table_id: string
          p_total_millimes: number
        }
        Returns: Json
      }
      place_review_tx: {
        Args: {
          p_client_ref: string
          p_created_by: string
          p_customer_name: string
          p_items: Json
          p_order_id: string
          p_restaurant_id: string
          p_status: Database["public"]["Enums"]["review_status"]
          p_venue: Json
        }
        Returns: Json
      }
      ratings_summary: { Args: { p_restaurant_id: string }; Returns: Json }
      recent_lead_count: { Args: { p_email: string }; Returns: number }
      recompute_item_rating: { Args: { p_item_id: string }; Returns: undefined }
      recompute_restaurant_rating: {
        Args: { p_restaurant_id: string }
        Returns: undefined
      }
      record_stock_movement: {
        Args: {
          p_item_id: string
          p_qty: number
          p_reason?: string
          p_type: string
          p_unit_cost?: number
        }
        Returns: Json
      }
      replace_insights: {
        Args: { p_generated_for: string; p_restaurant_id: string; p_rows: Json }
        Returns: number
      }
      resolve_table: {
        Args: { p_qr_token: string }
        Returns: {
          id: string
          label: string
          restaurant_id: string
          zone: string
        }[]
      }
      restock_cancelled_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      set_session_nickname: {
        Args: { p_nickname: string; p_session: string }
        Returns: undefined
      }
      set_session_ready: {
        Args: { p_ready: boolean; p_session: string }
        Returns: undefined
      }
      set_stock_count: {
        Args: { p_item_id: string; p_new_qty: number; p_reason?: string }
        Returns: Json
      }
      staff_has_role: {
        Args: { roles: Database["public"]["Enums"]["staff_role"][] }
        Returns: boolean
      }
      staff_restaurant_id: { Args: never; Returns: string }
      start_session: {
        Args: { p_nickname?: string; p_qr_token?: string; p_table_id?: string }
        Returns: Json
      }
      stats_summary: {
        Args: { p_days: number; p_restaurant_id: string }
        Returns: Json
      }
      stock_level_of: {
        Args: { p_qty: number; p_threshold: number; p_track: boolean }
        Returns: Database["public"]["Enums"]["stock_level"]
      }
      stock_level_rank: {
        Args: { p_level: Database["public"]["Enums"]["stock_level"] }
        Returns: number
      }
      stock_movements_list: {
        Args: { p_item_id: string; p_limit?: number }
        Returns: Json
      }
      sync_stock_alerts: { Args: { p_restaurant_id: string }; Returns: number }
      venue_alert_recipients: {
        Args: { p_restaurant_id: string }
        Returns: {
          display_name: string
          email: string
        }[]
      }
      venue_rating_summary: { Args: { p_slug: string }; Returns: Json }
    }
    Enums: {
      order_status: "new" | "preparing" | "ready" | "served" | "cancelled"
      review_status: "pending" | "approved" | "rejected" | "hidden"
      staff_role: "owner" | "manager" | "waiter" | "kitchen"
      stock_level: "ok" | "low" | "out"
      stock_movement_type:
        | "receive"
        | "sale"
        | "waste"
        | "adjustment"
        | "count"
        | "cancel_return"
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
      review_status: ["pending", "approved", "rejected", "hidden"],
      staff_role: ["owner", "manager", "waiter", "kitchen"],
      stock_level: ["ok", "low", "out"],
      stock_movement_type: [
        "receive",
        "sale",
        "waste",
        "adjustment",
        "count",
        "cancel_return",
      ],
      waiter_call_reason: ["bill", "water", "cutlery", "other"],
      waiter_call_status: ["open", "acknowledged"],
    },
  },
} as const

