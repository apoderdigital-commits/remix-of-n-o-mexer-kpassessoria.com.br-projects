import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Metas do funil (mesmos % usados na dashboard) ──
const META_QUALIFICACOES = 60; // % dos leads
const META_LEADS_QUALIFICADOS = 20; // % das qualificações
const META_VENDAS = 25; // % dos leads qualificados

const fmtMoney = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const fmtDateBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const fmtDayMonth = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

function computePeriod(reportType: string): { since: string; until: string } {
  const today = new Date();
  if (reportType === "daily") {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    return { since: iso(y), until: iso(y) };
  }
  if (reportType === "monthly") {
    const firstOfThis = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastPrev = new Date(firstOfThis);
    lastPrev.setDate(0);
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
    return { since: iso(firstPrev), until: iso(lastPrev) };
  }
  // weekly (default) — igual ao "7d" da dashboard (hoje-7 .. hoje)
  const until = today;
  const since = new Date(today);
  since.setDate(today.getDate() - 7);
  return { since: iso(since), until: iso(until) };
}

const REPORT_LABEL: Record<string, string> = {
  daily: "Relatório Diário",
  weekly: "Relatório Semanal",
  monthly: "Relatório Mensal",
};

// Linha de status (passou / exato / faltou)
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

const MEDALS = ["🥇", "🥈", "🥉"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const client_id: string = body.client_id;
    const report_type: string = body.report_type || "weekly";
    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Client + report config
    const { data: client } = await supabase
      .from("clients")
      .select("name, ghl_api_key, ghl_location_id")
      .eq("id", client_id)
      .single();

    const { data: cfg } = await supabase
      .from("client_report_configs")
      .select("whatsapp_jid, metric_source")
      .eq("client_id", client_id)
      .maybeSingle();

    const metricSource: "ghl" | "planilha" =
      body.metric_source || cfg?.metric_source || "ghl";
    const jid: string = body.whatsapp_jid || cfg?.whatsapp_jid || "";
    const clientName = client?.name || "Cliente";

    // Period
    const period =
      body.since && body.until
        ? { since: body.since, until: body.until }
        : computePeriod(report_type);

    // ── Meta (investimento + leads) — RESPEITANDO o filtro de campanhas do cliente ──
    // 1) Sincroniza a Meta (atualiza meta_campaigns no período).
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/fetch-meta-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ client_id, since: period.since, until: period.until }),
      });
    } catch (_) {
      // segue com o que já estiver salvo na tabela
    }
    // 2) Filtro de campanhas (excluídas) configurado para o cliente.
    let excludedCampaigns: string[] = [];
    try {
      const { data: filt } = await supabase
        .from("client_campaign_filters")
        .select("excluded_campaigns")
        .eq("client_id", client_id)
        .maybeSingle();
      excludedCampaigns = ((filt?.excluded_campaigns as string[]) || []);
    } catch (_) {
      // sem filtro → conta todas
    }
    const exclSet = new Set(excludedCampaigns.map((s: string) => (s || "").trim()));
    // 3) Soma por campanha, ignorando as excluídas (mesma lógica da dashboard).
    let totalSpent = 0;
    let totalLeads = 0;
    const { data: campaigns } = await supabase
      .from("meta_campaigns")
      .select("campaign_name, amount_spent, leads_total")
      .eq("client_id", client_id)
      .gte("date", period.since)
      .lte("date", period.until);
    for (const c of (campaigns || [])) {
      if (exclSet.has(((c as any).campaign_name || "").trim())) continue;
      totalSpent += Number((c as any).amount_spent) || 0;
      totalLeads += Number((c as any).leads_total) || 0;
    }
    const cpl = totalLeads > 0 ? totalSpent / totalLeads : 0;

    // ── Funil ──
    let qualificacoes = 0;
    let leadsQualificados = 0;
    let vendas = 0;

    if (metricSource === "ghl" && client?.ghl_api_key && client?.ghl_location_id) {
      const ghlRes = await fetch(`${SUPABASE_URL}/functions/v1/fetch-ghl-pipeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ client_id, since: period.since, until: period.until }),
      });
      if (ghlRes.ok) {
        const g = await ghlRes.json();
        qualificacoes = g.simulacoes ?? 0;
        leadsQualificados = g.cpf_aprovado ?? 0;
        vendas = (g.vendas_financiamento ?? 0) + (g.vendas_consorcio ?? 0);
      }
    }

    // Planilha (também usada como fallback se GHL não trouxe nada)
    const { data: leads } = await supabase
      .from("qualified_leads")
      .select("status, creative_name")
      .eq("client_id", client_id)
      .gte("lead_date", period.since)
      .lte("lead_date", period.until);

    const leadRows = leads || [];
    if (metricSource === "planilha" || qualificacoes === 0) {
      const cpfApproved = leadRows.filter((l: any) => l.status === "cpf_approved").length;
      const sales = leadRows.filter(
        (l: any) =>
          l.status === "sale_financing" ||
          l.status === "sale_consortium" ||
          l.status === "sale"
      ).length;
      if (metricSource === "planilha") {
        qualificacoes = cpfApproved; // aproximação da planilha
        leadsQualificados = cpfApproved;
        vendas = sales;
      } else if (qualificacoes === 0) {
        leadsQualificados = leadsQualificados || cpfApproved;
        vendas = vendas || sales;
      }
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
      .map(([name, count]) => ({
        name,
        count,
        pct: totalCpf > 0 ? (count / totalCpf) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // ── Monta a mensagem ──
    const DIV = "──────────────────────";
    const SUBDIV = "──────────────";
    const lines: string[] = [];

    lines.push(`📊 *${REPORT_LABEL[report_type] || "Relatório"} - KP Assessoria*`);
    lines.push(`📅 ${fmtDayMonth(period.since)} a ${fmtDateBR(period.until)}`);
    lines.push("");
    lines.push(`💰 *Investimento:* ${fmtMoney(totalSpent)}`);
    lines.push(`👥 *Leads captados:* ${fmtInt(totalLeads)}`);
    lines.push(`📉 *CPL:* ${fmtMoney(cpl)}`);
    lines.push("");
    lines.push(DIV);
    lines.push(`🏆 *Funil Comercial*`);
    lines.push("");
    lines.push(
      funnelBlock("🔵", "Qualificações Realizadas", qualificacoes, totalLeads, META_QUALIFICACOES, "dos leads")
    );
    lines.push("");
    lines.push(SUBDIV);
    lines.push(
      funnelBlock("✅", "Leads Qualificados", leadsQualificados, qualificacoes, META_LEADS_QUALIFICADOS, "das qualificações")
    );
    lines.push("");
    lines.push(SUBDIV);
    lines.push(
      funnelBlock("💳", "Vendas Totais", vendas, leadsQualificados, META_VENDAS, "dos leads qualificados")
    );

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

    const message = lines.join("\n");

    return new Response(
      JSON.stringify({
        message,
        jid,
        client_name: clientName,
        report_type,
        metric_source: metricSource,
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("build-report-message error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
