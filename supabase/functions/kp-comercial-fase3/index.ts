// KP Comercial — Fase 3
// 1) Funil completo por estágio (agregado + por pipeline)
// 2) Histórico/tendência semanal (MQLs, vendas, faturamento, investimento, CAC, ROAS)
// 3) Follow-ups & leads parados (MQLs sem agend., propostas paradas, opps estagnadas)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const GHL_BASE = "https://services.leadconnectorhq.com";
const META_BASE = "https://graph.facebook.com/v21.0";
const KP_META_ACCOUNT_ID = "507006368954918";
const KP_META_TOKEN_NAME = "Token de Will";

const isoDate = (d: string | undefined, fb: Date) => {
  if (!d) return fb;
  const p = new Date(d);
  return isNaN(p.getTime()) ? fb : p;
};
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const fmtMD = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const day = x.getDay() || 7;
  x.setDate(x.getDate() - day + 1);
  x.setHours(0, 0, 0, 0);
  return x;
};

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
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const since = isoDate(body.since, firstOfMonth);
    const until = isoDate(body.until, today);
    until.setHours(23, 59, 59, 999);
    const sinceMs = since.getTime();
    const untilMs = until.getTime();
    const nowMs = Date.now();

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    };

    // ---------- CONTACTS ----------
    let allContacts: any[] = [];
    {
      let page = 1;
      for (let i = 0; i < 5; i++) {
        const r = await fetch(`${GHL_BASE}/contacts/?locationId=${locationId}&limit=100&page=${page}`, { headers });
        if (!r.ok) break;
        const j = await r.json();
        const batch = j.contacts || [];
        allContacts = allContacts.concat(batch);
        if (batch.length < 100) break;
        page++;
      }
    }
    const inRange = (s?: string) => {
      if (!s) return false;
      const t = new Date(s).getTime();
      return !isNaN(t) && t >= sinceMs && t <= untilMs;
    };

    // ---------- CALENDARS + APPTS ----------
    const calRes = await fetch(`${GHL_BASE}/calendars/?locationId=${locationId}`, { headers });
    const calendars = (calRes.ok ? (await calRes.json()).calendars : []) || [];
    const allAppts: any[] = [];
    for (const c of calendars) {
      const params = new URLSearchParams({
        locationId, calendarId: c.id,
        startTime: String(sinceMs), endTime: String(untilMs),
      });
      const r = await fetch(`${GHL_BASE}/calendars/events?${params}`, { headers });
      if (!r.ok) continue;
      const j = await r.json();
      for (const e of (j.events || [])) allAppts.push(e);
    }
    const apptByContact = new Map<string, any>();
    for (const a of allAppts) if (a.contactId) apptByContact.set(a.contactId, a);

    // ---------- PIPELINES + OPPORTUNITIES ----------
    const pipRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
    const pipelines = (pipRes.ok ? (await pipRes.json()).pipelines : []) || [];

    interface PipelineFunnel {
      id: string; name: string;
      stages: { id: string; name: string; count: number; value: number }[];
      won: number; lost: number; openValue: number;
    }
    const pipelineFunnels: PipelineFunnel[] = [];
    const allOpps: any[] = [];

    for (const p of pipelines) {
      const stages = (p.stages || []).map((s: any) => ({
        id: s.id, name: s.name, count: 0, value: 0,
      }));
      const stageById = new Map(stages.map((s: any) => [s.id, s]));
      let won = 0, lost = 0, openValue = 0;

      let oppPage = 1;
      for (let i = 0; i < 5; i++) {
        const params = new URLSearchParams({
          location_id: locationId, pipeline_id: p.id,
          limit: "100", page: String(oppPage),
          date: fmtMD(since), endDate: fmtMD(until),
        });
        const r = await fetch(`${GHL_BASE}/opportunities/search?${params}`, { headers });
        if (!r.ok) break;
        const j = await r.json();
        const opps = j.opportunities || [];
        for (const o of opps) {
          allOpps.push({ ...o, _pipelineId: p.id, _pipelineName: p.name });
          const st = stageById.get(o.pipelineStageId) as any;
          if (st) { st.count++; st.value += Number(o.monetaryValue || 0); }
          const status = (o.status || "").toLowerCase();
          if (status === "won") won++;
          else if (status === "lost") lost++;
          else openValue += Number(o.monetaryValue || 0);
        }
        if (opps.length < 100) break;
        oppPage++;
      }
      pipelineFunnels.push({ id: p.id, name: p.name, stages, won, lost, openValue });
    }

    // ---------- AGGREGATE FUNNEL ----------
    const leadsTotais = allContacts.filter((c) => inRange(c.dateAdded)).length;
    const mqlContacts = allContacts.filter((c) => {
      if (!inRange(c.dateAdded)) return false;
      return (c.tags || []).some((t: string) => String(t).toLowerCase().includes("mql"));
    });
    const mqls = mqlContacts.length;
    let agendados = 0, realizados = 0;
    for (const c of mqlContacts) {
      const a = apptByContact.get(c.id);
      if (!a) continue;
      agendados++;
      const st = (a.appointmentStatus || a.status || "").toLowerCase();
      if (st.includes("show") && !st.includes("no")) realizados++;
    }
    let propostas = 0, vendas = 0, faturamento = 0;
    for (const p of pipelines) {
      const proposalIds = new Set(
        (p.stages || []).filter((s: any) => /proposta|proposal/i.test(s.name || "")).map((s: any) => s.id)
      );
      for (const o of allOpps.filter((x) => x._pipelineId === p.id)) {
        if (proposalIds.has(o.pipelineStageId)) propostas++;
        if ((o.status || "").toLowerCase() === "won") {
          vendas++;
          faturamento += Number(o.monetaryValue || 0);
        }
      }
    }
    const aggregateFunnel = [
      { stage: "Leads totais", count: leadsTotais },
      { stage: "MQLs", count: mqls },
      { stage: "Agendados", count: agendados },
      { stage: "Realizados", count: realizados },
      { stage: "Propostas", count: propostas },
      { stage: "Vendas", count: vendas },
    ];

    // ---------- META SPEND DAILY ----------
    const dailySpend = new Map<string, number>();
    let metaError: string | null = null;
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: tk } = await supabase.from("meta_tokens")
        .select("token").eq("name", KP_META_TOKEN_NAME).maybeSingle();
      const metaToken = tk?.token;
      if (!metaToken) metaError = `Token "${KP_META_TOKEN_NAME}" não encontrado`;
      else {
        const tr = `&time_range=${encodeURIComponent(JSON.stringify({ since: ymd(since), until: ymd(until) }))}`;
        let url: string | null =
          `${META_BASE}/act_${KP_META_ACCOUNT_ID}/insights?fields=spend,date_start&level=account&time_increment=1${tr}&access_token=${metaToken}&limit=500`;
        let pages = 0;
        while (url && pages < 10) {
          const r: Response = await fetch(url);
          const j = await r.json();
          if (j.error) { metaError = j.error.message; break; }
          for (const it of (j.data || [])) dailySpend.set(it.date_start, parseFloat(it.spend || "0"));
          url = j.paging?.next || null;
          pages++;
        }
      }
    } catch (e: any) { metaError = e.message || String(e); }

    // ---------- WEEKLY TREND ----------
    interface Bucket {
      weekStart: string; mqls: number; vendas: number; faturamento: number;
      investimento: number; cac: number; roas: number;
    }
    const buckets = new Map<string, Bucket>();
    const weekKey = (d: Date) => ymd(startOfWeek(d));
    // seed weeks
    const cursor = startOfWeek(since);
    while (cursor.getTime() <= untilMs) {
      const k = ymd(cursor);
      buckets.set(k, { weekStart: k, mqls: 0, vendas: 0, faturamento: 0, investimento: 0, cac: 0, roas: 0 });
      cursor.setDate(cursor.getDate() + 7);
    }
    for (const c of mqlContacts) {
      const k = weekKey(new Date(c.dateAdded));
      const b = buckets.get(k); if (b) b.mqls++;
    }
    for (const o of allOpps) {
      if ((o.status || "").toLowerCase() !== "won") continue;
      const ref = o.updatedAt || o.createdAt || o.dateAdded;
      if (!ref) continue;
      const k = weekKey(new Date(ref));
      const b = buckets.get(k);
      if (b) { b.vendas++; b.faturamento += Number(o.monetaryValue || 0); }
    }
    for (const [day, spend] of dailySpend) {
      const k = weekKey(new Date(day + "T12:00:00"));
      const b = buckets.get(k); if (b) b.investimento += spend;
    }
    const trend = Array.from(buckets.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    for (const b of trend) {
      b.cac = b.vendas > 0 ? b.investimento / b.vendas : 0;
      b.roas = b.investimento > 0 ? b.faturamento / b.investimento : 0;
    }

    // ---------- FOLLOW-UPS ----------
    const SEM_AGEND_DAYS = 3;
    const PROPOSTA_PARADA_DAYS = 7;
    const OPP_ESTAGNADA_DAYS = 14;
    const daysAgo = (s: string) => Math.floor((nowMs - new Date(s).getTime()) / 86400000);

    const mqlsSemAgendamento = mqlContacts
      .filter((c) => !apptByContact.get(c.id))
      .filter((c) => c.dateAdded && daysAgo(c.dateAdded) >= SEM_AGEND_DAYS)
      .map((c) => ({
        id: c.id,
        nome: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.contactName || "—",
        email: c.email, phone: c.phone,
        diasParado: daysAgo(c.dateAdded),
        dateAdded: c.dateAdded,
      }))
      .sort((a, b) => b.diasParado - a.diasParado);

    const proposalStageIdsAll = new Set<string>();
    for (const p of pipelines) {
      for (const s of (p.stages || [])) {
        if (/proposta|proposal/i.test(s.name || "")) proposalStageIdsAll.add(s.id);
      }
    }
    const propostasParadas = allOpps
      .filter((o) => proposalStageIdsAll.has(o.pipelineStageId))
      .filter((o) => !["won", "lost"].includes((o.status || "").toLowerCase()))
      .map((o) => {
        const ref = o.updatedAt || o.createdAt || o.dateAdded || new Date().toISOString();
        return {
          id: o.id, nome: o.name || o.contactName || "—",
          pipeline: o._pipelineName, valor: Number(o.monetaryValue || 0),
          diasParado: daysAgo(ref), updatedAt: ref,
        };
      })
      .filter((o) => o.diasParado >= PROPOSTA_PARADA_DAYS)
      .sort((a, b) => b.diasParado - a.diasParado);

    const opsEstagnadas = allOpps
      .filter((o) => !["won", "lost"].includes((o.status || "").toLowerCase()))
      .filter((o) => !proposalStageIdsAll.has(o.pipelineStageId))
      .map((o) => {
        const ref = o.updatedAt || o.createdAt || o.dateAdded || new Date().toISOString();
        const stage = pipelines
          .find((p: any) => p.id === o._pipelineId)
          ?.stages?.find((s: any) => s.id === o.pipelineStageId)?.name || "—";
        return {
          id: o.id, nome: o.name || o.contactName || "—",
          pipeline: o._pipelineName, stage,
          valor: Number(o.monetaryValue || 0),
          diasParado: daysAgo(ref), updatedAt: ref,
        };
      })
      .filter((o) => o.diasParado >= OPP_ESTAGNADA_DAYS)
      .sort((a, b) => b.diasParado - a.diasParado);

    return new Response(JSON.stringify({
      period: { since: since.toISOString(), until: until.toISOString() },
      aggregateFunnel,
      pipelineFunnels,
      trend,
      followUps: {
        mqlsSemAgendamento: mqlsSemAgendamento.slice(0, 200),
        propostasParadas: propostasParadas.slice(0, 200),
        opsEstagnadas: opsEstagnadas.slice(0, 200),
        thresholds: {
          semAgendDias: SEM_AGEND_DAYS,
          propostaParadaDias: PROPOSTA_PARADA_DAYS,
          oppEstagnadaDias: OPP_ESTAGNADA_DAYS,
        },
      },
      metaError,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("kp-comercial-fase3 error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
