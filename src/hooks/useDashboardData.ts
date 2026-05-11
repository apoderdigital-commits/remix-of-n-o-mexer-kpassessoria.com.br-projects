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
  squad_id?: string | null;
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, meta_account_id, meta_access_token, meta_token_id, google_sheet_id, ticket_medio, user_id, created_at, ghl_api_key, ghl_location_id, ghl_stage_mapping, phone, squad_id")
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

// ===== Comparativo período anterior (mesmo número de dias antes do "since") =====
export function computePreviousPeriod(since: string, until: string) {
  const start = new Date(since + "T00:00:00");
  const end = new Date(until + "T00:00:00");
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { since: iso(prevStart), until: iso(prevEnd), days };
}

export function usePreviousPeriodData(
  clientId: string | null,
  since?: string,
  until?: string,
  enabled = true
) {
  const prev = since && until ? computePreviousPeriod(since, until) : null;
  return useQuery({
    queryKey: ["previous_period", clientId, prev?.since, prev?.until],
    queryFn: async () => {
      if (!clientId || !prev) return null;
      const [campRes, leadsRes, ghlRes] = await Promise.all([
        supabase
          .from("meta_campaigns")
          .select("amount_spent, leads_total, date")
          .eq("client_id", clientId)
          .gte("date", prev.since)
          .lte("date", prev.until),
        supabase
          .from("qualified_leads")
          .select("status, lead_date")
          .eq("client_id", clientId)
          .gte("lead_date", prev.since)
          .lte("lead_date", prev.until),
        supabase.functions
          .invoke("fetch-ghl-pipeline", {
            body: { client_id: clientId, since: prev.since, until: prev.until },
          })
          .catch(() => ({ data: null, error: null } as any)),
      ]);
      const campaigns = campRes.data || [];
      const leads = leadsRes.data || [];
      const ghl = (ghlRes as any)?.data ?? null;
      const totalLeads = campaigns.reduce((s: number, c: any) => s + (c.leads_total || 0), 0);
      const totalSpent = campaigns.reduce(
        (s: number, c: any) => s + (Number(c.amount_spent) || 0),
        0
      );
      const cpfApproved = leads.filter((l: any) => l.status === "cpf_approved").length;
      const salesFinancing = leads.filter((l: any) => l.status === "sale_financing").length;
      const salesConsortium = leads.filter((l: any) => l.status === "sale_consortium").length;
      const salesLegacy = leads.filter((l: any) => l.status === "sale").length;
      return {
        period: prev,
        totalLeads,
        totalSpent,
        cpl: totalLeads > 0 ? totalSpent / totalLeads : 0,
        cpfApproved,
        salesFinancing: salesFinancing + salesLegacy,
        salesConsortium,
        simulacoes: ghl?.simulacoes ?? 0,
        ghlCpfAprovado: ghl?.cpf_aprovado ?? 0,
        ghlVendasFinanciamento: ghl?.vendas_financiamento ?? 0,
        ghlVendasConsorcio: ghl?.vendas_consorcio ?? 0,
      };
    },
    enabled: !!clientId && !!prev && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ===== Tendência mensal (últimos 6 meses agregados a partir das tabelas) =====
export function useMonthlyTrend(clientId: string | null, monthsBack = 6) {
  return useQuery({
    queryKey: ["monthly_trend", clientId, monthsBack],
    queryFn: async () => {
      if (!clientId) return [];
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - (monthsBack - 1), 1);
      const startIso = start.toISOString().slice(0, 10);
      const [campRes, leadsRes] = await Promise.all([
        supabase
          .from("meta_campaigns")
          .select("date, amount_spent, leads_total")
          .eq("client_id", clientId)
          .gte("date", startIso),
        supabase
          .from("qualified_leads")
          .select("lead_date, status")
          .eq("client_id", clientId)
          .gte("lead_date", startIso),
      ]);
      const months = new Map<
        string,
        { key: string; label: string; leads: number; spent: number; cpf: number; sales: number }
      >();
      for (let i = 0; i < monthsBack; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - (monthsBack - 1 - i), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
        months.set(key, { key, label, leads: 0, spent: 0, cpf: 0, sales: 0 });
      }
      (campRes.data || []).forEach((c: any) => {
        const key = c.date.slice(0, 7);
        const row = months.get(key);
        if (!row) return;
        row.leads += c.leads_total || 0;
        row.spent += Number(c.amount_spent) || 0;
      });
      (leadsRes.data || []).forEach((l: any) => {
        const key = l.lead_date.slice(0, 7);
        const row = months.get(key);
        if (!row) return;
        if (l.status === "cpf_approved") row.cpf += 1;
        else if (
          l.status === "sale_financing" ||
          l.status === "sale_consortium" ||
          l.status === "sale"
        )
          row.sales += 1;
      });
      return Array.from(months.values());
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}
