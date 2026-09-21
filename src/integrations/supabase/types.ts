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
      digest_subscribers: {
        Row: {
          consented_at: string
          email: string
          filter_preferences: Json
          id: string
          unsubscribed: boolean
        }
        Insert: {
          consented_at?: string
          email: string
          filter_preferences?: Json
          id?: string
          unsubscribed?: boolean
        }
        Update: {
          consented_at?: string
          email?: string
          filter_preferences?: Json
          id?: string
          unsubscribed?: boolean
        }
        Relationships: []
      }
      ingestion_urls: {
        Row: {
          category: string | null
          error_type: string | null
          headline: string | null
          published_at: string | null
          source_name: string | null
          status: string
          story_id: string | null
          updated_at: string
          url: string
        }
        Insert: {
          category?: string | null
          error_type?: string | null
          headline?: string | null
          published_at?: string | null
          source_name?: string | null
          status: string
          story_id?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          category?: string | null
          error_type?: string | null
          headline?: string | null
          published_at?: string | null
          source_name?: string | null
          status?: string
          story_id?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_urls_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_checkouts: {
        Row: {
          cadence: string
          completed: boolean
          consented_at: string
          created_at: string
          email: string
          id: string
          plan: string
          stripe_session_id: string | null
          topics: string[]
        }
        Insert: {
          cadence: string
          completed?: boolean
          consented_at?: string
          created_at?: string
          email: string
          id?: string
          plan: string
          stripe_session_id?: string | null
          topics?: string[]
        }
        Update: {
          cadence?: string
          completed?: boolean
          consented_at?: string
          created_at?: string
          email?: string
          id?: string
          plan?: string
          stripe_session_id?: string | null
          topics?: string[]
        }
        Relationships: []
      }
      newsletter_deliveries: {
        Row: {
          accepted_at: string | null
          attempted_at: string | null
          created_at: string
          delivery_status: string
          due_at: string
          id: string
          member_id: string
          payload: Json
          provider_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          attempted_at?: string | null
          created_at?: string
          delivery_status?: string
          due_at: string
          id?: string
          member_id: string
          payload: Json
          provider_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          attempted_at?: string | null
          created_at?: string
          delivery_status?: string
          due_at?: string
          id?: string
          member_id?: string
          payload?: Json
          provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_deliveries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "newsletter_members"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_events: {
        Row: {
          event_id: string
          received_at: string
        }
        Insert: {
          event_id: string
          received_at?: string
        }
        Update: {
          event_id?: string
          received_at?: string
        }
        Relationships: []
      }
      newsletter_members: {
        Row: {
          access_kind: string
          cadence: string
          comp_reason: string | null
          created_at: string
          email: string
          first_due_at: string
          first_sent_at: string | null
          id: string
          next_send_at: string
          paid_until: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          topics: string[]
          unsubscribed: boolean
          verified_at: string | null
        }
        Insert: {
          access_kind: string
          cadence: string
          comp_reason?: string | null
          created_at?: string
          email: string
          first_due_at?: string
          first_sent_at?: string | null
          id?: string
          next_send_at?: string
          paid_until?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          topics?: string[]
          unsubscribed?: boolean
          verified_at?: string | null
        }
        Update: {
          access_kind?: string
          cadence?: string
          comp_reason?: string | null
          created_at?: string
          email?: string
          first_due_at?: string
          first_sent_at?: string | null
          id?: string
          next_send_at?: string
          paid_until?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          topics?: string[]
          unsubscribed?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_filters: Json | null
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          default_filters?: Json | null
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          default_filters?: Json | null
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      spot_check_queue: {
        Row: {
          created_at: string
          id: string
          reason: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["spot_check_status"]
          story_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["spot_check_status"]
          story_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["spot_check_status"]
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_check_queue_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          ai_generated_summary: string
          canonical_url: string | null
          content_type: string
          headline: string
          id: string
          is_correction_of: string | null
          media_url: string | null
          processing_metadata: Json
          publication_status: string
          published_at: string | null
          related_to_url: string | null
          updated_at: string
        }
        Insert: {
          ai_generated_summary: string
          canonical_url?: string | null
          content_type?: string
          headline: string
          id?: string
          is_correction_of?: string | null
          media_url?: string | null
          processing_metadata?: Json
          publication_status?: string
          published_at?: string | null
          related_to_url?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated_summary?: string
          canonical_url?: string | null
          content_type?: string
          headline?: string
          id?: string
          is_correction_of?: string | null
          media_url?: string | null
          processing_metadata?: Json
          publication_status?: string
          published_at?: string | null
          related_to_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_is_correction_of_fkey"
            columns: ["is_correction_of"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_sources: {
        Row: {
          id: string
          is_paywalled: boolean | null
          source_name: string
          source_url: string
          story_id: string
        }
        Insert: {
          id?: string
          is_paywalled?: boolean | null
          source_name: string
          source_url: string
          story_id: string
        }
        Update: {
          id?: string
          is_paywalled?: boolean | null
          source_name?: string
          source_url?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_sources_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_tags: {
        Row: {
          access: Database["public"]["Enums"]["story_access"] | null
          geography: Database["public"]["Enums"]["story_geography"] | null
          id: string
          story_id: string
          tone: Database["public"]["Enums"]["story_tone"] | null
        }
        Insert: {
          access?: Database["public"]["Enums"]["story_access"] | null
          geography?: Database["public"]["Enums"]["story_geography"] | null
          id?: string
          story_id: string
          tone?: Database["public"]["Enums"]["story_tone"] | null
        }
        Update: {
          access?: Database["public"]["Enums"]["story_access"] | null
          geography?: Database["public"]["Enums"]["story_geography"] | null
          id?: string
          story_id?: string
          tone?: Database["public"]["Enums"]["story_tone"] | null
        }
        Relationships: [
          {
            foreignKeyName: "story_tags_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: true
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_topics: {
        Row: {
          id: string
          story_id: string
          topic: Database["public"]["Enums"]["story_topic"]
        }
        Insert: {
          id?: string
          story_id: string
          topic: Database["public"]["Enums"]["story_topic"]
        }
        Update: {
          id?: string
          story_id?: string
          topic?: Database["public"]["Enums"]["story_topic"]
        }
        Relationships: [
          {
            foreignKeyName: "story_topics_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
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
      review_story: {
        Args: { p_action: string; p_correction?: Json; p_queue_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      spot_check_status: "pending" | "approved" | "corrected" | "rejected"
      story_access: "Free" | "Paid"
      story_geography:
        | "Worldwide"
        | "US"
        | "China"
        | "Europe"
        | "Africa"
        | "Latin America"
        | "South & Southeast Asia"
        | "Middle East"
      story_tone: "Good" | "Useful" | "Bad" | "Ugly" | "Cool" | "Neutral"
      story_topic:
        | "Models & Research"
        | "Business & Funding"
        | "Policy & Regulation"
        | "National Initiatives"
        | "Ethics"
        | "Leadership"
        | "Organisations"
        | "People & Jobs"
        | "Future of Daily Life"
        | "AI Equity & Representation"
        | "Tools & Products"
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
      app_role: ["admin", "user"],
      spot_check_status: ["pending", "approved", "corrected", "rejected"],
      story_access: ["Free", "Paid"],
      story_geography: [
        "Worldwide",
        "US",
        "China",
        "Europe",
        "Africa",
        "Latin America",
        "South & Southeast Asia",
        "Middle East",
      ],
      story_tone: ["Good", "Useful", "Bad", "Ugly", "Cool", "Neutral"],
      story_topic: [
        "Models & Research",
        "Business & Funding",
        "Policy & Regulation",
        "National Initiatives",
        "Ethics",
        "Leadership",
        "Organisations",
        "People & Jobs",
        "Future of Daily Life",
        "AI Equity & Representation",
        "Tools & Products",
      ],
    },
  },
} as const
