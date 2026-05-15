// KP Comercial — KPIs do topo (Bloco 6) via GoHighLevel API v2 + Meta Ads
// GHL: secrets KP_GHL_API_KEY e KP_GHL_LOCATION_ID.
// Meta: token "Token de Will" (tabela meta_tokens) + account id fixo abaixo.

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

function isoDate(d: string | undefined, fallback: Date): Date {
  if (!d) return fallback;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}
const toMs = (d: Date) => d.getTime();
const ymd = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("KP_GHL_API_KEY");
    const locationId = Deno.env.get("KP_GHL_LOCATION_ID");
    if (!apiKey || !locationId) {
      return new Response(
        JSON.stringify({ error: "KP_GHL_API_KEY ou KP_GHL_LOCATION_ID não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const since = isoDate(body.since, firstOfMonth);
    const until = isoDate(body.until, today);
    until.setHours(23, 59, 59, 999);
    const sinceMs = toMs(since);
    const untilMs = toMs(until);

    const ghlHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    };

    // ---------- 1. CONTACTS ----------
    let allContacts: any[] = [];
    let page = 1;
    const limit = 100;
    for (let i = 0; i < 5; i++) {
      const r = await fetch(
        `${GHL_BASE}/contacts/?locationId=${locationId}&limit=${limit}&page=${page}`,
        { headers: ghlHeaders }
      );
      if (!r.ok) break;
      const j = await r.json();
      const batch = j.contacts || [];
      allContacts = allContacts.concat(batch);
      if (batch.length < limit) break;
      page++;
    }
    const inRange = (s?: string) => {
      if (!s) return false;
      const t = new Date(s).getTime();
      return !isNaN(t) && t >= sinceMs && t <= untilMs;
    };
    const leadsTotais = allContacts.filter((c) => inRange(c.dateAdded)).length;
    const mqls = allContacts.filter((c) => {
      if (!inRange(c.dateAdded)) return false;
      const tags: string[] = (c.tags || []).map((t: string) => String(t).toLowerCase());
      return tags.some((t) => t.includes("mql"));
    }).length;

    // ---------- 2. OPPORTUNITIES ----------
    const pipelinesRes = await fetch(
      `${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`,
      { headers: ghlHeaders }
    );
    const pipelinesJson = pipelinesRes.ok ? await pipelinesRes.json() : { pipelines: [] };
    const pipelines = pipelinesJson.pipelines || [];

    let vendas = 0;
    let faturamento = 0;
    let totalOpps = 0;
    const fmt = (d: Date) => {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${mm}-${dd}-${d.getFullYear()}`;
    };
    for (const p of pipelines) {
      let oppPage = 1;
      for (let i = 0; i < 5; i++) {
        const params = new URLSearchParams({
          location_id: locationId,
          pipeline_id: p.id,
          limit: "100",
          page: String(oppPage),
          date: fmt(since),
          endDate: fmt(until),
        });
        const r = await fetch(`${GHL_BASE}/opportunities/search?${params}`, { headers: ghlHeaders });
        if (!r.ok) break;
        const j = await r.json();
        const opps = j.opportunities || [];
        for (const o of opps) {
          totalOpps++;
          if ((o.status || "").toLowerCase() === "won") {
            vendas++;
            faturamento += Number(o.monetaryValue || 0);
          }
        }
        if (opps.length < 100) break;
        oppPage++;
      }
    }

    // ---------- 3. META ADS SPEND (KP) ----------
    let investimento = 0;
    let metaError: string | null = null;
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: tk } = await supabase
        .from("meta_tokens")
        .select("token")
        .eq("name", KP_META_TOKEN_NAME)
        .maybeSingle();
      const metaToken = tk?.token;
      if (!metaToken) {
        metaError = `Token "${KP_META_TOKEN_NAME}" não encontrado`;
      } else {
        const tr = `&time_range=${encodeURIComponent(JSON.stringify({ since: ymd(since), until: ymd(until) }))}`;
        let url: string | null =
          `${META_BASE}/act_${KP_META_ACCOUNT_ID}/insights?fields=spend&level=account${tr}&access_token=${metaToken}&limit=500`;
        let pages = 0;
        while (url && pages < 10) {
          const r: Response = await fetch(url);
          const j = await r.json();
          if (j.error) { metaError = j.error.message; break; }
          for (const it of (j.data || [])) investimento += parseFloat(it.spend || "0");
          url = j.paging?.next || null;
          pages++;
        }
      }
    } catch (e: any) {
      metaError = e.message || String(e);
    }

    const ticketMedio = vendas > 0 ? faturamento / vendas : 0;
    const taxaAtivacaoMql = leadsTotais > 0 ? (mqls / leadsTotais) * 100 : 0;
    const winRate = totalOpps > 0 ? (vendas / totalOpps) * 100 : 0;
    const cac = vendas > 0 ? investimento / vendas : 0;
    const roas = investimento > 0 ? faturamento / investimento : 0;

    return new Response(
      JSON.stringify({
        period: { since: since.toISOString(), until: until.toISOString() },
        leadsTotais,
        mqls,
        taxaAtivacaoMql,
        vendas,
        faturamento,
        ticketMedio,
        winRate,
        totalOportunidades: totalOpps,
        investimento,
        cac,
        roas,
        metaError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("kp-comercial-kpis error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
