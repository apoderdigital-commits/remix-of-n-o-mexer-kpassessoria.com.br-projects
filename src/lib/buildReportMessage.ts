import { supabase } from "@/integrations/supabase/client";

// Metas do funil (mesmos % usados na dashboard)
const META_QUALIFICACOES = 60; // % dos leads
const META_LEADS_QUALIFICADOS = 20; // % das qualificações
const META_VENDAS = 25; // % dos leads qualificados

const fmtMoney = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

const REPORT_LABEL: Record<string, string> = {
  daily: "Relatório Diário",
  weekly: "Relatório Semanal",
  monthly: "Relatório Mensal",
};

const MEDALS = ["🥇", "🥈", "🥉"];

const isoToBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const isoToDayMonth = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function funnelBlock(
  emoji: string,
  title: string,
  realizado: number,
  base: number,
  metaPct: number,
  metaDesc: string
): string {
  const metaQty = Math.ceil(base * (metaPct / 100));
  const realPct = base > 0 ? (realizado / base) * 100 : 0;
  let statusLine: string;
  if (realizado > metaQty) statusLine = `✅ Passou em +${fmtInt(realizado - metaQty)}`;
  else if (realizado === metaQty) statusLine = `🟡 Bateu exato a meta`;
  else statusLine = `🔴 Faltaram ${fmtInt(metaQty - realizado)}`;
  return [
    `${emoji} *${title}*`,
    `↳ Realizado: *${fmtInt(realizado)}* (${realPct.toFixed(0)}%)`,
    `↳ Meta: ${fmtInt(metaQty)} (mín. ${metaPct}% ${metaDesc})`,
    statusLine,
  ].join("\n");
}

export interface BuiltReport {
  message: string;
  metrics: Record<string, any>;
  period: { since: string; until: string };
}

/**
 * Monta a mensagem do relatório DIRETO no frontend (mesma lógica da edge function).
 * Usado no botão "Enviar Teste" para não depender de deploy.
 */
export async function buildReportMessageClient(opts: {
  clientId: string;
  metricSource: "ghl" | "planilha";
  reportType?: "daily" | "weekly" | "monthly";
}): Promise<BuiltReport> {
  const { clientId, metricSource } = opts;
  const reportType = opts.reportType ?? "weekly";

  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // Período conforme o tipo (mesma lógica do automático)
  const today = new Date();
  let period: { since: string; until: string };
  if (reportType === "daily") {
    // ontem (dia completo)
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    period = { since: iso(y), until: iso(y) };
  } else if (reportType === "monthly") {
    // mês anterior completo
    const firstOfThis = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastPrev = new Date(firstOfThis);
    lastPrev.setDate(0);
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
    period = { since: iso(firstPrev), until: iso(lastPrev) };
  } else {
    // weekly — igual ao "7d" da dashboard (hoje-7 .. hoje)
    const since = new Date(today);
    since.setDate(today.getDate() - 7);
    period = { since: iso(since), until: iso(today) };
  }

  // ── Meta (investimento + leads) ──
  // A própria fetch-meta-data sincroniza E retorna os totais — usamos o retorno direto.
  let totalSpent = 0;
  let totalLeads = 0;
  try {
    const { data: metaSync } = await supabase.functions.invoke("fetch-meta-data", {
      body: { client_id: clientId, since: period.since, until: period.until },
    });
    if (metaSync?.success) {
      totalSpent = Number(metaSync.total_spent) || 0;
      totalLeads = Number(metaSync.total_leads) || 0;
    }
  } catch (_) {
    // cai no fallback abaixo
  }

  // Fallback: lê a tabela se o sync não trouxe os totais
  if (totalSpent === 0 && totalLeads === 0) {
    const { data: campaigns } = await supabase
      .from("meta_campaigns")
      .select("amount_spent, leads_total")
      .eq("client_id", clientId)
      .gte("date", period.since)
      .lte("date", period.until);
    totalSpent = (campaigns || []).reduce((s: number, c: any) => s + (Number(c.amount_spent) || 0), 0);
    totalLeads = (campaigns || []).reduce((s: number, c: any) => s + (c.leads_total || 0), 0);
  }

  const cpl = totalLeads > 0 ? totalSpent / totalLeads : 0;

  // ── Leads (planilha + criativos) ──
  const { data: leads } = await supabase
    .from("qualified_leads")
    .select("status, creative_name")
    .eq("client_id", clientId)
    .gte("lead_date", period.since)
    .lte("lead_date", period.until);
  const leadRows = leads || [];

  // ── Funil ──
  let qualificacoes = 0;
  let leadsQualificados = 0;
  let vendas = 0;

  if (metricSource === "ghl") {
    try {
      const { data: ghl } = await supabase.functions.invoke("fetch-ghl-pipeline", {
        body: { client_id: clientId, since: period.since, until: period.until },
      });
      if (ghl) {
        qualificacoes = ghl.simulacoes ?? 0;
        leadsQualificados = ghl.cpf_aprovado ?? 0;
        vendas = (ghl.vendas_financiamento ?? 0) + (ghl.vendas_consorcio ?? 0);
      }
    } catch (_) {
      // cai no fallback da planilha abaixo
    }
  }

  const cpfApproved = leadRows.filter((l: any) => l.status === "cpf_approved").length;
  const sales = leadRows.filter(
    (l: any) =>
      l.status === "sale_financing" ||
      l.status === "sale_consortium" ||
      l.status === "sale"
  ).length;

  if (metricSource === "planilha") {
    qualificacoes = cpfApproved;
    leadsQualificados = cpfApproved;
    vendas = sales;
  } else if (qualificacoes === 0 && leadsQualificados === 0 && vendas === 0) {
    // Fallback se GHL não trouxe nada
    leadsQualificados = cpfApproved;
    vendas = sales;
  }

  // ── Top criativos (Lead Qualificado) ──
  const creativeMap = new Map<string, number>();
  leadRows
    .filter((l: any) => l.status === "cpf_approved" && l.creative_name)
    .forEach((l: any) =>
      creativeMap.set(l.creative_name, (creativeMap.get(l.creative_name) || 0) + 1)
    );
  const totalCpf = Array.from(creativeMap.values()).reduce((s, n) => s + n, 0);
  const topCreatives = Array.from(creativeMap.entries())
    .map(([name, count]) => ({ name, count, pct: totalCpf > 0 ? (count / totalCpf) * 100 : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // ── Monta a mensagem ──
  const DIV = "──────────────────────";
  const SUBDIV = "──────────────";
  const lines: string[] = [];

  lines.push(`📊 *${REPORT_LABEL[reportType] || "Relatório"} - KP Assessoria*`);
  lines.push(`📅 ${isoToDayMonth(period.since)} a ${isoToBR(period.until)}`);
  lines.push("");
  lines.push(`💰 *Investimento:* ${fmtMoney(totalSpent)}`);
  lines.push(`👥 *Leads captados:* ${fmtInt(totalLeads)}`);
  lines.push(`📉 *CPL:* ${fmtMoney(cpl)}`);
  lines.push("");
  lines.push(DIV);
  lines.push(`🏆 *Funil Comercial*`);
  lines.push("");
  lines.push(funnelBlock("🔵", "Qualificações Realizadas", qualificacoes, totalLeads, META_QUALIFICACOES, "dos leads"));
  lines.push("");
  lines.push(SUBDIV);
  lines.push(funnelBlock("✅", "Leads Qualificados", leadsQualificados, qualificacoes, META_LEADS_QUALIFICADOS, "das qualificações"));
  lines.push("");
  lines.push(SUBDIV);
  lines.push(funnelBlock("💳", "Vendas Totais", vendas, leadsQualificados, META_VENDAS, "dos leads qualificados"));

  if (topCreatives.length > 0) {
    lines.push("");
    lines.push(DIV);
    lines.push(`🎨 *Top Criativo — Lead Qualificado*`);
    topCreatives.forEach((c, i) => {
      lines.push(`${MEDALS[i]} ${c.name} → *${fmtInt(c.count)} leads* (${c.pct.toFixed(1)}%)`);
    });
  }

  lines.push("");
  lines.push(DIV);
  lines.push(`_Gerado automaticamente · KP Assessoria_`);

  return {
    message: lines.join("\n"),
    period,
    metrics: {
      investimento: totalSpent,
      leads: totalLeads,
      cpl,
      qualificacoes,
      leads_qualificados: leadsQualificados,
      vendas,
      top_creatives: topCreatives,
    },
  };
}
