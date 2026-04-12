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
      clients: {
        Row: {
          created_at: string
          google_sheet_id: string | null
          id: string
          meta_access_token: string | null
          meta_account_id: string | null
          name: string
          share_token: string | null
          ticket_medio: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          google_sheet_id?: string | null
          id?: string
          meta_access_token?: string | null
          meta_account_id?: string | null
          name: string
          share_token?: string | null
          ticket_medio?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          google_sheet_id?: string | null
          id?: string
          meta_access_token?: string | null
          meta_account_id?: string | null
          name?: string
          share_token?: string | null
          ticket_medio?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      comparison_notes: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          notes: string
          reference_month: number
          reference_year: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          notes?: string
          reference_month: number
          reference_year: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          notes?: string
          reference_month?: number
          reference_year?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparison_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          client_id: string
          cpl: number
          created_at: string | null
          id: string
          investimento: number
          leads: number
          pre_atendimento: number
          qualificados: number
          reference_month: number
          reference_year: number
          ticket_medio: number
          tipo: string
          user_id: string
          vendas: number
        }
        Insert: {
          client_id: string
          cpl?: number
          created_at?: string | null
          id?: string
          investimento?: number
          leads?: number
          pre_atendimento?: number
          qualificados?: number
          reference_month: number
          reference_year: number
          ticket_medio?: number
          tipo: string
          user_id: string
          vendas?: number
        }
        Update: {
          client_id?: string
          cpl?: number
          created_at?: string | null
          id?: string
          investimento?: number
          leads?: number
          pre_atendimento?: number
          qualificados?: number
          reference_month?: number
          reference_year?: number
          ticket_medio?: number
          tipo?: string
          user_id?: string
          vendas?: number
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          ad_name: string
          amount_spent: number
          campaign_name: string | null
          client_id: string
          date: string
          id: string
          leads_total: number
          synced_at: string
        }
        Insert: {
          ad_name: string
          amount_spent?: number
          campaign_name?: string | null
          client_id: string
          date: string
          id?: string
          leads_total?: number
          synced_at?: string
        }
        Update: {
          ad_name?: string
          amount_spent?: number
          campaign_name?: string | null
          client_id?: string
          date?: string
          id?: string
          leads_total?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qualified_leads: {
        Row: {
          client_id: string
          creative_name: string
          id: string
          lead_date: string
          received_at: string
          seller_name: string | null
          status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          client_id: string
          creative_name: string
          id?: string
          lead_date?: string
          received_at?: string
          seller_name?: string | null
          status: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          client_id?: string
          creative_name?: string
          id?: string
          lead_date?: string
          received_at?: string
          seller_name?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "qualified_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          client_id: string | null
          client_name: string
          cpl: number
          created_at: string | null
          id: string
          investimento: number
          leads: number
          qualificados: number
          reference_month: number | null
          reference_week: number | null
          reference_year: number | null
          simulacoes: number
          taxa_qualificados: number | null
          taxa_simulacoes: number | null
          taxa_vendas: number | null
          user_id: string
          vendas: number
        }
        Insert: {
          client_id?: string | null
          client_name: string
          cpl: number
          created_at?: string | null
          id?: string
          investimento: number
          leads: number
          qualificados: number
          reference_month?: number | null
          reference_week?: number | null
          reference_year?: number | null
          simulacoes: number
          taxa_qualificados?: number | null
          taxa_simulacoes?: number | null
          taxa_vendas?: number | null
          user_id: string
          vendas: number
        }
        Update: {
          client_id?: string | null
          client_name?: string
          cpl?: number
          created_at?: string | null
          id?: string
          investimento?: number
          leads?: number
          qualificados?: number
          reference_month?: number | null
          reference_week?: number | null
          reference_year?: number | null
          simulacoes?: number
          taxa_qualificados?: number | null
          taxa_simulacoes?: number | null
          taxa_vendas?: number | null
          user_id?: string
          vendas?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_client_access: {
        Row: {
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_client_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_access: {
        Row: {
          created_at: string
          dashboard_key: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_key: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard_key?: string
          id?: string
          user_id?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "client"
      lead_status:
        | "cpf_approved"
        | "sale"
        | "sale_consortium"
        | "sale_financing"
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
      app_role: ["admin", "manager", "client"],
      lead_status: [
        "cpf_approved",
        "sale",
        "sale_consortium",
        "sale_financing",
      ],
    },
  },
} as const
