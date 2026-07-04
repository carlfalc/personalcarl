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
      birthdays: {
        Row: {
          birth_date: string
          created_at: string
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      drafts_log: {
        Row: {
          body_preview: string | null
          created_at: string
          gmail_draft_id: string
          id: string
          recipient: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          body_preview?: string | null
          created_at?: string
          gmail_draft_id: string
          id?: string
          recipient?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          body_preview?: string | null
          created_at?: string
          gmail_draft_id?: string
          id?: string
          recipient?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          content: string
          created_at: string
          due_date: string | null
          id: string
          priority: number
          status: string
          tags: string[]
          type: Database["public"]["Enums"]["entry_type"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: number
          status?: string
          tags?: string[]
          type: Database["public"]["Enums"]["entry_type"]
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: number
          status?: string
          tags?: string[]
          type?: Database["public"]["Enums"]["entry_type"]
          user_id?: string
        }
        Relationships: []
      }
      grocery_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          item: string
          quantity: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          item: string
          quantity?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          item?: string
          quantity?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      images: {
        Row: {
          caption: string | null
          created_at: string
          height: number | null
          id: string
          mime_type: string | null
          size_bytes: number | null
          source: string
          storage_path: string
          telegram_message_id: number | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          source?: string
          storage_path: string
          telegram_message_id?: number | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          source?: string
          storage_path?: string
          telegram_message_id?: number | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      itineraries: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          travel_modes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          travel_modes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          travel_modes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      itinerary_favorite_places: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          distance_label: string | null
          distance_meters: number | null
          id: string
          itinerary_id: string
          leg_id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
          why: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          distance_label?: string | null
          distance_meters?: number | null
          id?: string
          itinerary_id: string
          leg_id: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
          why?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          distance_label?: string | null
          distance_meters?: number | null
          id?: string
          itinerary_id?: string
          leg_id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_favorite_places_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_favorite_places_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "itinerary_legs"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_legs: {
        Row: {
          arrive_at: string | null
          created_at: string
          depart_at: string | null
          details: Json
          from_label: string | null
          id: string
          itinerary_id: string
          position: number
          to_label: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arrive_at?: string | null
          created_at?: string
          depart_at?: string | null
          details?: Json
          from_label?: string | null
          id?: string
          itinerary_id: string
          position?: number
          to_label?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arrive_at?: string | null
          created_at?: string
          depart_at?: string | null
          details?: Json
          from_label?: string | null
          id?: string
          itinerary_id?: string
          position?: number
          to_label?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_legs_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_nearby_searches: {
        Row: {
          created_at: string
          id: string
          leg_id: string
          query: string
          results: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leg_id: string
          query: string
          results?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leg_id?: string
          query?: string
          results?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_nearby_searches_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "itinerary_legs"
            referencedColumns: ["id"]
          },
        ]
      }
      market_quotes_cache: {
        Row: {
          change_pct: number | null
          display_symbol: string
          fetched_at: string
          market_state: string | null
          name: string
          previous_close: number | null
          price: number
          symbol: string
        }
        Insert: {
          change_pct?: number | null
          display_symbol: string
          fetched_at?: string
          market_state?: string | null
          name: string
          previous_close?: number | null
          price: number
          symbol: string
        }
        Update: {
          change_pct?: number | null
          display_symbol?: string
          fetched_at?: string
          market_state?: string | null
          name?: string
          previous_close?: number | null
          price?: number
          symbol?: string
        }
        Relationships: []
      }
      meeting_documents: {
        Row: {
          created_at: string
          file_path: string
          filename: string
          id: string
          meeting_id: string
          mime_type: string | null
          size_bytes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          filename: string
          id?: string
          meeting_id: string
          mime_type?: string | null
          size_bytes?: number | null
          user_id?: string
        }
        Update: {
          created_at?: string
          file_path?: string
          filename?: string
          id?: string
          meeting_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_documents_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          datetime: string
          google_event_id: string | null
          id: string
          location: string | null
          notes: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          datetime: string
          google_event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          datetime?: string
          google_event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      memory: {
        Row: {
          birth_date: string | null
          category: Database["public"]["Enums"]["memory_category"]
          confidence: number
          contact_email: string | null
          contact_phone: string | null
          fact: string
          id: string
          relationship: string | null
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          category: Database["public"]["Enums"]["memory_category"]
          confidence?: number
          contact_email?: string | null
          contact_phone?: string | null
          fact: string
          id?: string
          relationship?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          birth_date?: string | null
          category?: Database["public"]["Enums"]["memory_category"]
          confidence?: number
          contact_email?: string | null
          contact_phone?: string | null
          fact?: string
          id?: string
          relationship?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_email_intents: {
        Row: {
          body: string
          candidates: Json
          chat_id: number
          created_at: string
          gmail_draft_id: string | null
          id: string
          recipient_email: string | null
          recipient_name: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          candidates?: Json
          chat_id: number
          created_at?: string
          gmail_draft_id?: string | null
          id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          candidates?: Json
          chat_id?: number
          created_at?: string
          gmail_draft_id?: string | null
          id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_family_profiles: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          memory_id: string
          status: string
          updated_at: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          memory_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          memory_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          briefing_enabled: boolean
          briefing_time: string
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          diary_summary_enabled: boolean
          display_name: string
          gmail_connection_id: string | null
          gmail_email: string | null
          grocery_send_day: number | null
          grocery_send_enabled: boolean
          grocery_send_time: string
          id: string
          last_briefing_sent: string | null
          last_diary_summary: string | null
          last_grocery_sent: string | null
          last_nudge_sent: string | null
          last_weekly_review_sent: string | null
          nudge_enabled: boolean
          nudge_time: string
          phone: string | null
          telegram_chat_id: string | null
          timezone: string | null
          updated_at: string
          weekly_review_day: number
          weekly_review_enabled: boolean
          weekly_review_time: string
        }
        Insert: {
          avatar_url?: string | null
          briefing_enabled?: boolean
          briefing_time?: string
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          diary_summary_enabled?: boolean
          display_name?: string
          gmail_connection_id?: string | null
          gmail_email?: string | null
          grocery_send_day?: number | null
          grocery_send_enabled?: boolean
          grocery_send_time?: string
          id: string
          last_briefing_sent?: string | null
          last_diary_summary?: string | null
          last_grocery_sent?: string | null
          last_nudge_sent?: string | null
          last_weekly_review_sent?: string | null
          nudge_enabled?: boolean
          nudge_time?: string
          phone?: string | null
          telegram_chat_id?: string | null
          timezone?: string | null
          updated_at?: string
          weekly_review_day?: number
          weekly_review_enabled?: boolean
          weekly_review_time?: string
        }
        Update: {
          avatar_url?: string | null
          briefing_enabled?: boolean
          briefing_time?: string
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          diary_summary_enabled?: boolean
          display_name?: string
          gmail_connection_id?: string | null
          gmail_email?: string | null
          grocery_send_day?: number | null
          grocery_send_enabled?: boolean
          grocery_send_time?: string
          id?: string
          last_briefing_sent?: string | null
          last_diary_summary?: string | null
          last_grocery_sent?: string | null
          last_nudge_sent?: string | null
          last_weekly_review_sent?: string | null
          nudge_enabled?: boolean
          nudge_time?: string
          phone?: string | null
          telegram_chat_id?: string | null
          timezone?: string | null
          updated_at?: string
          weekly_review_day?: number
          weekly_review_enabled?: boolean
          weekly_review_time?: string
        }
        Relationships: []
      }
      roster_meta: {
        Row: {
          roster_type: string
          updated_at: string
          week_start_date: string | null
          week_start_day: number | null
        }
        Insert: {
          roster_type: string
          updated_at?: string
          week_start_date?: string | null
          week_start_day?: number | null
        }
        Update: {
          roster_type?: string
          updated_at?: string
          week_start_date?: string | null
          week_start_day?: number | null
        }
        Relationships: []
      }
      roster_snapshots: {
        Row: {
          created_at: string
          data: Json
          id: string
          label: string | null
          roster_type: string
          saved_at: string
          saved_by: string | null
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          label?: string | null
          roster_type?: string
          saved_at?: string
          saved_by?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          label?: string | null
          roster_type?: string
          saved_at?: string
          saved_by?: string | null
        }
        Relationships: []
      }
      roster_staff: {
        Row: {
          created_at: string
          day: string
          end_time: string | null
          id: string
          is_off: boolean
          position: number
          roster_type: string
          staff_name: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          end_time?: string | null
          id?: string
          is_off?: boolean
          position?: number
          roster_type?: string
          staff_name: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          end_time?: string | null
          id?: string
          is_off?: boolean
          position?: number
          roster_type?: string
          staff_name?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roster_training: {
        Row: {
          created_at: string
          day: string
          end_time: string | null
          id: string
          position: number
          staff_name: string
          start_time: string | null
          training_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          end_time?: string | null
          id?: string
          position?: number
          staff_name: string
          start_time?: string | null
          training_text?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          end_time?: string | null
          id?: string
          position?: number
          staff_name?: string
          start_time?: string | null
          training_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      roster_training_meta: {
        Row: {
          id: number
          updated_at: string
          week_start_date: string | null
          week_start_day: number | null
        }
        Insert: {
          id?: number
          updated_at?: string
          week_start_date?: string | null
          week_start_day?: number | null
        }
        Update: {
          id?: number
          updated_at?: string
          week_start_date?: string | null
          week_start_day?: number | null
        }
        Relationships: []
      }
      roster_training_snapshots: {
        Row: {
          data: Json
          id: string
          label: string | null
          saved_at: string
          saved_by: string | null
        }
        Insert: {
          data?: Json
          id?: string
          label?: string | null
          saved_at?: string
          saved_by?: string | null
        }
        Update: {
          data?: Json
          id?: string
          label?: string | null
          saved_at?: string
          saved_by?: string | null
        }
        Relationships: []
      }
      saved_bottle_can_products: {
        Row: {
          breakeven: number | null
          carton_cost: number
          cost_per_unit: number | null
          created_at: string
          id: string
          margin_carton: number | null
          margin_unit: number | null
          markup_carton: number | null
          markup_unit: number | null
          ml: number
          name: string
          package_type: string
          profit_carton: number | null
          profit_per_unit: number | null
          revenue: number | null
          saleable_units: number | null
          sell_price: number
          total_ml: number | null
          units: number
          updated_at: string
          user_id: string
          wastage_pct: number
        }
        Insert: {
          breakeven?: number | null
          carton_cost: number
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          margin_carton?: number | null
          margin_unit?: number | null
          markup_carton?: number | null
          markup_unit?: number | null
          ml: number
          name: string
          package_type: string
          profit_carton?: number | null
          profit_per_unit?: number | null
          revenue?: number | null
          saleable_units?: number | null
          sell_price: number
          total_ml?: number | null
          units: number
          updated_at?: string
          user_id: string
          wastage_pct?: number
        }
        Update: {
          breakeven?: number | null
          carton_cost?: number
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          margin_carton?: number | null
          margin_unit?: number | null
          markup_carton?: number | null
          markup_unit?: number | null
          ml?: number
          name?: string
          package_type?: string
          profit_carton?: number | null
          profit_per_unit?: number | null
          revenue?: number | null
          saleable_units?: number | null
          sell_price?: number
          total_ml?: number | null
          units?: number
          updated_at?: string
          user_id?: string
          wastage_pct?: number
        }
        Relationships: []
      }
      saved_keg_products: {
        Row: {
          breakeven: number | null
          cost_per_glass: number | null
          created_at: string
          full_glasses: number | null
          glass_ml: number
          glass_price: number
          id: string
          keg_l: number
          keg_price: number
          margin: number | null
          name: string
          profit_per_glass: number | null
          revenue: number | null
          total_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          breakeven?: number | null
          cost_per_glass?: number | null
          created_at?: string
          full_glasses?: number | null
          glass_ml: number
          glass_price: number
          id?: string
          keg_l: number
          keg_price: number
          margin?: number | null
          name: string
          profit_per_glass?: number | null
          revenue?: number | null
          total_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          breakeven?: number | null
          cost_per_glass?: number | null
          created_at?: string
          full_glasses?: number | null
          glass_ml?: number
          glass_price?: number
          id?: string
          keg_l?: number
          keg_price?: number
          margin?: number | null
          name?: string
          profit_per_glass?: number | null
          revenue?: number | null
          total_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          day_of_week: number | null
          enabled: boolean
          frequency: string
          id: string
          last_run: string | null
          prompt: string
          time_of_day: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          enabled?: boolean
          frequency: string
          id?: string
          last_run?: string | null
          prompt: string
          time_of_day?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          enabled?: boolean
          frequency?: string
          id?: string
          last_run?: string | null
          prompt?: string
          time_of_day?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      task_notifications: {
        Row: {
          entry_id: string
          last_sent_at: string
        }
        Insert: {
          entry_id: string
          last_sent_at?: string
        }
        Update: {
          entry_id?: string
          last_sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notifications_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      entry_type: "task" | "idea" | "todo" | "diary"
      memory_category:
        | "interest"
        | "project"
        | "preference"
        | "family"
        | "business"
        | "technology"
        | "travel"
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
  public: {
    Enums: {
      entry_type: ["task", "idea", "todo", "diary"],
      memory_category: [
        "interest",
        "project",
        "preference",
        "family",
        "business",
        "technology",
        "travel",
      ],
    },
  },
} as const
