// KP Comercial — Snapshot unificado (KPIs + Fase 2 + Fase 3)
// Modos:
//   POST { mode: "read", since?, until? }    → retorna snapshot mais recente do período (do DB)
//   POST { mode: "refresh", since?, until? } → busca tudo do GHL/Meta, grava snapshot, retorna
//   POST { mode: "auto", since?, until?, maxAgeMinutes? } → lê do DB se fresco, senão refresca

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
const classifyPipelineByName = (name: string): "A" | "B" | "C" | "Outro" => {
  const n = (name || "").toLowerCase();
  if (/\b(a|cliente.?a|classe.?a|premium)\b/.test(n)) return "A";
  if (/\b(b|cliente.?b|classe.?b)\b/.test(n)) return "B";
  if (/\b(c|cliente.?c|classe.?c)\b/.test(n)) return "C";
  return "Outro";
};

const sb = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function buildSnapshot(since: Date, until: Date) {
  const apiKey = Deno.env.get("KP_GHL_API_KEY")!;
  const locationId = Deno.env.get("KP_GHL_LOCATION_ID")!;
  const sinceMs = since.getTime();
  const untilMs = until.getTime();
  const nowMs = Date.now();
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
  const inRange = (s?: string) => {
    if (!s) return false;
    const t = new Date(s).getTime();
    return !isNaN(t) && t >= sinceMs && t <= untilMs;
  };

  // ---------- USERS ----------
  const usersRes = await fetch(`${GHL_BASE}/users/?locationId=${locationId}`, { headers });
  const users = ((usersRes.ok ? (await usersRes.json()).users : []) || []).map((u: any) => ({
    id: u.id,
    name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
    email: u.email,
  }));

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

  // ---------- CALENDARS + APPTS ----------
  const calRes = await fetch(`${GHL_BASE}/calendars/?locationId=${locationId}`, { headers });
  const calendars = ((calRes.ok ? (await calRes.json()).calendars : []) || []);
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

  // ---------- PIPELINES + OPPS ----------
  const pipRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
  const pipelines = ((pipRes.ok ? (await pipRes.json()).pipelines : []) || []);

  interface PipelineFunnel {
    id: string; name: string; classe: string;
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
    pipelineFunnels.push({
      id: p.id, name: p.name, classe: classifyPipeline(p.name),
      stages, won, lost, openValue,
    });
  }

  // ---------- KPIS DO TOPO ----------
  const leadsTotais = allContacts.filter((c) => inRange(c.dateAdded)).length;
  const mqlContacts = allContacts.filter((c) =>
    inRange(c.dateAdded) && (c.tags || []).some((t: string) => String(t).toLowerCase().includes("mql"))
  );
  const mqls = mqlContacts.length;
  let agendados = 0, realizados = 0;
  for (const c of mqlContacts) {
    const a = apptByContact.get(c.id);
    if (!a) continue;
    agendados++;
    const st = (a.appointmentStatus || a.status || "").toLowerCase();
    if (st.includes("show") && !st.includes("no")) realizados++;
  }
  const proposalStageIdsAll = new Set<string>();
  for (const p of pipelines) {
    for (const s of (p.stages || [])) {
      if (/proposta|proposal/i.test(s.name || "")) proposalStageIdsAll.add(s.id);
    }
  }
  let propostas = 0, vendas = 0, faturamento = 0, totalOpps = allOpps.length;
  for (const o of allOpps) {
    if (proposalStageIdsAll.has(o.pipelineStageId)) propostas++;
    if ((o.status || "").toLowerCase() === "won") {
      vendas++;
      faturamento += Number(o.monetaryValue || 0);
    }
  }

  // ---------- META SPEND DIÁRIO ----------
  const dailySpend = new Map<string, number>();
  let investimento = 0;
  let metaError: string | null = null;
  try {
    const supabase = sb();
    const { data: tk } = await supabase.from("meta_tokens")
      .select("token").eq("name", KP_META_TOKEN_NAME).maybeSingle();
    const metaToken = (tk as any)?.token;
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
        for (const it of (j.data || [])) {
          const v = parseFloat(it.spend || "0");
          dailySpend.set(it.date_start, v);
          investimento += v;
        }
        url = j.paging?.next || null;
        pages++;
      }
    }
  } catch (e: any) { metaError = e.message || String(e); }

  const ticketMedio = vendas > 0 ? faturamento / vendas : 0;
  const taxaAtivacaoMql = leadsTotais > 0 ? (mqls / leadsTotais) * 100 : 0;
  const winRate = totalOpps > 0 ? (vendas / totalOpps) * 100 : 0;
  const cac = vendas > 0 ? investimento / vendas : 0;
  const roas = investimento > 0 ? faturamento / investimento : 0;

  const kpis = {
    leadsTotais, mqls, taxaAtivacaoMql,
    vendas, faturamento, ticketMedio, winRate,
    totalOportunidades: totalOpps,
    investimento, cac, roas, metaError,
  };

  // ---------- CLASSIFICAÇÃO DE CONTATOS (MQL / A / B / C / Outro) ----------
  const contactById = new Map<string, any>();
  for (const c of allContacts) contactById.set(c.id, c);
  const pipelineClasseById = new Map<string, string>();
  for (const pf of pipelineFunnels) pipelineClasseById.set(pf.id, pf.classe);
  const contactClasses = new Map<string, Set<string>>();
  for (const o of allOpps) {
    if (!o.contactId) continue;
    const cls = pipelineClasseById.get(o._pipelineId) || "Outro";
    if (!contactClasses.has(o.contactId)) contactClasses.set(o.contactId, new Set());
    contactClasses.get(o.contactId)!.add(cls);
  }
  const isMql = (c: any) => !!(c?.tags || []).some((t: string) => String(t).toLowerCase().includes("mql"));
  const classifyContact = (contactId: string): "MQL" | "A" | "B" | "C" | "Outro" => {
    const c = contactById.get(contactId);
    if (c && isMql(c)) return "MQL";
    const classes = contactClasses.get(contactId);
    if (classes?.has("A")) return "A";
    if (classes?.has("B")) return "B";
    if (classes?.has("C")) return "C";
    return "Outro";
  };

  // ---------- SDR BREAKDOWN + APPOINTMENT LISTS ----------
  const sdrMap = new Map<string, any>();
  const initSdr = (uid: string) => {
    if (!sdrMap.has(uid)) {
      const u = users.find((x: any) => x.id === uid) || { id: uid, name: "Desconhecido" };
      sdrMap.set(uid, {
        user: u,
        agendados: 0, realizados: 0, noshow: 0, cancelados: 0,
        lists: {
          agendado: [] as any[],
          realizado: [] as any[],
          noshow: [] as any[],
          cancelado: [] as any[],
        },
      });
    }
    return sdrMap.get(uid)!;
  };
  const noShowByHour: Record<string, number> = {};
  for (const a of allAppts) {
    const uid = a.assignedUserId || a.userId;
    if (!uid) continue;
    const s = initSdr(uid);
    s.agendados++;
    const st = (a.appointmentStatus || a.status || "").toLowerCase();
    const contact = a.contactId ? contactById.get(a.contactId) : null;
    const category = a.contactId ? classifyContact(a.contactId) : "Outro";
    const entry = {
      contactId: a.contactId || null,
      nome: contact
        ? (`${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.contactName || contact.email || "—")
        : (a.title || "Sem contato"),
      email: contact?.email,
      phone: contact?.phone,
      startTime: a.startTime,
      category,
    };
    let bucket: "agendado" | "realizado" | "noshow" | "cancelado" = "agendado";
    if (st.includes("show") && !st.includes("no")) { s.realizados++; bucket = "realizado"; }
    else if (st.includes("noshow") || st === "no-show" || st === "no_show") {
      s.noshow++; bucket = "noshow";
      if (a.startTime) {
        const h = new Date(a.startTime).getHours();
        const key = `${String(h).padStart(2, "0")}:00`;
        noShowByHour[key] = (noShowByHour[key] || 0) + 1;
      }
    } else if (st.includes("cancel")) { s.cancelados++; bucket = "cancelado"; }
    s.lists[bucket].push(entry);
  }
  const sdrs = Array.from(sdrMap.values()).sort((a, b) => b.agendados - a.agendados);

  // ---------- MQLs LIST ----------
  const mqlsList = mqlContacts.map((c) => {
    const appt = apptByContact.get(c.id);
    const apptStatus = (appt?.appointmentStatus || appt?.status || "").toLowerCase();
    let situacao: "agendado" | "realizado" | "noshow" | "sem_agendamento" = "sem_agendamento";
    if (appt) {
      if (apptStatus.includes("noshow")) situacao = "noshow";
      else if (apptStatus.includes("show")) situacao = "realizado";
      else situacao = "agendado";
    }
    return {
      id: c.id,
      nome: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.contactName || "—",
      email: c.email, phone: c.phone,
      dateAdded: c.dateAdded, situacao,
      horario: appt?.startTime,
    };
  }).sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""));

  const mqlSummary = {
    total: mqlsList.length,
    agendados: mqlsList.filter((m) => m.situacao !== "sem_agendamento").length,
    naoAgendados: mqlsList.filter((m) => m.situacao === "sem_agendamento").length,
    realizados: mqlsList.filter((m) => m.situacao === "realizado").length,
    noshow: mqlsList.filter((m) => m.situacao === "noshow").length,
  };

  // ---------- CLASSES A/B/C ----------
  const classes: Record<string, any> = {
    A: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
    B: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
    C: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
    Outro: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
  };
  for (const pf of pipelineFunnels) {
    classes[pf.classe].pipelines.push(pf.name);
    for (const o of allOpps.filter((x) => x._pipelineId === pf.id)) {
      if (proposalStageIdsAll.has(o.pipelineStageId)) classes[pf.classe].propostas++;
      if ((o.status || "").toLowerCase() === "won") {
        classes[pf.classe].vendas++;
        classes[pf.classe].faturamento += Number(o.monetaryValue || 0);
      }
    }
  }

  // ---------- AGGREGATE FUNNEL ----------
  const aggregateFunnel = [
    { stage: "Leads totais", count: leadsTotais },
    { stage: "MQLs", count: mqls },
    { stage: "Agendados", count: agendados },
    { stage: "Realizados", count: realizados },
    { stage: "Propostas", count: propostas },
    { stage: "Vendas", count: vendas },
  ];

  // ---------- WEEKLY TREND ----------
  const buckets = new Map<string, any>();
  const weekKey = (d: Date) => ymd(startOfWeek(d));
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
    const b = buckets.get(weekKey(new Date(ref)));
    if (b) { b.vendas++; b.faturamento += Number(o.monetaryValue || 0); }
  }
  for (const [day, spend] of dailySpend) {
    const b = buckets.get(weekKey(new Date(day + "T12:00:00")));
    if (b) b.investimento += spend;
  }
  const trend = Array.from(buckets.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  for (const b of trend) {
    b.cac = b.vendas > 0 ? b.investimento / b.vendas : 0;
    b.roas = b.investimento > 0 ? b.faturamento / b.investimento : 0;
  }

  // ---------- FOLLOW-UPS ----------
  const SEM_AGEND = 3, PROP_PARADA = 7, OPP_ESTAG = 14;
  const daysAgo = (s: string) => Math.floor((nowMs - new Date(s).getTime()) / 86400000);

  const mqlsSemAgendamento = mqlContacts
    .filter((c) => !apptByContact.get(c.id))
    .filter((c) => c.dateAdded && daysAgo(c.dateAdded) >= SEM_AGEND)
    .map((c) => ({
      id: c.id,
      nome: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.contactName || "—",
      email: c.email, phone: c.phone,
      diasParado: daysAgo(c.dateAdded), dateAdded: c.dateAdded,
    }))
    .sort((a, b) => b.diasParado - a.diasParado);

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
    .filter((o) => o.diasParado >= PROP_PARADA)
    .sort((a, b) => b.diasParado - a.diasParado);

  const opsEstagnadas = allOpps
    .filter((o) => !["won", "lost"].includes((o.status || "").toLowerCase()))
    .filter((o) => !proposalStageIdsAll.has(o.pipelineStageId))
    .map((o) => {
      const ref = o.updatedAt || o.createdAt || o.dateAdded || new Date().toISOString();
      const stage = pipelines.find((p: any) => p.id === o._pipelineId)
        ?.stages?.find((s: any) => s.id === o.pipelineStageId)?.name || "—";
      return {
        id: o.id, nome: o.name || o.contactName || "—",
        pipeline: o._pipelineName, stage,
        valor: Number(o.monetaryValue || 0),
        diasParado: daysAgo(ref), updatedAt: ref,
      };
    })
    .filter((o) => o.diasParado >= OPP_ESTAG)
    .sort((a, b) => b.diasParado - a.diasParado);

  return {
    period: { since: since.toISOString(), until: until.toISOString() },
    kpis,
    users,
    sdrs,
    noShowByHour,
    mqlSummary,
    mqlsList: mqlsList.slice(0, 500),
    classes,
    aggregateFunnel,
    pipelineFunnels,
    trend,
    followUps: {
      mqlsSemAgendamento: mqlsSemAgendamento.slice(0, 200),
      propostasParadas: propostasParadas.slice(0, 200),
      opsEstagnadas: opsEstagnadas.slice(0, 200),
      thresholds: { semAgendDias: SEM_AGEND, propostaParadaDias: PROP_PARADA, oppEstagnadaDias: OPP_ESTAG },
    },
    counters: {
      totalUsers: users.length,
      totalCalendars: calendars.length,
      totalContacts: allContacts.length,
      totalPipelines: pipelines.length,
      totalOpps: allOpps.length,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "auto";
    const maxAgeMinutes = Number(body.maxAgeMinutes ?? 30);

    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const since = isoDate(body.since, firstOfMonth);
    const until = isoDate(body.until, today);
    until.setHours(23, 59, 59, 999);

    const supabase = sb();

    const readLatest = async () => {
      const { data } = await supabase
        .from("kp_comercial_snapshots")
        .select("*")
        .eq("block", "full")
        .gte("period_start", new Date(since.getTime() - 60_000).toISOString())
        .lte("period_start", new Date(since.getTime() + 60_000).toISOString())
        .gte("period_end", new Date(until.getTime() - 60_000).toISOString())
        .lte("period_end", new Date(until.getTime() + 60_000).toISOString())
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    };

    if (mode === "read") {
      const latest = await readLatest();
      return new Response(JSON.stringify({
        source: "cache",
        snapshot: latest,
        data: latest?.payload || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "auto") {
      const latest = await readLatest();
      if (latest) {
        const ageMs = Date.now() - new Date(latest.fetched_at).getTime();
        if (ageMs < maxAgeMinutes * 60_000) {
          return new Response(JSON.stringify({
            source: "cache",
            ageMinutes: Math.round(ageMs / 60_000),
            snapshot: latest,
            data: latest.payload,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // refresh
    const t0 = Date.now();
    let payload: any = null;
    let errMsg: string | null = null;
    try {
      payload = await buildSnapshot(since, until);
    } catch (e: any) {
      errMsg = e?.message || String(e);
    }
    const duration = Date.now() - t0;

    const { data: inserted } = await supabase
      .from("kp_comercial_snapshots")
      .insert({
        period_start: since.toISOString(),
        period_end: until.toISOString(),
        block: "full",
        payload: payload || {},
        duration_ms: duration,
        error: errMsg,
      })
      .select("*")
      .single();

    if (errMsg && !payload) {
      return new Response(JSON.stringify({ error: errMsg, snapshot: inserted }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      source: "fresh",
      snapshot: inserted,
      data: payload,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("kp-comercial-snapshot error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
