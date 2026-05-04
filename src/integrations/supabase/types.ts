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
          deleted_at: string | null
          ghl_api_key: string | null
          ghl_location_id: string | null
          ghl_stage_mapping: Json | null
          google_sheet_id: string | null
          id: string
          meta_access_token: string | null
          meta_account_id: string | null
          meta_token_id: string | null
          name: string
          phone: string | null
          share_token: string | null
          ticket_medio: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          ghl_api_key?: string | null
          ghl_location_id?: string | null
          ghl_stage_mapping?: Json | null
          google_sheet_id?: string | null
          id?: string
          meta_access_token?: string | null
          meta_account_id?: string | null
          meta_token_id?: string | null
          name: string
          phone?: string | null
          share_token?: string | null
          ticket_medio?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          ghl_api_key?: string | null
          ghl_location_id?: string | null
          ghl_stage_mapping?: Json | null
          google_sheet_id?: string | null
          id?: string
          meta_access_token?: string | null
          meta_account_id?: string | null
          meta_token_id?: string | null
          name?: string
          phone?: string | null
          share_token?: string | null
          ticket_medio?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_meta_token_id_fkey"
            columns: ["meta_token_id"]
            isOneToOne: false
            referencedRelation: "meta_tokens"
            referencedColumns: ["id"]
          },
        ]
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
      meta_tokens: {
        Row: {
          created_at: string
          id: string
          name: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
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
      squad_agenda: {
        Row: {
          category: string | null
          client_name: string
          created_at: string
          done: boolean
          id: string
          meeting_date: string | null
          meeting_time: string | null
          not_done_reason: string | null
          observations: string | null
          reference_month: string
          responsible: string | null
          squad_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          client_name: string
          created_at?: string
          done?: boolean
          id?: string
          meeting_date?: string | null
          meeting_time?: string | null
          not_done_reason?: string | null
          observations?: string | null
          reference_month: string
          responsible?: string | null
          squad_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          client_name?: string
          created_at?: string
          done?: boolean
          id?: string
          meeting_date?: string | null
          meeting_time?: string | null
          not_done_reason?: string | null
          observations?: string | null
          reference_month?: string
          responsible?: string | null
          squad_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      squad_churn: {
        Row: {
          churn_month: string | null
          client_name: string
          created_at: string
          entry_month: string | null
          id: string
          months_active: string | null
          observations: string | null
          reason: string | null
          squad_id: string
          updated_at: string
        }
        Insert: {
          churn_month?: string | null
          client_name: string
          created_at?: string
          entry_month?: string | null
          id?: string
          months_active?: string | null
          observations?: string | null
          reason?: string | null
          squad_id: string
          updated_at?: string
        }
        Update: {
          churn_month?: string | null
          client_name?: string
          created_at?: string
          entry_month?: string | null
          id?: string
          months_active?: string | null
          observations?: string | null
          reason?: string | null
          squad_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      squad_clients: {
        Row: {
          bm_verified: boolean | null
          created_at: string
          curve_abc: string | null
          due_date: string | null
          entry_date: string | null
          id: string
          invested_tp: string | null
          name: string
          niche: string | null
          observations: string | null
          prioritization: string | null
          priority_score: number
          renewal_60d: boolean | null
          services: string | null
          sprint: string | null
          squad_id: string
          updated_at: string
        }
        Insert: {
          bm_verified?: boolean | null
          created_at?: string
          curve_abc?: string | null
          due_date?: string | null
          entry_date?: string | null
          id?: string
          invested_tp?: string | null
          name: string
          niche?: string | null
          observations?: string | null
          prioritization?: string | null
          priority_score?: number
          renewal_60d?: boolean | null
          services?: string | null
          sprint?: string | null
          squad_id: string
          updated_at?: string
        }
        Update: {
          bm_verified?: boolean | null
          created_at?: string
          curve_abc?: string | null
          due_date?: string | null
          entry_date?: string | null
          id?: string
          invested_tp?: string | null
          name?: string
          niche?: string | null
          observations?: string | null
          prioritization?: string | null
          priority_score?: number
          renewal_60d?: boolean | null
          services?: string | null
          sprint?: string | null
          squad_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_clients_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_daily_notes: {
        Row: {
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          note_date: string
          squad_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_date?: string
          squad_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_date?: string
          squad_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      squad_daily_session_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          position: number | null
          prioritization: string | null
          seconds_spent: number
          session_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          position?: number | null
          prioritization?: string | null
          seconds_spent?: number
          session_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          position?: number | null
          prioritization?: string | null
          seconds_spent?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_daily_session_clients_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "squad_daily_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_daily_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          delay_seconds: number
          deleted_at: string | null
          ended_at: string | null
          id: string
          on_time: boolean
          session_date: string
          squad_id: string
          started_at: string
          total_seconds: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          on_time?: boolean
          session_date?: string
          squad_id: string
          started_at?: string
          total_seconds?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          on_time?: boolean
          session_date?: string
          squad_id?: string
          started_at?: string
          total_seconds?: number | null
        }
        Relationships: []
      }
      squad_daily_skips: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          reason: string
          skip_date: string
          squad_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          skip_date: string
          squad_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          skip_date?: string
          squad_id?: string
        }
        Relationships: []
      }
      squad_engagement: {
        Row: {
          client_name: string
          contact: string | null
          created_at: string
          curve_abc: string | null
          deleted_at: string | null
          engagement_score: number | null
          id: string
          nps_individual: number | null
          observation: string | null
          reference_month: string
          sprint: string | null
          squad_id: string
          updated_at: string
        }
        Insert: {
          client_name: string
          contact?: string | null
          created_at?: string
          curve_abc?: string | null
          deleted_at?: string | null
          engagement_score?: number | null
          id?: string
          nps_individual?: number | null
          observation?: string | null
          reference_month: string
          sprint?: string | null
          squad_id: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          contact?: string | null
          created_at?: string
          curve_abc?: string | null
          deleted_at?: string | null
          engagement_score?: number | null
          id?: string
          nps_individual?: number | null
          observation?: string | null
          reference_month?: string
          sprint?: string | null
          squad_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      squad_members: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          squad_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          squad_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_monthly_metrics: {
        Row: {
          active_clients: number | null
          calls_delivered_pct: number | null
          churn_count: number | null
          churn_reason: string | null
          created_at: string
          id: string
          lifetime: string | null
          monthly_clients: number | null
          new_clients: number | null
          observations: string | null
          out_of_target: number | null
          reference_month: string
          renewals: number | null
          squad_id: string
          updated_at: string
          upsell_amount: string | null
        }
        Insert: {
          active_clients?: number | null
          calls_delivered_pct?: number | null
          churn_count?: number | null
          churn_reason?: string | null
          created_at?: string
          id?: string
          lifetime?: string | null
          monthly_clients?: number | null
          new_clients?: number | null
          observations?: string | null
          out_of_target?: number | null
          reference_month: string
          renewals?: number | null
          squad_id: string
          updated_at?: string
          upsell_amount?: string | null
        }
        Update: {
          active_clients?: number | null
          calls_delivered_pct?: number | null
          churn_count?: number | null
          churn_reason?: string | null
          created_at?: string
          id?: string
          lifetime?: string | null
          monthly_clients?: number | null
          new_clients?: number | null
          observations?: string | null
          out_of_target?: number | null
          reference_month?: string
          renewals?: number | null
          squad_id?: string
          updated_at?: string
          upsell_amount?: string | null
        }
        Relationships: []
      }
      squad_nps: {
        Row: {
          avg_engagement: number | null
          created_at: string
          detractors: number | null
          id: string
          neutrals: number | null
          nps_score: number | null
          observations: string | null
          period: string
          promoters: number | null
          responses: number | null
          squad_id: string
          total_clients: number | null
          updated_at: string
        }
        Insert: {
          avg_engagement?: number | null
          created_at?: string
          detractors?: number | null
          id?: string
          neutrals?: number | null
          nps_score?: number | null
          observations?: string | null
          period: string
          promoters?: number | null
          responses?: number | null
          squad_id: string
          total_clients?: number | null
          updated_at?: string
        }
        Update: {
          avg_engagement?: number | null
          created_at?: string
          detractors?: number | null
          id?: string
          neutrals?: number | null
          nps_score?: number | null
          observations?: string | null
          period?: string
          promoters?: number | null
          responses?: number | null
          squad_id?: string
          total_clients?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      squads: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
      user_creation_verifications: {
        Row: {
          action: string
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          payload: Json
          phone: string
          requested_by: string
        }
        Insert: {
          action: string
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          payload: Json
          phone: string
          requested_by: string
        }
        Update: {
          action?: string
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          phone?: string
          requested_by?: string
        }
        Relationships: []
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
      get_accessible_clients: {
        Args: never
        Returns: {
          created_at: string
          google_sheet_id: string
          has_ghl_credentials: boolean
          has_google_sheet: boolean
          has_meta_credentials: boolean
          has_ticket_medio: boolean
          id: string
          meta_account_id: string
          name: string
          phone: string
          ticket_medio: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purge_old_squad_daily_sessions: { Args: never; Returns: undefined }
      purge_old_squad_engagement: { Args: never; Returns: undefined }
      user_can_access_client: { Args: { _client_id: string }; Returns: boolean }
      user_in_squad: { Args: { _squad_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "client" | "collaborator"
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
      app_role: ["admin", "manager", "client", "collaborator"],
      lead_status: [
        "cpf_approved",
        "sale",
        "sale_consortium",
        "sale_financing",
      ],
    },
  },
} as const
