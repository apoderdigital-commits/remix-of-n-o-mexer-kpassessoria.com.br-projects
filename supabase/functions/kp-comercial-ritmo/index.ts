// KP Comercial — Ritmo do mês
//
// Números do MÊS INTEIRO, independentes do filtro de datas da tela: o painel
// compara "quanto deveria estar até hoje" com "quanto está", e isso só fecha
// se o realizado for do mês todo.
//
// Regras (definidas pela operação):
//   leads   = contatos CRIADOS no mês com tag lead a/b/c/d
//   mqls    = contatos CRIADOS no mês com tag lead a/b
//   reunioes= reuniões COMPARECIDAS cujo contato é MQL
//   vendas  = oportunidades na pipeline do closer, etapa "Venda"
//   faturamento = soma do valor dessas oportunidades
//
// Leads e MQLs saem de CONTATO + TAG, nunca de oportunidade: se a automação
// falhar em criar a oportunidade, o lead existe do mesmo jeito.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GHL_BASE = "https://services.leadconnectorhq.com";

/** "Lead A", "lead-a", "LEAD  B" -> "a" / "b". Qualquer outra coisa -> null. */
function classeDaTag(tag: string): "a" | "b" | "c" | "d" | null {
  const t = String(tag || "").toLowerCase().trim();
  const m = t.match(/^lead\s*[-–:_]?\s*([abcd])$/);
  return m ? (m[1] as "a" | "b" | "c" | "d") : null;
}

function classesDoContato(c: any): Set<string> {
  const out = new Set<string>();
  for (const t of c?.tags || []) {
    const cl = classeDaTag(t);
    if (cl) out.add(cl);
  }
  return out;
}

const fmtMD = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("KP_GHL_API_KEY");
    const locationId = Deno.env.get("KP_GHL_LOCATION_ID");
    if (!apiKey || !locationId) {
      return new Response(JSON.stringify({ error: "GHL não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    // competencia = primeiro dia do mês (YYYY-MM-DD). Sem ela, mês corrente.
    const base = body.competencia ? new Date(`${String(body.competencia).slice(0, 7)}-01T00:00:00`) : new Date();
    const since = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
    const until = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    const sinceMs = since.getTime();
    const untilMs = until.getTime();

    // Nome da pipeline de vendas e da etapa. Configuráveis para não travar em
    // "Júlio" caso o closer mude.
    const pipelineAlvo = String(body.pipeline || "julio").toLowerCase();
    const etapaAlvo = String(body.etapa || "venda").toLowerCase();

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    };

    const noPeriodo = (s?: string) => {
      if (!s) return false;
      const t = new Date(s).getTime();
      return !isNaN(t) && t >= sinceMs && t <= untilMs;
    };

    // ── 1) CONTATOS: leads e MQLs ────────────────────────────────────────────
    let contatos: any[] = [];
    for (let page = 1; page <= 30; page++) {
      const r = await fetch(
        `${GHL_BASE}/contacts/?locationId=${locationId}&limit=100&page=${page}`,
        { headers },
      );
      if (!r.ok) break;
      const j = await r.json();
      const lote = j.contacts || [];
      contatos = contatos.concat(lote);
      if (lote.length < 100) break;
    }

    const doMes = contatos.filter((c) => noPeriodo(c.dateAdded));
    const porClasse: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    const idsMql = new Set<string>();
    let leads = 0;

    for (const c of doMes) {
      const cls = classesDoContato(c);
      if (cls.size === 0) continue;
      leads++;
      for (const k of cls) porClasse[k]++;
      if (cls.has("a") || cls.has("b")) idsMql.add(c.id);
    }
    const mqls = idsMql.size;

    // ── 2) REUNIÕES COMPARECIDAS DE MQL ──────────────────────────────────────
    const calRes = await fetch(`${GHL_BASE}/calendars/?locationId=${locationId}`, { headers });
    const calendars = calRes.ok ? ((await calRes.json()).calendars || []) : [];

    let reunioes = 0;
    let comparecimentosTotais = 0;
    for (const cal of calendars) {
      const params = new URLSearchParams({
        locationId,
        calendarId: cal.id,
        startTime: since.toISOString(),
        endTime: until.toISOString(),
      });
      const r = await fetch(`${GHL_BASE}/calendars/events?${params}`, { headers });
      if (!r.ok) continue;
      const eventos = (await r.json()).events || [];
      for (const e of eventos) {
        const st = String(e.appointmentStatus || e.status || "").toLowerCase();
        // "showed" conta; "noshow" não. O !includes("no") evita casar no-show.
        const compareceu = st.includes("show") && !st.includes("no");
        if (!compareceu) continue;
        comparecimentosTotais++;
        if (e.contactId && idsMql.has(e.contactId)) reunioes++;
      }
    }

    // ── 3) VENDAS E FATURAMENTO (pipeline do closer, etapa Venda) ────────────
    const pipRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
    const pipelines = pipRes.ok ? ((await pipRes.json()).pipelines || []) : [];

    const pipeline = pipelines.find((p: any) =>
      String(p.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(pipelineAlvo),
    );

    let vendas = 0;
    let faturamento = 0;
    const vendasDetalhe: any[] = [];
    let etapaNome: string | null = null;

    if (pipeline) {
      const etapa = (pipeline.stages || []).find((s: any) =>
        String(s.name || "").toLowerCase().includes(etapaAlvo),
      );
      etapaNome = etapa?.name ?? null;

      if (etapa) {
        for (let page = 1; page <= 20; page++) {
          const params = new URLSearchParams({
            location_id: locationId,
            pipeline_id: pipeline.id,
            pipeline_stage_id: etapa.id,
            limit: "100",
            page: String(page),
            date: fmtMD(since),
            endDate: fmtMD(until),
          });
          const r = await fetch(`${GHL_BASE}/opportunities/search?${params}`, { headers });
          if (!r.ok) break;
          const opps = (await r.json()).opportunities || [];
          for (const o of opps) {
            vendas++;
            const valor = Number(o.monetaryValue) || 0;
            faturamento += valor;
            vendasDetalhe.push({
              id: o.id,
              nome: o.name || o.contact?.name || "—",
              contatoId: o.contactId ?? o.contact?.id ?? null,
              valor,
              status: o.status ?? null,
            });
          }
          if (opps.length < 100) break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        competencia: since.toISOString().slice(0, 10),
        periodo: { since: since.toISOString(), until: until.toISOString() },
        // o que o painel usa
        leads, mqls, reunioes, vendas, faturamento,
        // conferência: ajuda a descobrir tag escrita errada ou pipeline não achada
        diagnostico: {
          contatosLidos: contatos.length,
          contatosCriadosNoMes: doMes.length,
          porClasse,
          comparecimentosTotais,
          pipelineEncontrada: pipeline?.name ?? null,
          etapaEncontrada: etapaNome,
          pipelinesDisponiveis: pipelines.map((p: any) => p.name),
          vendasDetalhe,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
