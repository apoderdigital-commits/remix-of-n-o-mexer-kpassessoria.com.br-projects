import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

export type HealthLevel = "green" | "yellow" | "red";

export interface ClientHealth {
  level: HealthLevel;
  failing: string[];
  metrics: {
    simLead: number | null;
    aprovSim: number | null;
    finAprov: number | null;
    salesLast7d: number;
    hasData: boolean;
  };
}

interface AggRow {
  client_id: string;
  leads: number;
  cpfApproved: number;
  salesFin: number;
  salesCons: number;
  sales: number;
  salesLast7d: number;
}

/**
 * Loads aggregated health metrics for ALL clients in a single pair of queries.
 * Uses last 30d of campaign data and qualified leads.
 */
export function useClientsHealth() {
  return useQuery({
    queryKey: ["clients_health"],
    queryFn: async (): Promise<Record<string, ClientHealth>> => {
      const since30 = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const since7 = format(subDays(new Date(), 7), "yyyy-MM-dd");

      const [campRes, leadsRes] = await Promise.all([
        supabase
          .from("meta_campaigns")
          .select("client_id, leads_total, date")
          .gte("date", since30),
        supabase
          .from("qualified_leads")
          .select("client_id, status, lead_date")
          .gte("lead_date", since30),
      ]);

      if (campRes.error) throw campRes.error;
      if (leadsRes.error) throw leadsRes.error;

      const agg = new Map<string, AggRow>();
      const get = (id: string): AggRow => {
        let r = agg.get(id);
        if (!r) {
          r = { client_id: id, leads: 0, cpfApproved: 0, salesFin: 0, salesCons: 0, sales: 0, salesLast7d: 0 };
          agg.set(id, r);
        }
        return r;
      };

      (campRes.data || []).forEach((c: any) => {
        get(c.client_id).leads += c.leads_total || 0;
      });

      (leadsRes.data || []).forEach((l: any) => {
        const r = get(l.client_id);
        const isSale =
          l.status === "sale_financing" ||
          l.status === "sale_consortium" ||
          l.status === "sale";
        if (l.status === "cpf_approved") r.cpfApproved += 1;
        if (l.status === "sale_financing") r.salesFin += 1;
        if (l.status === "sale_consortium") r.salesCons += 1;
        if (isSale) {
          r.sales += 1;
          if (l.lead_date >= since7) r.salesLast7d += 1;
        }
      });

      const out: Record<string, ClientHealth> = {};
      agg.forEach((r) => {
        // Proxy metrics using available DB data:
        // - Sim/Lead ≈ cpfApproved / leads (planilha não tem simulações; usamos qualificados)
        // - Aprov/Sim ≈ cpfApproved / leads também (sem simulações intermediárias)
        // - Fin/Aprov = (salesFin + salesCons + sales) / cpfApproved
        const simLead = r.leads > 0 ? (r.cpfApproved / r.leads) * 100 : null;
        const aprovSim = r.leads > 0 ? (r.cpfApproved / r.leads) * 100 : null;
        const finAprov =
          r.cpfApproved > 0 ? (r.sales / r.cpfApproved) * 100 : null;

        const failing: string[] = [];
        if (simLead !== null && simLead < 60) {
          failing.push(`Sim/Lead ${simLead.toFixed(1)}% (meta 60%)`);
        }
        if (aprovSim !== null && aprovSim < 20) {
          failing.push(`Aprov/Sim ${aprovSim.toFixed(1)}% (meta 20%)`);
        }
        if (finAprov !== null && finAprov < 25) {
          failing.push(`Fin/Aprov ${finAprov.toFixed(1)}% (meta 25%)`);
        }

        const hasData = r.leads > 0 || r.cpfApproved > 0;
        const noSales7d = hasData && r.salesLast7d === 0;
        if (noSales7d) failing.push("Sem vendas nos últimos 7 dias");

        let level: HealthLevel;
        if (!hasData) {
          level = "yellow";
          failing.unshift("Sem dados suficientes nos últimos 30 dias");
        } else if (noSales7d || failing.filter((f) => !f.includes("últimos 7")).length >= 2) {
          level = "red";
        } else if (failing.length === 1) {
          level = "yellow";
        } else if (failing.length === 0) {
          level = "green";
        } else {
          level = "yellow";
        }

        out[r.client_id] = {
          level,
          failing,
          metrics: {
            simLead,
            aprovSim,
            finAprov,
            salesLast7d: r.salesLast7d,
            hasData,
          },
        };
      });

      return out;
    },
    staleTime: 5 * 60 * 1000,
  });
}
