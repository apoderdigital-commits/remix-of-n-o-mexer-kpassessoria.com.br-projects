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
  const getAppointmentBucket = (appt: any): "agendado" | "realizado" | "noshow" | "cancelado" | "outro" => {
    const st = String(appt?.appointmentStatus || appt?.status || "").toLowerCase();
    if (st.includes("cancel") || st.includes("invalid")) return "cancelado";
    if (st.includes("noshow") || st === "no-show" || st === "no_show") return "noshow";
    if (st.includes("show") && !st.includes("no")) return "realizado";
    if (st.includes("confirm")) return "agendado";
    return "outro";
  };
  const getAppointmentTime = (appt: any) => {
    const t = new Date(appt?.startTime || appt?.endTime || appt?.updatedAt || appt?.createdAt || 0).getTime();
    return Number.isNaN(t) ? -1 : t;
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

  // Quais calendários estão habilitados na config (se nenhum, usa todos por compat)
  const supabaseAdminEarly = sb();
  const { data: enabledCalRows } = await supabaseAdminEarly
    .from("kp_comercial_calendars").select("ghl_calendar_id, enabled, name");
  const enabledSet = new Set<string>();
  const calendarMeta = new Map<string, { name: string; enabled: boolean }>();
  for (const r of (enabledCalRows || []) as any[]) {
    calendarMeta.set(r.ghl_calendar_id, { name: r.name || "", enabled: !!r.enabled });
    if (r.enabled) enabledSet.add(r.ghl_calendar_id);
  }
  const hasCalendarConfig = (enabledCalRows || []).length > 0;
  const calendarsToFetch = hasCalendarConfig
    ? calendars.filter((c: any) => enabledSet.has(c.id))
    : calendars;

  const allAppts: any[] = [];
  for (const c of calendarsToFetch) {
    const params = new URLSearchParams({
      locationId, calendarId: c.id,
      startTime: String(sinceMs), endTime: String(untilMs),
    });
    const r = await fetch(`${GHL_BASE}/calendars/events?${params}`, { headers });
    if (!r.ok) continue;
    const j = await r.json();
    for (const e of (j.events || [])) allAppts.push({ ...e, _calendarName: c.name });
  }
  const apptByContact = new Map<string, any>();
  for (const a of allAppts) {
    if (!a.contactId) continue;
    const prev = apptByContact.get(a.contactId);
    if (!prev || getAppointmentTime(a) >= getAppointmentTime(prev)) apptByContact.set(a.contactId, a);
  }


  // ---------- PIPELINES + OPPS ----------
  const pipRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
  const pipelines = ((pipRes.ok ? (await pipRes.json()).pipelines : []) || []);

  // Configs persistidas
  const supabaseAdmin = sb();
  const [{ data: pipeCfgRows }, { data: dsRow }] = await Promise.all([
    supabaseAdmin.from("kp_comercial_pipeline_config").select("*"),
    supabaseAdmin.from("kp_comercial_data_sources").select("*").eq("id", true).maybeSingle(),
  ]);
  const pipeCfg = new Map<string, any>();
  for (const r of (pipeCfgRows || []) as any[]) pipeCfg.set(r.pipeline_id, r);
  const classifyPipeline = (id: string, name: string): "A" | "B" | "C" | "Outro" => {
    const ov = pipeCfg.get(id)?.classe;
    if (ov === "A" || ov === "B" || ov === "C" || ov === "Outro") return ov;
    return classifyPipelineByName(name);
  };
  // Conjuntos de stages mapeadas (agregados de todos pipelines configurados)
  const mappedStages = {
    reuniao_marcada: new Set<string>(),
    comparecida: new Set<string>(),
    proposta_enviada: new Set<string>(),
    proposta_perdida: new Set<string>(),
    vendida: new Set<string>(),
    noshow: new Set<string>(),
  };
  for (const r of (pipeCfgRows || []) as any[]) {
    for (const s of (r.stages_reuniao_marcada || [])) mappedStages.reuniao_marcada.add(s);
    for (const s of (r.stages_comparecida || [])) mappedStages.comparecida.add(s);
    for (const s of (r.stages_proposta_enviada || [])) mappedStages.proposta_enviada.add(s);
    for (const s of (r.stages_proposta_perdida || [])) mappedStages.proposta_perdida.add(s);
    for (const s of (r.stages_vendida || [])) mappedStages.vendida.add(s);
    for (const s of (r.stages_noshow || [])) mappedStages.noshow.add(s);
  }
  const hasStageMappings = mappedStages.proposta_enviada.size + mappedStages.proposta_perdida.size + mappedStages.vendida.size > 0;

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
      id: p.id, name: p.name, classe: classifyPipeline(p.id, p.name), kind: pipeCfg.get(p.id)?.kind || null,
      stages, won, lost, openValue,
    });
  }

  // ---------- SHEET FETCH (leads/mqls via planilha quando configurado) ----------
  const ds = (dsRow as any) || { leads_source: "sheet", mqls_source: "sheet", sheet_id: "1esmBP_vybIjhh2aw7miaS-oZMp9pDeroAUhYFaiTs9c", sheet_tab: "Página4", sheet_mql_column: "MQL", sheet_mql_value: "SIM", opportunity_source_filter: "METAADS", opportunity_source_enabled: true, meetings_source: "pipeline" };

  // ---------- META OPP BY CONTACT (filtro por source da opp) ----------
  const sourceFilter = String(ds.opportunity_source_filter || "METAADS").trim().toUpperCase();
  const sourceEnabled = ds.opportunity_source_enabled !== false;
  // Reuniões marcadas/comparecidas/no-show vêm SEMPRE do calendário do GHL.
  // O valor salvo em ds.meetings_source é ignorado.
  const meetingsFromCalendar = true;
  const metaOppByContact = new Map<string, any>();
  const allSourcesSeen = new Map<string, number>();
  for (const o of allOpps) {
    const src = String(o.source || o.contact?.source || "").trim();
    if (src) allSourcesSeen.set(src, (allSourcesSeen.get(src) || 0) + 1);
    if (!o.contactId) continue;
    if (sourceEnabled && src.toUpperCase() !== sourceFilter) continue;
    const prev = metaOppByContact.get(o.contactId);
    const ts = new Date(o.updatedAt || o.createdAt || 0).getTime();
    const prevTs = prev ? new Date(prev.updatedAt || prev.createdAt || 0).getTime() : -1;
    if (!prev || ts > prevTs) metaOppByContact.set(o.contactId, o);
  }
  const topSources = Array.from(allSourcesSeen.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([source, count]) => ({ source, count }));

  let sheetLeads = 0, sheetMqls = 0, sheetError: string | null = null;
  let sheetRowsTotal = 0;
  try {
    if (ds.leads_source === "sheet" || ds.mqls_source === "sheet") {
      const url = `https://docs.google.com/spreadsheets/d/${ds.sheet_id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(ds.sheet_tab)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Sheet HTTP ${r.status}`);
      const txt = await r.text();
      // CSV parser simples (handles quoted)
      const parseLine = (line: string) => {
        const out: string[] = []; let cur = ""; let q = false;
        for (const ch of line) {
          if (ch === '"') q = !q;
          else if (ch === "," && !q) { out.push(cur); cur = ""; }
          else cur += ch;
        }
        out.push(cur);
        return out.map((c) => c.trim());
      };
      const lines = txt.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length >= 2) {
        const header = parseLine(lines[0]).map((h) => h.toUpperCase().trim());
        const mqlCol = header.findIndex((h) => h === String(ds.sheet_mql_column).toUpperCase());
        const dateCol = header.findIndex((h) => h === "DATA" || h === "DATE");
        const wanted = String(ds.sheet_mql_value).toUpperCase().trim();
        const parseSheetDate = (s: string): number | null => {
          if (!s) return null;
          const v = s.trim();
          const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
          if (m) {
            const d = +m[1], mo = +m[2] - 1;
            let y = +m[3]; if (y < 100) y += 2000;
            const t = new Date(y, mo, d).getTime();
            return isNaN(t) ? null : t;
          }
          const t = new Date(v).getTime();
          return isNaN(t) ? null : t;
        };
        sheetRowsTotal = lines.length - 1;
        for (let i = 1; i < lines.length; i++) {
          const cols = parseLine(lines[i]);
          if (dateCol >= 0) {
            const t = parseSheetDate(cols[dateCol] || "");
            if (t == null || t < sinceMs || t > untilMs) continue;
          }
          sheetLeads++;
          if (mqlCol >= 0 && (cols[mqlCol] || "").toUpperCase().trim() === wanted) sheetMqls++;
        }
      }
    }
  } catch (e: any) {
    sheetError = e?.message || String(e);
  }

  // ---------- KPIS DO TOPO ----------
  const ghlLeadsTotais = allContacts.filter((c) => inRange(c.dateAdded)).length;
  const mqlContacts = allContacts.filter((c) =>
    inRange(c.dateAdded) && (c.tags || []).some((t: string) => String(t).toLowerCase().includes("mql"))
  );
  const ghlMqls = mqlContacts.length;
  const leadsTotais = ds.leads_source === "sheet" ? sheetLeads : ghlLeadsTotais;
  const mqls = ds.mqls_source === "sheet" ? sheetMqls : ghlMqls;
  // Helpers de tag de lead (hoisted: usados aqui e nos funis abaixo)
  const normTag = (s: any) => String(s || "").toLowerCase().replace(/\s+/g, "");
  const hasLeadTag = (c: any) => {
    const tags = (c?.tags || []).map(normTag);
    return tags.includes("leada") || tags.includes("leadb") || tags.includes("leadc");
  };
  const contactById = new Map<string, any>();
  for (const c of allContacts) contactById.set(c.id, c);

  // meetingSummary (com filtro de tag) — usado nos KPIs do topo / funis por tag
  const meetingSummary = { agendados: 0, realizados: 0, noshow: 0, cancelados: 0, total: 0 };
  // meetingSummaryAll (SEM filtro de tag) — usado SOMENTE no Funil Calendário (aba Geral):
  // mostra tudo que está marcado no calendário, independente de ter tag de lead.
  const meetingSummaryAll = { agendados: 0, realizados: 0, noshow: 0, cancelados: 0, total: 0 };
  const statusHistogram: Record<string, number> = {};
  for (const a of allAppts) {
    const rawStatus = String(a?.appointmentStatus || a?.status || "(vazio)").toLowerCase();
    statusHistogram[rawStatus] = (statusHistogram[rawStatus] || 0) + 1;
    const bucket = getAppointmentBucket(a);
    // Geral: conta tudo do calendário
    if (bucket === "agendado") { meetingSummaryAll.agendados++; meetingSummaryAll.total++; }
    else if (bucket === "realizado") { meetingSummaryAll.realizados++; meetingSummaryAll.total++; }
    else if (bucket === "noshow") { meetingSummaryAll.noshow++; meetingSummaryAll.total++; }
    else if (bucket === "cancelado") { meetingSummaryAll.cancelados++; }

    // Demais abas: só conta se o contato tiver tag de lead (leada/leadb/leadc)
    const c = a.contactId ? contactById.get(a.contactId) : null;
    if (!c || !hasLeadTag(c)) continue;
    if (bucket === "agendado") { meetingSummary.agendados++; meetingSummary.total++; }
    else if (bucket === "realizado") { meetingSummary.realizados++; meetingSummary.total++; }
    else if (bucket === "noshow") { meetingSummary.noshow++; meetingSummary.total++; }
    else if (bucket === "cancelado") { meetingSummary.cancelados++; }
  }



  const agendados = meetingSummary.agendados;
  const realizados = meetingSummary.realizados;
  // Stages de proposta: usa mapeamento se configurado, senão regex nome
  const proposalStageIdsAll = new Set<string>();
  if (hasStageMappings) {
    for (const s of mappedStages.proposta_enviada) proposalStageIdsAll.add(s);
    for (const s of mappedStages.proposta_perdida) proposalStageIdsAll.add(s);
  } else {
    for (const p of pipelines) {
      for (const s of (p.stages || [])) {
        if (/proposta|proposal/i.test(s.name || "")) proposalStageIdsAll.add(s.id);
      }
    }
  }
  let propostas = 0, vendas = 0, faturamento = 0, totalOpps = allOpps.length;
  for (const o of allOpps) {
    if (proposalStageIdsAll.has(o.pipelineStageId)) propostas++;
    const isWonByStage = hasStageMappings && mappedStages.vendida.has(o.pipelineStageId);
    if ((o.status || "").toLowerCase() === "won" || isWonByStage) {
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
  // contactById já definido acima (junto com helpers de tag)
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
        vendas: { A: 0, B: 0, C: 0, Outro: 0 },
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
  const sdrByContact = new Map<string, { id: string; name: string }>();
  const noShowByHour: Record<string, number> = {};
  const agendadosByHour: Record<string, number> = {};
  let apptsFiltradosSemOpp = 0;
  for (const a of allAppts) {
    // Status do appointment no calendário: confirmed = marcada, showed = compareceu,
    // noshow = não compareceu, cancelled/invalid = não conta como marcada.
    const bucketType = getAppointmentBucket(a);
    const isCancelled = bucketType === "cancelado";
    if (isCancelled) continue;
    const metaOpp = a.contactId ? metaOppByContact.get(a.contactId) : null;
    const uid = (metaOpp?.assignedTo) || a.assignedUserId || a.userId;
    if (!uid) continue;
    const s = initSdr(uid);
    s.agendados++;
    if (a.contactId) sdrByContact.set(a.contactId, { id: s.user.id, name: s.user.name });

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
      sdrName: s.user.name,
    };
    if (a.startTime) {
      const h = new Date(a.startTime).getHours();
      const key = `${String(h).padStart(2, "0")}:00`;
      agendadosByHour[key] = (agendadosByHour[key] || 0) + 1;
    }
    let bucket: "agendado" | "realizado" | "noshow" | "cancelado" = "agendado";
    if (bucketType === "realizado") { s.realizados++; bucket = "realizado"; }
    else if (bucketType === "noshow") {
      s.noshow++; bucket = "noshow";
      if (a.startTime) {
        const h = new Date(a.startTime).getHours();
        const key = `${String(h).padStart(2, "0")}:00`;
        noShowByHour[key] = (noShowByHour[key] || 0) + 1;
      }
    } else if (bucketType === "cancelado") { s.cancelados++; bucket = "cancelado"; }
    s.lists[bucket].push(entry);
  }
  // Vendas por SDR/classe — atribui a venda ao SDR que originalmente agendou aquele contato
  for (const o of allOpps) {
    if ((o.status || "").toLowerCase() !== "won") continue;
    if (!o.contactId) continue;
    const sdr = sdrByContact.get(o.contactId);
    if (!sdr) continue;
    const s = sdrMap.get(sdr.id);
    if (!s) continue;
    const clsRaw = (pipelineClasseById.get(o._pipelineId) || "Outro");
    const cls: "A"|"B"|"C"|"Outro" = (clsRaw === "A" || clsRaw === "B" || clsRaw === "C") ? clsRaw as any : "Outro";
    s.vendas[cls]++;
  }
  const sdrs = Array.from(sdrMap.values()).sort((a, b) => b.agendados - a.agendados);

  // ---------- CLOSERS BREAKDOWN ----------
  const closerMap = new Map<string, any>();
  const emptyClassLists = () => ({ A: [] as any[], B: [] as any[], C: [] as any[], Outro: [] as any[] });
  const initCloser = (uid: string) => {
    if (!closerMap.has(uid)) {
      const u = users.find((x: any) => x.id === uid) || { id: uid, name: "Desconhecido" };
      closerMap.set(uid, {
        user: u,
        lists: {
          realizados: emptyClassLists(),
          vendas: emptyClassLists(),
          propostasAbertas: emptyClassLists(),
          propostasPerdidas: emptyClassLists(),
        },
      });
    }
    return closerMap.get(uid)!;
  };
  // Reuniões realizadas atribuídas (atende ao closer responsável pela reunião)
  for (const a of allAppts) {
    const bucketType = getAppointmentBucket(a);
    if (bucketType !== "realizado") continue;
    const metaOpp = a.contactId ? metaOppByContact.get(a.contactId) : null;
    const uid = (metaOpp?.assignedTo) || a.assignedUserId || a.userId;
    if (!uid) continue;
    const c = initCloser(uid);

    const contact = a.contactId ? contactById.get(a.contactId) : null;
    const catRaw = a.contactId ? classifyContact(a.contactId) : "Outro";
    const cls: "A"|"B"|"C"|"Outro" = (catRaw === "A" || catRaw === "B" || catRaw === "C") ? catRaw : "Outro";
    c.lists.realizados[cls].push({
      contactId: a.contactId || null,
      nome: contact ? (`${contact.firstName||""} ${contact.lastName||""}`.trim() || contact.contactName || contact.email || "—") : (a.title || "—"),
      email: contact?.email, phone: contact?.phone,
      startTime: a.startTime, valor: 0, pipeline: null,
    });
  }
  // Vendas / propostas abertas / propostas perdidas (atribuídas via opp.assignedTo)
  for (const o of allOpps) {
    const uid = o.assignedTo;
    if (!uid) continue;
    const c = initCloser(uid);
    const clsRaw = (pipelineClasseById.get(o._pipelineId) || "Outro");
    const cls: "A"|"B"|"C"|"Outro" = (clsRaw === "A" || clsRaw === "B" || clsRaw === "C") ? clsRaw as any : "Outro";
    const status = (o.status || "").toLowerCase();
    const contact = o.contactId ? contactById.get(o.contactId) : null;
    const entry = {
      contactId: o.contactId || null,
      oppId: o.id,
      nome: o.name || (contact ? `${contact.firstName||""} ${contact.lastName||""}`.trim() : "") || o.contactName || "—",
      email: contact?.email, phone: contact?.phone,
      valor: Number(o.monetaryValue || 0),
      pipeline: o._pipelineName,
    };
    if (status === "won" || (hasStageMappings && mappedStages.vendida.has(o.pipelineStageId))) c.lists.vendas[cls].push(entry);
    // Classifica proposta enviada/perdida: prioriza mapeamento explícito
    const stageId = o.pipelineStageId;
    const stageName = (pipelines.find((p: any) => p.id === o._pipelineId)
      ?.stages?.find((s: any) => s.id === stageId)?.name || "").toLowerCase();
    const isStageEnviada = hasStageMappings
      ? mappedStages.proposta_enviada.has(stageId)
      : (/enviad/.test(stageName) && /proposta|proposal/.test(stageName));
    const isStagePerdida = hasStageMappings
      ? mappedStages.proposta_perdida.has(stageId)
      : (/perdid/.test(stageName) && /proposta|proposal/.test(stageName));
    if (isStagePerdida || (!hasStageMappings && proposalStageIdsAll.has(stageId) && status === "lost")) {
      c.lists.propostasPerdidas[cls].push(entry);
    } else if (isStageEnviada || (!hasStageMappings && proposalStageIdsAll.has(stageId) && status !== "won")) {
      c.lists.propostasAbertas[cls].push(entry);
    }

  }
  const closers = Array.from(closerMap.values());

  // ---------- MQLs LIST ----------
  const mqlsList = mqlContacts.map((c) => {
    const appt = apptByContact.get(c.id);
    let situacao: "agendado" | "realizado" | "noshow" | "sem_agendamento" = "sem_agendamento";
    if (appt) {
      const bucketType = getAppointmentBucket(appt);
      if (bucketType === "noshow") situacao = "noshow";
      else if (bucketType === "realizado") situacao = "realizado";
      else if (bucketType === "agendado") situacao = "agendado";
    }
    const sdr = sdrByContact.get(c.id);
    return {
      id: c.id,
      nome: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.contactName || "—",
      email: c.email, phone: c.phone,
      dateAdded: c.dateAdded, situacao,
      horario: appt?.startTime,
      sdrName: sdr?.name || null,
      categoria: classifyContact(c.id),
    };
  }).sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""));

  const mqlSummary = {
    total: mqlsList.length,
    agendados: mqlsList.filter((m) => m.situacao !== "sem_agendamento").length,
    naoAgendados: mqlsList.filter((m) => m.situacao === "sem_agendamento").length,
    realizados: mqlsList.filter((m) => m.situacao === "realizado").length,
    noshow: mqlsList.filter((m) => m.situacao === "noshow").length,
  };

  // ---------- NÃO-MQLs LIST ----------
  const nonMqlsList = allContacts
    .filter((c) => inRange(c.dateAdded) && !(c.tags || []).some((t: string) => String(t).toLowerCase().includes("mql")))
    .map((c) => {
      const appt = apptByContact.get(c.id);
      let situacao: "agendado" | "realizado" | "noshow" | "sem_agendamento" = "sem_agendamento";
      if (appt) {
        const bucketType = getAppointmentBucket(appt);
        if (bucketType === "noshow") situacao = "noshow";
        else if (bucketType === "realizado") situacao = "realizado";
        else if (bucketType === "agendado") situacao = "agendado";
      }
      return {
        id: c.id,
        nome: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.contactName || "—",
        email: c.email, phone: c.phone,
        dateAdded: c.dateAdded, situacao, horario: appt?.startTime,
      };
    })
    .sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""));

  // ---------- CLASSES A/B/C ----------
  const classes: Record<string, any> = {
    A: { leads: 0, propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
    B: { leads: 0, propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
    C: { leads: 0, propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
    Outro: { leads: 0, propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
  };
  // Leads por classe = contatos distintos com opp em pipeline daquela classe (no período)
  const leadsByClass: Record<string, Set<string>> = { A: new Set(), B: new Set(), C: new Set(), Outro: new Set() };
  for (const pf of pipelineFunnels) {
    classes[pf.classe].pipelines.push(pf.name);
    for (const o of allOpps.filter((x) => x._pipelineId === pf.id)) {
      if (o.contactId) leadsByClass[pf.classe].add(o.contactId);
      if (proposalStageIdsAll.has(o.pipelineStageId)) classes[pf.classe].propostas++;
      if ((o.status || "").toLowerCase() === "won") {
        classes[pf.classe].vendas++;
        classes[pf.classe].faturamento += Number(o.monetaryValue || 0);
      }
    }
  }
  for (const k of ["A", "B", "C", "Outro"]) classes[k].leads = leadsByClass[k].size;

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

  // ---------- FUNIS (Tráfego / Recuperação / Prospecção / Geral) ----------
  // normTag, hasLeadTag e contactById já definidos acima
  const classifyLeadByTags = (c: any): "A" | "B" | "C" | "Outro" => {
    const tags = (c?.tags || []).map(normTag);
    if (tags.includes("leada")) return "A";
    if (tags.includes("leadb")) return "B";
    if (tags.includes("leadc")) return "C";
    return "Outro";
  };
  type Cat = "A" | "B" | "C" | "Outro" | "Geral";
  const emptyCat = () => ({ A: 0, B: 0, C: 0, Outro: 0, Geral: 0 });
  const addCat = (obj: any, cat: Exclude<Cat, "Geral">, n = 1) => { obj[cat] += n; obj.Geral += n; };
  const apptInPeriod = (a: any) => {
    const t = new Date(a?.startTime || a?.endTime || 0).getTime();
    return !isNaN(t) && t >= sinceMs && t <= untilMs;
  };

  // Tráfego — atribuição pela data de criação (dateAdded no período)
  // Leads = SOMENTE contatos de tráfego, identificados pelas tags leada/leadb/leadc (hasLeadTag definido acima)
  const trafego = { leads: emptyCat(), mqls: emptyCat(), agendamentos: emptyCat(), comparecimentos: emptyCat() };
  for (const c of allContacts) {
    if (!inRange(c.dateAdded)) continue;
    if (!hasLeadTag(c)) continue;
    addCat(trafego.leads, classifyLeadByTags(c));
  }

  // MQLs = contatos de tráfego com tag leada ou leadb (criados no período)
  for (const c of allContacts) {
    if (!inRange(c.dateAdded)) continue;
    const tags = (c?.tags || []).map(normTag);
    if (!tags.includes("leada") && !tags.includes("leadb")) continue;
    addCat(trafego.mqls, classifyLeadByTags(c));
  }

  // Recuperação — leads criados ANTES do período com appt no período
  const recuperacao = { agendamentos: emptyCat(), comparecimentos: emptyCat() };
  for (const a of allAppts) {
    const bucket = getAppointmentBucket(a);
    if (bucket === "cancelado" || bucket === "outro") continue;
    if (!apptInPeriod(a)) continue;
    const c = a.contactId ? contactById.get(a.contactId) : null;
    // Só conta agendamento/comparecimento se o contato tiver tag de lead (leada/leadb/leadc)
    if (!c || !hasLeadTag(c)) continue;
    const cat = classifyLeadByTags(c);
    const createdT = c?.dateAdded ? new Date(c.dateAdded).getTime() : NaN;
    const isRecup = !isNaN(createdT) && createdT < sinceMs;
    const isTrafego = !isNaN(createdT) && createdT >= sinceMs && createdT <= untilMs;

    if (isRecup) {
      addCat(recuperacao.agendamentos, cat);
      if (bucket === "realizado") addCat(recuperacao.comparecimentos, cat);
    } else if (isTrafego) {
      addCat(trafego.agendamentos, cat);
      if (bucket === "realizado") addCat(trafego.comparecimentos, cat);
    }
  }

  // Prospecção — eventos vindos da Stevo via webhook (tabela)
  const { data: prospRows } = await supabaseAdmin
    .from("kp_comercial_prospeccao")
    .select("event_type, lead_category, sdr_name, sdr_ghl_id")
    .gte("event_at", since.toISOString())
    .lte("event_at", until.toISOString());
  const prospeccao = { prospeccoes: emptyCat(), agendadas: emptyCat(), comparecidas: emptyCat(), noshow: emptyCat() };
  const catOf = (v: any): Exclude<Cat, "Geral"> => (["A", "B", "C"].includes(v) ? v : "Outro");
  for (const r of (prospRows || []) as any[]) {
    const cat = catOf(r.lead_category);
    if (r.event_type === "prospeccao") addCat(prospeccao.prospeccoes, cat);
    else if (r.event_type === "agendada") addCat(prospeccao.agendadas, cat);
    else if (r.event_type === "comparecida") addCat(prospeccao.comparecidas, cat);
    else if (r.event_type === "noshow") addCat(prospeccao.noshow, cat);
  }

  // Geral (Funil Calendário) — SEM filtro de tag: mostra tudo que está marcado
  // no calendário do GHL (agendamento/comparecimento/no-show), independente de tag.
  // Não separa por A/B/C — geral é tudo somado.
  const geral = {
    agendamentos: meetingSummaryAll.total,
    comparecimentos: meetingSummaryAll.realizados,
    noshows: meetingSummaryAll.noshow,
    vendas,
  };



  // ---------- SDR por funil ----------
  const sdrFunilMap = new Map<string, any>();
  const initSdrFunil = (uid: string) => {
    if (!sdrFunilMap.has(uid)) {
      const u = users.find((x: any) => x.id === uid) || { id: uid, name: "Desconhecido" };
      sdrFunilMap.set(uid, {
        user: u,
        trafego: { agendamentos: emptyCat(), comparecimentos: emptyCat(), vendas: emptyCat() },
        recuperacao: { agendamentos: emptyCat(), comparecimentos: emptyCat() },
        prospeccao: { prospeccoes: emptyCat(), agendadas: emptyCat(), comparecidas: emptyCat() },
      });
    }
    return sdrFunilMap.get(uid)!;
  };
  for (const a of allAppts) {
    const bucket = getAppointmentBucket(a);
    if (bucket === "cancelado" || bucket === "outro") continue;
    if (!apptInPeriod(a)) continue;
    const c = a.contactId ? contactById.get(a.contactId) : null;
    // Só conta agendamento/comparecimento se o contato tiver tag de lead (leada/leadb/leadc)
    if (!c || !hasLeadTag(c)) continue;
    const metaOpp = a.contactId ? metaOppByContact.get(a.contactId) : null;
    const uid = (metaOpp?.assignedTo) || a.assignedUserId || a.userId;
    if (!uid) continue;
    const cat = classifyLeadByTags(c);
    const createdT = c?.dateAdded ? new Date(c.dateAdded).getTime() : NaN;
    const isRecup = !isNaN(createdT) && createdT < sinceMs;
    const s = initSdrFunil(uid);
    const target = isRecup ? s.recuperacao : s.trafego;
    addCat(target.agendamentos, cat);
    if (bucket === "realizado") addCat(target.comparecimentos, cat);
  }
  for (const o of allOpps) {
    if ((o.status || "").toLowerCase() !== "won" || !o.contactId) continue;
    const sdr = sdrByContact.get(o.contactId);
    if (!sdr) continue;
    const s = sdrFunilMap.get(sdr.id);
    if (!s) continue;
    const c = contactById.get(o.contactId);
    addCat(s.trafego.vendas, c ? classifyLeadByTags(c) : "Outro");
  }
  for (const r of (prospRows || []) as any[]) {
    const uid = r.sdr_ghl_id || null;
    let s = uid ? sdrFunilMap.get(uid) : null;
    if (!s && r.sdr_name) {
      for (const v of sdrFunilMap.values()) {
        if (String(v.user.name || "").toLowerCase() === String(r.sdr_name).toLowerCase()) { s = v; break; }
      }
    }
    if (!s) {
      const id = uid || ("prosp:" + (r.sdr_name || "Desconhecido"));
      s = initSdrFunil(id);
      if (!uid) s.user = { id, name: r.sdr_name || "Prospecção" };
    }
    const cat = catOf(r.lead_category);
    if (r.event_type === "prospeccao") addCat(s.prospeccao.prospeccoes, cat);
    else if (r.event_type === "agendada") addCat(s.prospeccao.agendadas, cat);
    else if (r.event_type === "comparecida") addCat(s.prospeccao.comparecidas, cat);
  }
  const sdrFunis = Array.from(sdrFunilMap.values());

  return {
    period: { since: since.toISOString(), until: until.toISOString() },
    kpis,
    funis: { trafego, recuperacao, prospeccao, geral },
    sdrFunis,
    dataSources: {
      leads: ds.leads_source, mqls: ds.mqls_source,
      comparecidas: ds.comparecidas_source, vendas: ds.vendas_source,
      meetings: ds.meetings_source,
      opportunity_source_filter: ds.opportunity_source_filter,
      opportunity_source_enabled: ds.opportunity_source_enabled,
      sheet: { id: ds.sheet_id, tab: ds.sheet_tab, mql_column: ds.sheet_mql_column, mql_value: ds.sheet_mql_value },
      sheetCounts: { leads: sheetLeads, mqls: sheetMqls, rows: sheetRowsTotal },
      ghlCounts: { leads: ghlLeadsTotais, mqls: ghlMqls },
      sheetError,
    },
    calendarsConfig: calendars.map((c: any) => ({
      id: c.id,
      name: c.name || calendarMeta.get(c.id)?.name || "",
      enabled: hasCalendarConfig ? !!calendarMeta.get(c.id)?.enabled : true,
    })),
    appointmentSourceDebug: {
      appointmentsBrutos: allAppts.length,
      filtradosSemOppMeta: apptsFiltradosSemOpp,
      sourceFilter, sourceEnabled, meetingsFromCalendar,
      topSources,
      metaOppsTotal: metaOppByContact.size,
      meetingsCounted: meetingSummary.total,
      meetingsByStatus: meetingSummary,
    },

    users,
    sdrs,
    closers,
    noShowByHour,
    agendadosByHour,
    mqlSummary,
    mqlsList: mqlsList.slice(0, 500),
    nonMqlsList: nonMqlsList.slice(0, 500),
    pipelines: pipelines.map((p: any) => ({ id: p.id, name: p.name, stages: (p.stages || []).map((s: any) => ({ id: s.id, name: s.name })) })),
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

    if (mode === "sync_calendars") {
      const apiKey = Deno.env.get("KP_GHL_API_KEY")!;
      const locationId = Deno.env.get("KP_GHL_LOCATION_ID")!;
      const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" };
      const r = await fetch(`${GHL_BASE}/calendars/?locationId=${locationId}`, { headers });
      const j = r.ok ? await r.json() : { calendars: [] };
      const cals = (j.calendars || []) as any[];
      const { data: existing } = await supabase.from("kp_comercial_calendars").select("ghl_calendar_id, enabled");
      const existingMap = new Map((existing || []).map((x: any) => [x.ghl_calendar_id, x.enabled]));
      const rows = cals.map((c) => ({
        ghl_calendar_id: c.id,
        name: c.name || "",
        enabled: existingMap.has(c.id) ? !!existingMap.get(c.id) : false,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length) {
        await supabase.from("kp_comercial_calendars").upsert(rows, { onConflict: "ghl_calendar_id" });
      }
      const { data: all } = await supabase.from("kp_comercial_calendars").select("*").order("name");
      return new Response(JSON.stringify({ calendars: all || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
