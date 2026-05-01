// Helper para montar o payload de contexto enviado às funções de IA.
// Usado tanto pelo resumo executivo quanto pelo chat.

export interface AIContext {
  clientName?: string;
  period: { since: string; until: string; label?: string };
  kpis: {
    investimento: number;
    leads: number;
    cpl: number;
    simulacoes: number;
    cpfAprovado: number;
    vendasFinanciamento: number;
    vendasConsorcio: number;
  };
  previous?: AIContext["kpis"] | null;
  topCreatives?: { name: string; count: number; pct: number }[];
  topSellers?: { name: string; count: number }[];
  risingCreatives?: { name: string; pctChange: number }[];
  fallingCreatives?: { name: string; pctChange: number }[];
  monthlyTrend?: { month: string; leads: number; cpf: number; sales: number }[];
  evolutionDaily?: { date: string; leads: number; cpf: number; sales: number; spent: number }[];
}

interface RawLead {
  creative_name: string;
  lead_date: string;
  status: string;
}

export function deriveCreativeMovers(leadsByDate: RawLead[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff14 = new Date(today);
  cutoff14.setDate(cutoff14.getDate() - 14);
  const cutoff7 = new Date(today);
  cutoff7.setDate(cutoff7.getDate() - 7);

  const recent = leadsByDate.filter((l) => {
    if (
      l.status !== "cpf_approved" &&
      l.status !== "sale_financing" &&
      l.status !== "sale_consortium" &&
      l.status !== "sale"
    )
      return false;
    return new Date(l.lead_date + "T00:00:00") >= cutoff14;
  });

  const map = new Map<string, { last7: number; prev7: number }>();
  recent.forEach((l) => {
    const d = new Date(l.lead_date + "T00:00:00");
    const cur = map.get(l.creative_name) || { last7: 0, prev7: 0 };
    if (d >= cutoff7) cur.last7 += 1;
    else cur.prev7 += 1;
    map.set(l.creative_name, cur);
  });

  const rising: { name: string; pctChange: number }[] = [];
  const falling: { name: string; pctChange: number }[] = [];
  map.forEach((v, name) => {
    if (v.last7 + v.prev7 < 4) return;
    if (v.prev7 === 0) {
      rising.push({ name, pctChange: 100 });
      return;
    }
    const pct = ((v.last7 - v.prev7) / v.prev7) * 100;
    if (pct > 30) rising.push({ name, pctChange: pct });
    else if (pct < -30) falling.push({ name, pctChange: pct });
  });

  rising.sort((a, b) => b.pctChange - a.pctChange);
  falling.sort((a, b) => a.pctChange - b.pctChange);
  return { rising: rising.slice(0, 3), falling: falling.slice(0, 3) };
}
