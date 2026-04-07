import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, meta_account_id, meta_access_token, google_sheet_id, user_id, created_at")
        .order("name");
      if (error) throw error;
      return data;
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
