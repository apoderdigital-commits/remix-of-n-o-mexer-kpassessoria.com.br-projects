// Lovable AI: gera resumo executivo OU alertas/oportunidades a partir dos dados agregados da dashboard.
// Public function (verify_jwt = false). Cacheia por (cliente, período, mode) para retornar sempre o mesmo resultado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3-flash-preview";

interface Payload {
  mode: "summary" | "alerts";
  clientId?: string;
  force?: boolean;
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
  previous?: Partial<Payload["kpis"]> | null;
  topCreatives?: { name: string; count: number; pct: number }[];
  fallingCreatives?: { name: string; pctChange: number }[];
  risingCreatives?: { name: string; pctChange: number }[];
  topSellers?: { name: string; count: number }[];
  monthlyTrend?: { month: string; leads: number; cpf: number; sales: number }[];
}

function buildSystemPrompt(mode: "summary" | "alerts") {
  if (mode === "summary") {
    return `Você é um analista sênior de marketing de performance que escreve em português do Brasil.
Sua audiência é o gestor/dono de uma operação que vende financiamento e consórcio via Meta Ads.
Receba dados agregados do período e devolva uma análise concisa, direta e acionável.
Nunca invente números — use apenas os fornecidos. Se um dado estiver ausente, omita.
Tom: profissional, objetivo, sem floreios. Use R$ com vírgula para valores monetários.`;
  }
  return `Você é um analista sênior de marketing de performance que escreve em português do Brasil.
Você gera ALERTAS (problemas que merecem ação imediata) e OPORTUNIDADES (movimentos para escalar) a partir dos dados.
Seja específico e acionável. Nunca invente números. Cada item deve ter título curto, descrição em 1 frase e ação sugerida.`;
}

function buildUserPrompt(p: Payload) {
  const fmt = (n?: number) =>
    typeof n === "number" ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";

  const periodLabel = p.period.label || `${p.period.since} a ${p.period.until}`;
  const totalSales = (p.kpis.vendasFinanciamento || 0) + (p.kpis.vendasConsorcio || 0);
  const prevSales = p.previous
    ? (p.previous.vendasFinanciamento || 0) + (p.previous.vendasConsorcio || 0)
    : null;

  const lines: string[] = [];
  lines.push(`Cliente: ${p.clientName || "—"}`);
  lines.push(`Período: ${periodLabel}`);
  lines.push("");
  lines.push("KPIs do período:");
  lines.push(`- Investimento: R$ ${fmt(p.kpis.investimento)}`);
  lines.push(`- Leads: ${fmt(p.kpis.leads)}`);
  lines.push(`- CPL: R$ ${fmt(p.kpis.cpl)}`);
  lines.push(`- Simulações: ${fmt(p.kpis.simulacoes)}`);
  lines.push(`- CPF Aprovado: ${fmt(p.kpis.cpfAprovado)}`);
  lines.push(`- Vendas Financiamento: ${fmt(p.kpis.vendasFinanciamento)}`);
  lines.push(`- Vendas Consórcio: ${fmt(p.kpis.vendasConsorcio)}`);
  lines.push(`- Vendas totais: ${fmt(totalSales)}`);

  if (p.previous) {
    lines.push("");
    lines.push("Período anterior (comparação):");
    lines.push(`- Leads: ${fmt(p.previous.leads)}`);
    lines.push(`- CPL: R$ ${fmt(p.previous.cpl)}`);
    lines.push(`- CPF Aprovado: ${fmt(p.previous.cpfAprovado)}`);
    lines.push(`- Vendas totais: ${fmt(prevSales || 0)}`);
  }

  if (p.topCreatives?.length) {
    lines.push("");
    lines.push("Top 5 criativos (CPF aprovado no período):");
    p.topCreatives.slice(0, 5).forEach((c, i) => {
      lines.push(`  ${i + 1}. ${c.name} — ${c.count} aprovações (${c.pct.toFixed(1)}%)`);
    });
  }

  if (p.risingCreatives?.length) {
    lines.push("");
    lines.push("Criativos em alta (últimos 7d vs 7d anteriores):");
    p.risingCreatives.slice(0, 3).forEach((c) => {
      lines.push(`  - ${c.name}: +${c.pctChange.toFixed(0)}%`);
    });
  }

  if (p.fallingCreatives?.length) {
    lines.push("");
    lines.push("Criativos em queda (últimos 7d vs 7d anteriores):");
    p.fallingCreatives.slice(0, 3).forEach((c) => {
      lines.push(`  - ${c.name}: ${c.pctChange.toFixed(0)}%`);
    });
  }

  if (p.topSellers?.length) {
    lines.push("");
    lines.push("Top vendedores (vendas no período):");
    p.topSellers.slice(0, 5).forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.name} — ${s.count} vendas`);
    });
  }

  if (p.monthlyTrend?.length) {
    lines.push("");
    lines.push("Tendência mensal (últimos meses):");
    p.monthlyTrend.forEach((m) => {
      lines.push(`  ${m.month}: ${m.leads} leads / ${m.cpf} CPF / ${m.sales} vendas`);
    });
  }

  return lines.join("\n");
}

const summaryTool = {
  type: "function",
  function: {
    name: "render_summary",
    description: "Devolve o resumo executivo estruturado.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: {
          type: "string",
          description: "Frase-resumo em 1 linha (máx ~120 caracteres) que captura o estado da operação.",
        },
        funcionando: {
          type: "array",
          description: "2 a 3 frases sobre o que está indo bem, citando números.",
          items: { type: "string" },
        },
        atencao: {
          type: "array",
          description: "2 a 3 frases sobre o que precisa de atenção, citando números.",
          items: { type: "string" },
        },
        proximos_passos: {
          type: "array",
          description: "2 a 3 ações concretas e priorizadas que o gestor deve tomar.",
          items: { type: "string" },
        },
      },
      required: ["headline", "funcionando", "atencao", "proximos_passos"],
    },
  },
};

const alertsTool = {
  type: "function",
  function: {
    name: "render_alerts",
    description: "Devolve até 3 alertas (problemas) e até 3 oportunidades (escalar).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        alerts: {
          type: "array",
          description: "Até 3 alertas. Quanto mais grave, mais alto.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              severity: { type: "string", enum: ["high", "medium", "low"] },
              title: { type: "string", description: "Título curto (máx 60 chars)." },
              description: { type: "string", description: "1 frase com o número que comprova o problema." },
              action: { type: "string", description: "Ação concreta sugerida." },
            },
            required: ["severity", "title", "description", "action"],
          },
        },
        opportunities: {
          type: "array",
          description: "Até 3 oportunidades de escalar.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string", description: "Título curto (máx 60 chars)." },
              description: { type: "string", description: "1 frase com o número que comprova a oportunidade." },
              action: { type: "string", description: "Ação concreta sugerida." },
            },
            required: ["title", "description", "action"],
          },
        },
      },
      required: ["alerts", "opportunities"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Payload;
    if (!payload?.mode || !payload?.kpis || !payload?.period) {
      return new Response(JSON.stringify({ error: "payload inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache lookup (only if we have clientId + valid period)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase =
      SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

    const canCache = !!(payload.clientId && payload.period?.since && payload.period?.until && supabase);

    if (canCache && !payload.force) {
      const { data: cached } = await supabase!
        .from("ai_insights_cache")
        .select("result, created_at")
        .eq("client_id", payload.clientId!)
        .eq("since", payload.period.since)
        .eq("until", payload.period.until)
        .eq("mode", payload.mode)
        .maybeSingle();

      if (cached?.result) {
        return new Response(
          JSON.stringify({
            mode: payload.mode,
            result: cached.result,
            generatedAt: cached.created_at,
            cached: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    const tool = payload.mode === "summary" ? summaryTool : alertsTool;
    const toolName = tool.function.name;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt(payload.mode) },
          { role: "user", content: buildUserPrompt(payload) },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de uso excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "Falha ao gerar análise" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta da IA sem tool call" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generatedAt = new Date().toISOString();

    // Save to cache (upsert)
    if (canCache) {
      try {
        await supabase!
          .from("ai_insights_cache")
          .upsert(
            {
              client_id: payload.clientId!,
              since: payload.period.since,
              until: payload.period.until,
              mode: payload.mode,
              payload_hash: "",
              result: parsed as any,
              created_at: generatedAt,
            },
            { onConflict: "client_id,since,until,mode" }
          );
      } catch (e) {
        console.error("cache upsert failed:", e);
      }
    }

    return new Response(
      JSON.stringify({ mode: payload.mode, result: parsed, generatedAt, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("generate-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
