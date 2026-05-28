// KP Comercial — Fase 2: Reuniões/SDRs, MQLs detalhado, Propostas/Vendas A/B/C
// Pipelines representam classificação (A/B/C) — usa o nome do pipeline.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const GHL_BASE = "https://services.leadconnectorhq.com";

const isoDate = (d: string | undefined, fb: Date) => {
  if (!d) return fb;
  const p = new Date(d);
  return isNaN(p.getTime()) ? fb : p;
};
const inRange = (s: string | undefined, a: number, b: number) => {
  if (!s) return false;
  const t = new Date(s).getTime();
  return !isNaN(t) && t >= a && t <= b;
};
const fmtMD = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;

const classifyPipeline = (name: string): "A" | "B" | "C" | "Outro" => {
  const n = name.toLowerCase();
  if (/\b(a|cliente.?a|classe.?a|premium)\b/.test(n)) return "A";
  if (/\b(b|cliente.?b|classe.?b)\b/.test(n)) return "B";
  if (/\b(c|cliente.?c|classe.?c)\b/.test(n)) return "C";
  return "Outro";
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

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    };

    // 1. Users (potenciais SDRs)
    const usersRes = await fetch(`${GHL_BASE}/users/?locationId=${locationId}`, { headers });
    const usersJson = usersRes.ok ? await usersRes.json() : { users: [] };
    const users = (usersJson.users || []).map((u: any) => ({
      id: u.id,
      name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
      email: u.email,
    }));

    // 2. Calendars + appointments
    const calRes = await fetch(`${GHL_BASE}/calendars/?locationId=${locationId}`, { headers });
    const calJson = calRes.ok ? await calRes.json() : { calendars: [] };
    const calendars = calJson.calendars || [];

    interface Appt { id: string; userId?: string; calendarId?: string; startTime?: string; status?: string; appointmentStatus?: string; contactId?: string; }
    const allAppts: Appt[] = [];
    for (const c of calendars) {
      const params = new URLSearchParams({
        locationId,
        calendarId: c.id,
        startTime: String(sinceMs),
        endTime: String(untilMs),
      });
      const r = await fetch(`${GHL_BASE}/calendars/events?${params}`, { headers });
      if (!r.ok) continue;
      const j = await r.json();
      for (const e of (j.events || [])) {
        allAppts.push({
          id: e.id,
          userId: e.assignedUserId || e.userId,
          calendarId: c.id,
          startTime: e.startTime,
          status: e.status,
          appointmentStatus: e.appointmentStatus,
          contactId: e.contactId,
        });
      }
    }

    // SDR breakdown
    const sdrMap = new Map<string, { user: any; agendados: number; realizados: number; noshow: number; cancelados: number }>();
    const initSdr = (uid: string) => {
      if (!sdrMap.has(uid)) {
        const u = users.find((x: any) => x.id === uid) || { id: uid, name: "Desconhecido" };
        sdrMap.set(uid, { user: u, agendados: 0, realizados: 0, noshow: 0, cancelados: 0 });
      }
      return sdrMap.get(uid)!;
    };
    const noShowByHour: Record<string, number> = {};
    for (const a of allAppts) {
      if (!a.userId) continue;
      const st = (a.appointmentStatus || a.status || "").toLowerCase();
      // cancelled/invalid não conta como reunião marcada
      if (st.includes("cancel") || st.includes("invalid")) continue;
      const s = initSdr(a.userId);
      s.agendados++;
      if (st.includes("show") && !st.includes("no")) s.realizados++;
      else if (st.includes("noshow") || st === "no-show" || st === "no_show") {
        s.noshow++;
        if (a.startTime) {
          const h = new Date(a.startTime).getHours();
          const key = `${String(h).padStart(2, "0")}:00`;
          noShowByHour[key] = (noShowByHour[key] || 0) + 1;
        }
      }
    }
    const sdrs = Array.from(sdrMap.values()).sort((a, b) => b.agendados - a.agendados);

    // 3. Contacts (MQLs detalhado)
    let allContacts: any[] = [];
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
    const contactById = new Map(allContacts.map((c: any) => [c.id, c]));

    const mqlsList = allContacts
      .filter((c) => inRange(c.dateAdded, sinceMs, untilMs))
      .filter((c) => (c.tags || []).some((t: string) => String(t).toLowerCase().includes("mql")))
      .map((c) => {
        const appt = allAppts.find((a) => a.contactId === c.id);
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
          email: c.email,
          phone: c.phone,
          dateAdded: c.dateAdded,
          situacao,
          horario: appt?.startTime,
        };
      })
      .sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || ""));

    const mqlSummary = {
      total: mqlsList.length,
      agendados: mqlsList.filter((m) => m.situacao !== "sem_agendamento").length,
      naoAgendados: mqlsList.filter((m) => m.situacao === "sem_agendamento").length,
      realizados: mqlsList.filter((m) => m.situacao === "realizado").length,
      noshow: mqlsList.filter((m) => m.situacao === "noshow").length,
    };

    // 4. Pipelines = classificação A/B/C → propostas + vendas
    const pipRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
    const pipJson = pipRes.ok ? await pipRes.json() : { pipelines: [] };
    const pipelines = pipJson.pipelines || [];

    const classes: Record<string, { propostas: number; vendas: number; faturamento: number; pipelines: string[] }> = {
      A: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
      B: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
      C: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
      Outro: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] },
    };

    for (const p of pipelines) {
      const cls = classifyPipeline(p.name || "");
      classes[cls].pipelines.push(p.name);

      // identifica stage de "proposta"
      const proposalStageIds = new Set(
        (p.stages || [])
          .filter((s: any) => /proposta|proposal/i.test(s.name || ""))
          .map((s: any) => s.id)
      );

      let oppPage = 1;
      for (let i = 0; i < 5; i++) {
        const params = new URLSearchParams({
          location_id: locationId,
          pipeline_id: p.id,
          limit: "100",
          page: String(oppPage),
          date: fmtMD(since),
          endDate: fmtMD(until),
        });
        const r = await fetch(`${GHL_BASE}/opportunities/search?${params}`, { headers });
        if (!r.ok) break;
        const j = await r.json();
        const opps = j.opportunities || [];
        for (const o of opps) {
          if (proposalStageIds.has(o.pipelineStageId)) classes[cls].propostas++;
          if ((o.status || "").toLowerCase() === "won") {
            classes[cls].vendas++;
            classes[cls].faturamento += Number(o.monetaryValue || 0);
          }
        }
        if (opps.length < 100) break;
        oppPage++;
      }
    }

    return new Response(JSON.stringify({
      period: { since: since.toISOString(), until: until.toISOString() },
      sdrs,
      noShowByHour,
      mqlSummary,
      mqlsList,
      classes,
      totalUsers: users.length,
      totalCalendars: calendars.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("kp-comercial-fase2 error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
