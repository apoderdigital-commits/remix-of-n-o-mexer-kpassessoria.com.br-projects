import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Webhook do n8n que repassa a mensagem pronta para o Z-API
const N8N_WEBHOOK = "https://kpadm-n8n.a6hrr3.easypanel.host/webhook/relatorioautositekp";

const hourOf = (t: string) => parseInt(String(t || "00:00").split(":")[0], 10);

function spNow() {
  // Hora atual no fuso de São Paulo
  const sp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return { weekday: sp.getDay(), hour: sp.getHours(), dom: sp.getDate() };
}

// Decide quais relatórios um cliente deve receber AGORA
function matchingTypes(cfg: any, now: { weekday: number; hour: number; dom: number }): string[] {
  const out: string[] = [];

  if (cfg.daily_enabled) {
    let days = cfg.daily_days || [];
    if (typeof days === "string") {
      days = days.replace(/[{}]/g, "").split(",").filter(Boolean).map(Number);
    }
    const dayOk = days.length === 0 || days.includes(now.weekday);
    if (dayOk && hourOf(cfg.daily_time) === now.hour) out.push("daily");
  }
  if (cfg.weekly_enabled && Number(cfg.weekly_day) === now.weekday && hourOf(cfg.weekly_time) === now.hour) {
    out.push("weekly");
  }
  if (cfg.monthly_enabled && Number(cfg.monthly_day) === now.dom && hourOf(cfg.monthly_time) === now.hour) {
    out.push("monthly");
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Permite teste manual: { force_client_id, report_type }
    let forceClientId: string | null = null;
    let forceType = "weekly";
    try {
      const b = await req.json();
      forceClientId = b?.force_client_id ?? null;
      forceType = b?.report_type ?? "weekly";
    } catch (_) {
      // sem body — execução normal do cron
    }

    const now = spNow();

    // Busca todas as configs ativas
    let query = supabase.from("client_report_configs").select("*").eq("enabled", true);
    if (forceClientId) query = query.eq("client_id", forceClientId);
    const { data: configs, error } = await query;
    if (error) throw error;

    const dispatched: any[] = [];

    for (const cfg of configs || []) {
      // Tipos que batem agora (ou o forçado, no teste manual)
      const types = forceClientId ? [forceType] : matchingTypes(cfg, now);
      if (types.length === 0) continue;
      if (!cfg.whatsapp_jid) continue;

      for (const report_type of types) {
        // 1. Monta a mensagem pronta
        const buildRes = await fetch(`${SUPABASE_URL}/functions/v1/build-report-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ client_id: cfg.client_id, report_type }),
        });

        if (!buildRes.ok) {
          dispatched.push({ client_id: cfg.client_id, report_type, ok: false, error: `build ${buildRes.status}` });
          continue;
        }
        const built = await buildRes.json();
        if (!built?.message) {
          dispatched.push({ client_id: cfg.client_id, report_type, ok: false, error: "sem mensagem" });
          continue;
        }

        // 2. Manda a mensagem pronta pro n8n (que repassa ao Z-API)
        const sendRes = await fetch(N8N_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            test: false,
            client_id: cfg.client_id,
            client_name: built.client_name,
            report_type,
            metric_source: cfg.metric_source,
            jid: built.jid || cfg.whatsapp_jid,
            message: built.message,
            metrics: built.metrics,
            period: built.period,
          }),
        });

        dispatched.push({
          client_id: cfg.client_id,
          report_type,
          ok: sendRes.ok,
          status: sendRes.status,
        });
      }
    }

    return new Response(
      JSON.stringify({ ran_at: new Date().toISOString(), sp_now: now, count: dispatched.length, dispatched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("dispatch-reports error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
