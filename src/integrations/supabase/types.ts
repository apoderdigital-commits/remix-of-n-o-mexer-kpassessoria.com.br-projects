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
      client_campaign_filters: {
        Row: {
          client_id: string
          created_at: string
          excluded_campaigns: string[]
          id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          excluded_campaigns?: string[]
          id?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          excluded_campaigns?: string[]
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_campaign_filters_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_report_configs: {
        Row: {
          client_id: string
          created_at: string | null
          daily_days: number[]
          daily_enabled: boolean
          daily_time: string
          enabled: boolean
          id: string
          metric_source: string
          monthly_day: number
          monthly_enabled: boolean
          monthly_time: string
          updated_at: string | null
          weekly_day: number
          weekly_enabled: boolean
          weekly_time: string
          whatsapp_jid: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          daily_days?: number[]
          daily_enabled?: boolean
          daily_time?: string
          enabled?: boolean
          id?: string
          metric_source?: string
          monthly_day?: number
          monthly_enabled?: boolean
          monthly_time?: string
          updated_at?: string | null
          weekly_day?: number
          weekly_enabled?: boolean
          weekly_time?: string
          whatsapp_jid?: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          daily_days?: number[]
          daily_enabled?: boolean
          daily_time?: string
          enabled?: boolean
          id?: string
          metric_source?: string
          monthly_day?: number
          monthly_enabled?: boolean
          monthly_time?: string
          updated_at?: string | null
          weekly_day?: number
          weekly_enabled?: boolean
          weekly_time?: string
          whatsapp_jid?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_report_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
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
          sheet_cpf_keywords: string | null
          sheet_sale_keywords: string | null
          squad_id: string | null
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
          sheet_cpf_keywords?: string | null
          sheet_sale_keywords?: string | null
          squad_id?: string | null
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
          sheet_cpf_keywords?: string | null
          sheet_sale_keywords?: string | null
          squad_id?: string | null
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
          {
            foreignKeyName: "clients_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
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
          vendas_loja: number | null
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
          vendas_loja?: number | null
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
          vendas_loja?: number | null
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
      crm_clients: {
        Row: {
          cidade: string | null
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          cidade?: string | null
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          cidade?: string | null
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      crm_connections: {
        Row: {
          ativo: boolean
          cliente_id: string
          criado_em: string
          id: string
          instance_id: string
          n8n_send_url: string | null
          numero: string | null
          provedor: string
          webhook_secret: string | null
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          criado_em?: string
          id?: string
          instance_id: string
          n8n_send_url?: string | null
          numero?: string | null
          provedor?: string
          webhook_secret?: string | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          criado_em?: string
          id?: string
          instance_id?: string
          n8n_send_url?: string | null
          numero?: string | null
          provedor?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_connections_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          chat_id: string | null
          cliente_id: string
          criado_em: string
          email: string | null
          foto_url: string | null
          id: string
          is_group: boolean
          nome: string | null
          telefone: string | null
        }
        Insert: {
          chat_id?: string | null
          cliente_id: string
          criado_em?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          is_group?: boolean
          nome?: string | null
          telefone?: string | null
        }
        Update: {
          chat_id?: string | null
          cliente_id?: string
          criado_em?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          is_group?: boolean
          nome?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_conversations: {
        Row: {
          atualizado_em: string
          cliente_id: string
          contact_id: string
          criado_em: string
          id: string
          status: string
          ultima_em: string | null
          ultima_mensagem: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          contact_id: string
          criado_em?: string
          id?: string
          status?: string
          ultima_em?: string | null
          ultima_mensagem?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          contact_id?: string
          criado_em?: string
          id?: string
          status?: string
          ultima_em?: string | null
          ultima_mensagem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_conversations_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_messages: {
        Row: {
          cliente_id: string
          conteudo: string | null
          conversation_id: string
          criado_em: string
          direcao: string
          id: string
          lida: boolean
          remetente_foto: string | null
          remetente_nome: string | null
          remetente_telefone: string | null
          tipo: string
          url_midia: string | null
        }
        Insert: {
          cliente_id: string
          conteudo?: string | null
          conversation_id: string
          criado_em?: string
          direcao: string
          id?: string
          lida?: boolean
          remetente_foto?: string | null
          remetente_nome?: string | null
          remetente_telefone?: string | null
          tipo?: string
          url_midia?: string | null
        }
        Update: {
          cliente_id?: string
          conteudo?: string | null
          conversation_id?: string
          criado_em?: string
          direcao?: string
          id?: string
          lida?: boolean
          remetente_foto?: string | null
          remetente_nome?: string | null
          remetente_telefone?: string | null
          tipo?: string
          url_midia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_messages_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          atualizado_em: string
          cliente_id: string
          contact_id: string
          criado_em: string
          id: string
          pipeline_stage_id: string | null
          status: string
          valor: number | null
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          contact_id: string
          criado_em?: string
          id?: string
          pipeline_stage_id?: string | null
          status?: string
          valor?: number | null
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          contact_id?: string
          criado_em?: string
          id?: string
          pipeline_stage_id?: string | null
          status?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          cliente_id: string
          id: string
          nome: string
          ordem: number
          pipeline_id: string
        }
        Insert: {
          cliente_id: string
          id?: string
          nome: string
          ordem?: number
          pipeline_id: string
        }
        Update: {
          cliente_id?: string
          id?: string
          nome?: string
          ordem?: number
          pipeline_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          cliente_id: string
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          cliente_id: string
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          cliente_id?: string
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_users: {
        Row: {
          auth_user_id: string | null
          cliente_id: string
          criado_em: string
          email: string | null
          id: string
          nome: string
          papel: string
        }
        Insert: {
          auth_user_id?: string | null
          cliente_id: string
          criado_em?: string
          email?: string | null
          id?: string
          nome: string
          papel?: string
        }
        Update: {
          auth_user_id?: string | null
          cliente_id?: string
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string
          papel?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_users_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      kp_comercial_calendars: {
        Row: {
          enabled: boolean
          ghl_calendar_id: string
          name: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          ghl_calendar_id: string
          name?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          ghl_calendar_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      kp_comercial_data_sources: {
        Row: {
          comparecidas_source: string
          id: boolean
          leads_source: string
          meetings_source: string
          mqls_source: string
          opportunity_source_enabled: boolean
          opportunity_source_filter: string
          sheet_id: string
          sheet_mql_column: string
          sheet_mql_value: string
          sheet_tab: string
          updated_at: string
          vendas_source: string
        }
        Insert: {
          comparecidas_source?: string
          id?: boolean
          leads_source?: string
          meetings_source?: string
          mqls_source?: string
          opportunity_source_enabled?: boolean
          opportunity_source_filter?: string
          sheet_id?: string
          sheet_mql_column?: string
          sheet_mql_value?: string
          sheet_tab?: string
          updated_at?: string
          vendas_source?: string
        }
        Update: {
          comparecidas_source?: string
          id?: boolean
          leads_source?: string
          meetings_source?: string
          mqls_source?: string
          opportunity_source_enabled?: boolean
          opportunity_source_filter?: string
          sheet_id?: string
          sheet_mql_column?: string
          sheet_mql_value?: string
          sheet_tab?: string
          updated_at?: string
          vendas_source?: string
        }
        Relationships: []
      }
      kp_comercial_pipeline_config: {
        Row: {
          classe: string | null
          kind: string | null
          pipeline_id: string
          pipeline_name: string | null
          stages_comparecida: string[]
          stages_noshow: string[]
          stages_proposta_enviada: string[]
          stages_proposta_perdida: string[]
          stages_reuniao_marcada: string[]
          stages_vendida: string[]
          updated_at: string
        }
        Insert: {
          classe?: string | null
          kind?: string | null
          pipeline_id: string
          pipeline_name?: string | null
          stages_comparecida?: string[]
          stages_noshow?: string[]
          stages_proposta_enviada?: string[]
          stages_proposta_perdida?: string[]
          stages_reuniao_marcada?: string[]
          stages_vendida?: string[]
          updated_at?: string
        }
        Update: {
          classe?: string | null
          kind?: string | null
          pipeline_id?: string
          pipeline_name?: string | null
          stages_comparecida?: string[]
          stages_noshow?: string[]
          stages_proposta_enviada?: string[]
          stages_proposta_perdida?: string[]
          stages_reuniao_marcada?: string[]
          stages_vendida?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      kp_comercial_prospeccao: {
        Row: {
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          event_at: string
          event_type: string
          id: string
          lead_category: string
          message: string | null
          raw: Json
          sdr_ghl_id: string | null
          sdr_name: string | null
        }
        Insert: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          event_at?: string
          event_type?: string
          id?: string
          lead_category?: string
          message?: string | null
          raw?: Json
          sdr_ghl_id?: string | null
          sdr_name?: string | null
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          event_at?: string
          event_type?: string
          id?: string
          lead_category?: string
          message?: string | null
          raw?: Json
          sdr_ghl_id?: string | null
          sdr_name?: string | null
        }
        Relationships: []
      }
      kp_comercial_sdr_goals: {
        Row: {
          agendados: number
          ghl_user_id: string
          realizados: number
          updated_at: string
          updated_by: string | null
          vendas: number
        }
        Insert: {
          agendados?: number
          ghl_user_id: string
          realizados?: number
          updated_at?: string
          updated_by?: string | null
          vendas?: number
        }
        Update: {
          agendados?: number
          ghl_user_id?: string
          realizados?: number
          updated_at?: string
          updated_by?: string | null
          vendas?: number
        }
        Relationships: []
      }
      kp_comercial_snapshots: {
        Row: {
          block: string
          duration_ms: number | null
          error: string | null
          fetched_at: string
          id: string
          payload: Json
          period_end: string
          period_start: string
        }
        Insert: {
          block?: string
          duration_ms?: number | null
          error?: string | null
          fetched_at?: string
          id?: string
          payload: Json
          period_end: string
          period_start: string
        }
        Update: {
          block?: string
          duration_ms?: number | null
          error?: string | null
          fetched_at?: string
          id?: string
          payload?: Json
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      kp_comercial_user_roles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          ghl_user_id: string
          id: string
          name: string | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          ghl_user_id: string
          id?: string
          name?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          ghl_user_id?: string
          id?: string
          name?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
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
      passkey_challenges: {
        Row: {
          challenge: string
          created_at: string
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      password_reset_verifications: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          squad_function: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          squad_function?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          squad_function?: string | null
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
          contract_value: number | null
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
          contract_value?: number | null
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
          contract_value?: number | null
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
      squad_client_assignments: {
        Row: {
          created_at: string
          function: string
          id: string
          squad_client_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function: string
          id?: string
          squad_client_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function?: string
          id?: string
          squad_client_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_client_assignments_squad_client_id_fkey"
            columns: ["squad_client_id"]
            isOneToOne: false
            referencedRelation: "squad_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_clients: {
        Row: {
          bm_verified: boolean | null
          contract_file_name: string | null
          contract_file_url: string | null
          contract_value: number | null
          created_at: string
          curve_abc: string | null
          due_date: string | null
          entry_date: string | null
          id: string
          invested_tp: string | null
          meta_vendas_loja: number | null
          meta_vendas_trafego: number | null
          name: string
          niche: string | null
          observations: string | null
          prioritization: string | null
          priority_score: number
          renewal_60d: boolean | null
          sales_goal: number | null
          services: string | null
          sprint: string | null
          squad_id: string
          strategy_file_name: string | null
          strategy_file_url: string | null
          ticket_medio: number | null
          updated_at: string
        }
        Insert: {
          bm_verified?: boolean | null
          contract_file_name?: string | null
          contract_file_url?: string | null
          contract_value?: number | null
          created_at?: string
          curve_abc?: string | null
          due_date?: string | null
          entry_date?: string | null
          id?: string
          invested_tp?: string | null
          meta_vendas_loja?: number | null
          meta_vendas_trafego?: number | null
          name: string
          niche?: string | null
          observations?: string | null
          prioritization?: string | null
          priority_score?: number
          renewal_60d?: boolean | null
          sales_goal?: number | null
          services?: string | null
          sprint?: string | null
          squad_id: string
          strategy_file_name?: string | null
          strategy_file_url?: string | null
          ticket_medio?: number | null
          updated_at?: string
        }
        Update: {
          bm_verified?: boolean | null
          contract_file_name?: string | null
          contract_file_url?: string | null
          contract_value?: number | null
          created_at?: string
          curve_abc?: string | null
          due_date?: string | null
          entry_date?: string | null
          id?: string
          invested_tp?: string | null
          meta_vendas_loja?: number | null
          meta_vendas_trafego?: number | null
          name?: string
          niche?: string | null
          observations?: string | null
          prioritization?: string | null
          priority_score?: number
          renewal_60d?: boolean | null
          sales_goal?: number | null
          services?: string | null
          sprint?: string | null
          squad_id?: string
          strategy_file_name?: string | null
          strategy_file_url?: string | null
          ticket_medio?: number | null
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
      squad_consolidated_notes: {
        Row: {
          action_plan: string | null
          assignee: string | null
          client_id: string
          created_at: string
          created_by: string | null
          deadline: string | null
          id: string
          observations: string | null
          problem_area: string | null
          problem_description: string | null
          squad_id: string
          status: string
          updated_at: string
          week_start: string
          week_summary: string
        }
        Insert: {
          action_plan?: string | null
          assignee?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          observations?: string | null
          problem_area?: string | null
          problem_description?: string | null
          squad_id: string
          status?: string
          updated_at?: string
          week_start?: string
          week_summary?: string
        }
        Update: {
          action_plan?: string | null
          assignee?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          observations?: string | null
          problem_area?: string | null
          problem_description?: string | null
          squad_id?: string
          status?: string
          updated_at?: string
          week_start?: string
          week_summary?: string
        }
        Relationships: []
      }
      squad_consolidated_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          ended_at: string | null
          id: string
          squad_id: string
          started_at: string
          total_seconds: number | null
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          squad_id: string
          started_at?: string
          total_seconds?: number | null
          week_start?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          squad_id?: string
          started_at?: string
          total_seconds?: number | null
          week_start?: string
        }
        Relationships: []
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
          conversao_comercial: number | null
          created_at: string
          crm_usage: number | null
          curve_abc: string | null
          deleted_at: string | null
          engagement_score: number | null
          faturamento: number | null
          faturamento_perc_canais: string | null
          faturamento_por_canais: string | null
          id: string
          meta_faturamento: number | null
          meta_status: string | null
          meta_vendas: number | null
          meta_vendas_loja: number | null
          meta_vendas_trafego: number | null
          nps_individual: number | null
          observation: string | null
          plano_estrategico: boolean | null
          plano_estrategico_link: string | null
          reference_month: string
          sprint: string | null
          squad_id: string
          updated_at: string
          venda_secundaria: number | null
          vendas: number | null
          vendas_loja: number | null
          vendas_perc_canais: string | null
          vendas_por_canais: string | null
          vendas_trafego: number | null
        }
        Insert: {
          client_name: string
          contact?: string | null
          conversao_comercial?: number | null
          created_at?: string
          crm_usage?: number | null
          curve_abc?: string | null
          deleted_at?: string | null
          engagement_score?: number | null
          faturamento?: number | null
          faturamento_perc_canais?: string | null
          faturamento_por_canais?: string | null
          id?: string
          meta_faturamento?: number | null
          meta_status?: string | null
          meta_vendas?: number | null
          meta_vendas_loja?: number | null
          meta_vendas_trafego?: number | null
          nps_individual?: number | null
          observation?: string | null
          plano_estrategico?: boolean | null
          plano_estrategico_link?: string | null
          reference_month: string
          sprint?: string | null
          squad_id: string
          updated_at?: string
          venda_secundaria?: number | null
          vendas?: number | null
          vendas_loja?: number | null
          vendas_perc_canais?: string | null
          vendas_por_canais?: string | null
          vendas_trafego?: number | null
        }
        Update: {
          client_name?: string
          contact?: string | null
          conversao_comercial?: number | null
          created_at?: string
          crm_usage?: number | null
          curve_abc?: string | null
          deleted_at?: string | null
          engagement_score?: number | null
          faturamento?: number | null
          faturamento_perc_canais?: string | null
          faturamento_por_canais?: string | null
          id?: string
          meta_faturamento?: number | null
          meta_status?: string | null
          meta_vendas?: number | null
          meta_vendas_loja?: number | null
          meta_vendas_trafego?: number | null
          nps_individual?: number | null
          observation?: string | null
          plano_estrategico?: boolean | null
          plano_estrategico_link?: string | null
          reference_month?: string
          sprint?: string | null
          squad_id?: string
          updated_at?: string
          venda_secundaria?: number | null
          vendas?: number | null
          vendas_loja?: number | null
          vendas_perc_canais?: string | null
          vendas_por_canais?: string | null
          vendas_trafego?: number | null
        }
        Relationships: []
      }
      squad_fechamento_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          ended_at: string | null
          id: string
          notes: string | null
          reference_month: string
          squad_id: string
          started_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          reference_month: string
          squad_id: string
          started_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          reference_month?: string
          squad_id?: string
          started_at?: string | null
        }
        Relationships: []
      }
      squad_goal_notes: {
        Row: {
          client_name: string
          id: string
          observacoes: string | null
          reference_month: string
          squad_id: string
          updated_at: string
          weak_points: string[]
        }
        Insert: {
          client_name: string
          id?: string
          observacoes?: string | null
          reference_month: string
          squad_id: string
          updated_at?: string
          weak_points?: string[]
        }
        Update: {
          client_name?: string
          id?: string
          observacoes?: string | null
          reference_month?: string
          squad_id?: string
          updated_at?: string
          weak_points?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "squad_goal_notes_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
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
      squad_monthly_sessions: {
        Row: {
          client_name: string
          created_at: string | null
          created_by: string | null
          early_end_reason: string | null
          ended_at: string | null
          id: string
          projection_file_name: string | null
          projection_file_url: string | null
          reference_month: string
          squad_id: string | null
          started_at: string | null
        }
        Insert: {
          client_name: string
          created_at?: string | null
          created_by?: string | null
          early_end_reason?: string | null
          ended_at?: string | null
          id?: string
          projection_file_name?: string | null
          projection_file_url?: string | null
          reference_month: string
          squad_id?: string | null
          started_at?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          early_end_reason?: string | null
          ended_at?: string | null
          id?: string
          projection_file_name?: string | null
          projection_file_url?: string | null
          reference_month?: string
          squad_id?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "squad_monthly_sessions_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
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
      squad_subtasks: {
        Row: {
          created_at: string
          created_by: string | null
          done: boolean
          id: string
          position: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done?: boolean
          id?: string
          position?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done?: boolean
          id?: string
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      squad_task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      squad_task_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      squad_task_date_changes: {
        Row: {
          created_at: string
          id: string
          new_due_date: string | null
          old_due_date: string | null
          reason: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_due_date?: string | null
          old_due_date?: string | null
          reason: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_due_date?: string | null
          old_due_date?: string | null
          reason?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_task_date_changes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "squad_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_task_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_assignee_id: string | null
          description: string | null
          due_days_offset: number | null
          id: string
          list_key: string
          priority: string
          recurrence_interval_days: number | null
          recurrence_mode: string | null
          recurrence_weekdays: number[] | null
          squad_id: string
          target_client_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          description?: string | null
          due_days_offset?: number | null
          id?: string
          list_key: string
          priority?: string
          recurrence_interval_days?: number | null
          recurrence_mode?: string | null
          recurrence_weekdays?: number[] | null
          squad_id: string
          target_client_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_assignee_id?: string | null
          description?: string | null
          due_days_offset?: number | null
          id?: string
          list_key?: string
          priority?: string
          recurrence_interval_days?: number | null
          recurrence_mode?: string | null
          recurrence_weekdays?: number[] | null
          squad_id?: string
          target_client_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      squad_tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          cycle_key: string | null
          description: string | null
          due_date: string | null
          id: string
          list_key: string
          priority: string
          squad_client_id: string
          standby_at: string | null
          standby_reason: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cycle_key?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          list_key: string
          priority?: string
          squad_client_id: string
          standby_at?: string | null
          standby_reason?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cycle_key?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          list_key?: string
          priority?: string
          squad_client_id?: string
          standby_at?: string | null
          standby_reason?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_tasks_squad_client_id_fkey"
            columns: ["squad_client_id"]
            isOneToOne: false
            referencedRelation: "squad_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "squad_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_weak_points: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
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
      user_passkeys: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
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
      crm_current_cliente_id: { Args: never; Returns: string }
      crm_ingest_whatsapp:
        | {
            Args: {
              p_chat_id?: string
              p_instance_id: string
              p_is_group?: boolean
              p_message_id?: string
              p_nome?: string
              p_participant_name?: string
              p_participant_phone?: string
              p_phone: string
              p_photo?: string
              p_secret: string
              p_texto?: string
              p_tipo?: string
              p_url_midia?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_chat_id?: string
              p_instance_id: string
              p_is_group?: boolean
              p_message_id?: string
              p_nome?: string
              p_participant_name?: string
              p_participant_phone?: string
              p_phone: string
              p_photo?: string
              p_secret: string
              p_sender_photo?: string
              p_texto?: string
              p_tipo?: string
              p_url_midia?: string
            }
            Returns: string
          }
      crm_is_admin: { Args: never; Returns: boolean }
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
          squad_id: string
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
      update_own_profile: {
        Args: { _avatar_url: string; _full_name: string; _phone: string }
        Returns: undefined
      }
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
