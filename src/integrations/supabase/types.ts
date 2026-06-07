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
          briefing_enabled: boolean
          briefing_time: string
          created_at: string
          display_name: string
          gmail_connection_id: string | null
          gmail_email: string | null
          grocery_send_day: number | null
          grocery_send_enabled: boolean
          grocery_send_time: string
          id: string
          last_briefing_sent: string | null
          last_grocery_sent: string | null
          last_nudge_sent: string | null
          last_weekly_review_sent: string | null
          nudge_enabled: boolean
          nudge_time: string
          telegram_chat_id: string | null
          updated_at: string
          weekly_review_day: number
          weekly_review_enabled: boolean
          weekly_review_time: string
        }
        Insert: {
          briefing_enabled?: boolean
          briefing_time?: string
          created_at?: string
          display_name?: string
          gmail_connection_id?: string | null
          gmail_email?: string | null
          grocery_send_day?: number | null
          grocery_send_enabled?: boolean
          grocery_send_time?: string
          id: string
          last_briefing_sent?: string | null
          last_grocery_sent?: string | null
          last_nudge_sent?: string | null
          last_weekly_review_sent?: string | null
          nudge_enabled?: boolean
          nudge_time?: string
          telegram_chat_id?: string | null
          updated_at?: string
          weekly_review_day?: number
          weekly_review_enabled?: boolean
          weekly_review_time?: string
        }
        Update: {
          briefing_enabled?: boolean
          briefing_time?: string
          created_at?: string
          display_name?: string
          gmail_connection_id?: string | null
          gmail_email?: string | null
          grocery_send_day?: number | null
          grocery_send_enabled?: boolean
          grocery_send_time?: string
          id?: string
          last_briefing_sent?: string | null
          last_grocery_sent?: string | null
          last_nudge_sent?: string | null
          last_weekly_review_sent?: string | null
          nudge_enabled?: boolean
          nudge_time?: string
          telegram_chat_id?: string | null
          updated_at?: string
          weekly_review_day?: number
          weekly_review_enabled?: boolean
          weekly_review_time?: string
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
