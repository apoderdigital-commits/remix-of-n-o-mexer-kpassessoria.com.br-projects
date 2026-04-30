import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AccessibleClient {
  id: string;
  name: string;
  meta_account_id?: string | null;
  google_sheet_id?: string | null;
  ticket_medio?: number | null;
  phone?: string | null;
  created_at?: string;
  has_meta_credentials?: boolean;
  has_google_sheet?: boolean;
  has_ghl_credentials?: boolean;
  has_ticket_medio?: boolean;
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, meta_account_id, meta_access_token, meta_token_id, google_sheet_id, ticket_medio, user_id, created_at, ghl_api_key, ghl_location_id, ghl_stage_mapping, phone")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAccessibleClients() {
  return useQuery({
    queryKey: ["accessible_clients"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_accessible_clients");
      if (error) throw error;
      return (data || []) as AccessibleClient[];
    },
  });
}

export function useMetaCampaigns(clientId: string | null, since?: string, until?: string) {
  return useQuery({
    queryKey: ["meta_campaigns", clientId, since, until],
    queryFn: async () => {
      if (!clientId) return [];
      let query = supabase
        .from("meta_campaigns")
        .select("*")
        .eq("client_id", clientId);
      if (since) query = query.gte("date", since);
      if (until) query = query.lte("date", until);
      const { data, error } = await query.order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function useQualifiedLeads(clientId: string | null, since?: string, until?: string) {
  return useQuery({
    queryKey: ["qualified_leads", clientId, since, until],
    queryFn: async () => {
      if (!clientId) return [];
      let query = supabase
        .from("qualified_leads")
        .select("*")
        .eq("client_id", clientId);
      if (since) query = query.gte("lead_date", since);
      if (until) query = query.lte("lead_date", until);
      const { data, error } = await query.order("lead_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function useSyncMeta(clientId: string | null) {
  const sync = async (since: string, until: string) => {
    if (!clientId) return;
    const { data, error } = await supabase.functions.invoke("fetch-meta-data", {
      body: { client_id: clientId, since, until },
    });
    if (error) throw error;
    return data;
  };
  return { sync };
}

export function useGhlPipeline(clientId: string | null, since?: string, until?: string) {
  return useQuery({
    queryKey: ["ghl_pipeline", clientId, since, until],
    queryFn: async () => {
      if (!clientId) return null;

      const { data, error } = await supabase.functions.invoke("fetch-ghl-pipeline", {
        body: { client_id: clientId, since, until },
      });
      if (error) {
        let msg = "";
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            msg = body?.error ?? "";
          }
        } catch (_) {
          // ignore
        }
        if (msg.includes("GHL not configured")) return null;
        if ((error as any)?.context?.status === 400) return null;
        throw error;
      }
      return data as {
        simulacoes: number;
        cpf_aprovado: number;
        cpf_nao_aprovado: number;
        vendas_financiamento: number;
        vendas_consorcio: number;
        pipeline_name: string;
        stages: { id: string; name: string }[];
        mapping_complete: boolean;
        missing_metrics: string[];
        has_manual_mapping: boolean;
      };
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSyncGoogleSheet(clientId: string | null) {
  const sync = async (since: string, until: string) => {
    if (!clientId) return;
    const { data, error } = await supabase.functions.invoke("sync-google-sheet", {
      body: { client_id: clientId, since, until },
    });
    if (error) throw error;
    return data;
  };
  return { sync };
}
