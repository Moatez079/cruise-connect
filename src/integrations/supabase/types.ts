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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      boats: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_rooms: number
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_rooms?: number
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_rooms?: number
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_sessions: {
        Row: {
          boat_id: string
          created_at: string
          expires_at: string
          guest_language: string
          id: string
          room_number: number
        }
        Insert: {
          boat_id: string
          created_at?: string
          expires_at?: string
          guest_language?: string
          id?: string
          room_number: number
        }
        Update: {
          boat_id?: string
          created_at?: string
          expires_at?: string
          guest_language?: string
          id?: string
          room_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "guest_sessions_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          category: Database["public"]["Enums"]["invoice_category"]
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["invoice_category"]
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["invoice_category"]
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          boat_id: string
          created_at: string
          created_by: string | null
          currency: string
          farewell_message: string | null
          guest_language: string
          id: string
          notes: string | null
          room_number: number
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          boat_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          farewell_message?: string | null
          guest_language?: string
          id?: string
          notes?: string | null
          room_number: number
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          boat_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          farewell_message?: string | null
          guest_language?: string
          id?: string
          notes?: string | null
          room_number?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          language_preference: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          language_preference?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          language_preference?: string
          updated_at?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          boat_id: string
          category: Database["public"]["Enums"]["request_category"]
          created_at: string
          guest_language: string
          guest_session_id: string | null
          id: string
          original_message: string | null
          room_number: number
          status: Database["public"]["Enums"]["request_status"]
          translated_message: string | null
          updated_at: string
        }
        Insert: {
          boat_id: string
          category: Database["public"]["Enums"]["request_category"]
          created_at?: string
          guest_language?: string
          guest_session_id?: string | null
          id?: string
          original_message?: string | null
          room_number: number
          status?: Database["public"]["Enums"]["request_status"]
          translated_message?: string | null
          updated_at?: string
        }
        Update: {
          boat_id?: string
          category?: Database["public"]["Enums"]["request_category"]
          created_at?: string
          guest_language?: string
          guest_session_id?: string | null
          id?: string
          original_message?: string | null
          room_number?: number
          status?: Database["public"]["Enums"]["request_status"]
          translated_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_guest_session_id_fkey"
            columns: ["guest_session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          boat_id: string
          created_at: string
          id: string
          qr_code_data: string | null
          room_number: number
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          boat_id: string
          created_at?: string
          id?: string
          qr_code_data?: string | null
          room_number: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          boat_id?: string
          created_at?: string
          id?: string
          qr_code_data?: string | null
          room_number?: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_logs: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          original_text: string
          provider: string
          request_id: string | null
          source_language: string
          target_language: string
          translated_text: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          original_text: string
          provider?: string
          request_id?: string | null
          source_language: string
          target_language?: string
          translated_text: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          original_text?: string
          provider?: string
          request_id?: string | null
          source_language?: string
          target_language?: string
          translated_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_boat_assignments: {
        Row: {
          boat_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          boat_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          boat_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_boat_assignments_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_to_boat: {
        Args: { _boat_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "boat_admin" | "receptionist"
      invoice_category:
        | "restaurant"
        | "bar"
        | "massage"
        | "internet"
        | "room_service"
        | "custom"
      invoice_status: "draft" | "visible" | "paid" | "closed"
      request_category:
        | "towels"
        | "help_opening_room"
        | "cleaning"
        | "bathroom_service"
        | "do_not_disturb"
        | "drinks"
        | "custom"
      request_status: "pending" | "in_progress" | "done"
      room_status: "available" | "occupied" | "maintenance" | "do_not_disturb"
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
      app_role: ["owner", "boat_admin", "receptionist"],
      invoice_category: [
        "restaurant",
        "bar",
        "massage",
        "internet",
        "room_service",
        "custom",
      ],
      invoice_status: ["draft", "visible", "paid", "closed"],
      request_category: [
        "towels",
        "help_opening_room",
        "cleaning",
        "bathroom_service",
        "do_not_disturb",
        "drinks",
        "custom",
      ],
      request_status: ["pending", "in_progress", "done"],
      room_status: ["available", "occupied", "maintenance", "do_not_disturb"],
    },
  },
} as const
