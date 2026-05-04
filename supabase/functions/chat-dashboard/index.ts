// Lovable AI: chat com streaming sobre os dados da dashboard.
// Recebe: { messages: [{role,content}], context: {...dados agregados} }
// Devolve: SSE stream do gateway.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3-flash-preview";

interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  context: {
    clientName?: string;
    period: { since: string; until: string };
    kpis: Record<string, number>;
    previous?: Record<string, number> | null;
    topCreatives?: { name: string; count: number; pct: number }[];
    topSellers?: { name: string; count: number }[];
    risingCreatives?: { name: string; pctChange: number }[];
    fallingCreatives?: { name: string; pctChange: number }[];
    monthlyTrend?: { month: string; leads: number; cpf: number; sales: number }[];
    evolutionDaily?: { date: string; leads: number; cpf: number; sales: number; spent: number }[];
  };
}

function buildSystem(ctx: ChatRequest["context"]) {
  const fmt = (n?: number) =>
    typeof n === "number" ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";
  const k = ctx.kpis || {};
  const totalSales = (k.vendasFinanciamento || 0) + (k.vendasConsorcio || 0);

  const lines: string[] = [
    "Você é um analista sênior de marketing de performance que ajuda o gestor a entender os dados da dashboard.",
    "Responda em português do Brasil, com tom profissional e direto. Use markdown.",
    "Nunca invente números. Se a pergunta exigir um dado que você não tem no contexto, diga isso explicitamente.",
    "Quando citar valores monetários, use 'R$ X.XXX,XX'. Quando citar percentuais, use 1 casa decimal.",
    "Mantenha respostas curtas (até ~6 frases) salvo se o usuário pedir detalhe.",
    "",
    "IMPORTANTE — Envio para WhatsApp:",
    "Sempre que sua resposta citar um criativo ESPECÍFICO (por nome, link https://fb.me/... ou identificador), adicione no FINAL da resposta uma linha por criativo no formato exato:",
    "[📲 Enviar este criativo para meu WhatsApp](send-whatsapp:IDENTIFICADOR_DO_CRIATIVO)",
    "Substitua IDENTIFICADOR_DO_CRIATIVO pelo nome ou URL exato do criativo (sem espaços, use o valor que aparece nos dados). Não inclua esse botão quando a resposta for genérica e não citar um criativo específico. Não explique o botão — apenas insira-o.",
    "",
    `Cliente: ${ctx.clientName || "—"}`,
    `Período filtrado: ${ctx.period?.since} a ${ctx.period?.until}`,
    "",
    "KPIs do período:",
    `- Investimento: R$ ${fmt(k.investimento)}`,
    `- Leads: ${fmt(k.leads)} (CPL R$ ${fmt(k.cpl)})`,
    `- Simulações: ${fmt(k.simulacoes)}`,
    `- CPF Aprovado: ${fmt(k.cpfAprovado)}`,
    `- Vendas Financiamento: ${fmt(k.vendasFinanciamento)}`,
    `- Vendas Consórcio: ${fmt(k.vendasConsorcio)}`,
    `- Vendas totais: ${fmt(totalSales)}`,
  ];

  if (ctx.previous) {
    const p = ctx.previous;
    const prevTotal = (p.vendasFinanciamento || 0) + (p.vendasConsorcio || 0);
    lines.push("");
    lines.push("Período anterior (mesma duração):");
    lines.push(`- Leads: ${fmt(p.leads)} | CPL R$ ${fmt(p.cpl)}`);
    lines.push(`- CPF Aprovado: ${fmt(p.cpfAprovado)}`);
    lines.push(`- Vendas totais: ${fmt(prevTotal)}`);
  }

  if (ctx.topCreatives?.length) {
    lines.push("");
    lines.push("Top criativos (CPF aprovado):");
    ctx.topCreatives.slice(0, 8).forEach((c, i) => {
      lines.push(`  ${i + 1}. ${c.name} — ${c.count} (${c.pct.toFixed(1)}%)`);
    });
  }
  if (ctx.risingCreatives?.length) {
    lines.push("");
    lines.push("Criativos em alta (7d vs 7d):");
    ctx.risingCreatives.forEach((c) => lines.push(`  - ${c.name}: +${c.pctChange.toFixed(0)}%`));
  }
  if (ctx.fallingCreatives?.length) {
    lines.push("");
    lines.push("Criativos em queda (7d vs 7d):");
    ctx.fallingCreatives.forEach((c) => lines.push(`  - ${c.name}: ${c.pctChange.toFixed(0)}%`));
  }
  if (ctx.topSellers?.length) {
    lines.push("");
    lines.push("Top vendedores:");
    ctx.topSellers.slice(0, 8).forEach((s, i) => lines.push(`  ${i + 1}. ${s.name} — ${s.count}`));
  }
  if (ctx.monthlyTrend?.length) {
    lines.push("");
    lines.push("Tendência mensal:");
    ctx.monthlyTrend.forEach((m) =>
      lines.push(`  ${m.month}: ${m.leads} leads / ${m.cpf} CPF / ${m.sales} vendas`)
    );
  }
  if (ctx.evolutionDaily?.length) {
    // Limita a últimas 30 entradas pra não estourar contexto
    const slice = ctx.evolutionDaily.slice(-30);
    lines.push("");
    lines.push("Evolução diária (últimos dias):");
    slice.forEach((d) =>
      lines.push(`  ${d.date}: ${d.leads}L / ${d.cpf} CPF / ${d.sales} V / R$${fmt(d.spent)}`)
    );
  }

  return lines.join("\n");
}

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

    const body = (await req.json()) as ChatRequest;
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: "system", content: buildSystem(body.context || ({} as any)) },
          ...body.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso excedido. Tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha no chat" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-dashboard error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
