// KP Comercial — Webhook de Prospecção (Stevo via n8n)
// Recebe eventos de prospecção disparados pela Stevo através do n8n e grava em
// kp_comercial_prospeccao. Cada chamada conta como um evento (ex.: 1 prospecção).
//
// POST /functions/v1/kp-prospeccao-webhook
// Body (objeto único OU array de objetos):
// {
//   "event_type": "prospeccao" | "agendada" | "comparecida" | "noshow",  (default: "prospeccao")
//   "sdr_name": "Esteves",            (opcional)
//   "sdr_ghl_id": "abc123",           (opcional)
//   "lead_category": "A"|"B"|"C"|"Outro",  (opcional, default: "Outro")
//   "contact_name": "Fulano",         (opcional)
//   "contact_phone": "+55...",        (opcional)
//   "message": "Oi quero falar com voce",  (opcional)
//   "event_at": "2026-05-28T20:00:00Z",    (opcional, default: agora)
//   "token": "<segredo>"              (opcional; exigido só se KP_PROSPECCAO_TOKEN estiver definido)
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-prospeccao-token",
};

const ALLOWED_TYPES = new Set(["prospeccao", "agendada", "comparecida", "noshow"]);
const norm = (v: unknown) => String(v ?? "").trim();
const normCat = (v: unknown): "A" | "B" | "C" | "Outro" => {
  const s = norm(v).toUpperCase().replace(/^LEAD/, "").trim();
  if (s === "A" || s === "B" || s === "C") return s;
  return "Outro";
};

const sb = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

function buildRow(item: any) {
  let et = norm(item?.event_type || item?.type || "prospeccao").toLowerCase();
  if (!ALLOWED_TYPES.has(et)) et = "prospeccao";
  const at = item?.event_at ? new Date(item.event_at) : new Date();
  return {
    event_type: et,
    sdr_name: norm(item?.sdr_name || item?.sdr || item?.responsavel) || null,
    sdr_ghl_id: norm(item?.sdr_ghl_id || item?.ghl_user_id) || null,
    lead_category: normCat(item?.lead_category ?? item?.categoria ?? item?.lead),
    contact_name: norm(item?.contact_name || item?.nome || item?.name) || null,
    contact_phone: norm(item?.contact_phone || item?.phone || item?.telefone) || null,
    message: norm(item?.message || item?.mensagem || item?.text) || null,
    event_at: isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString(),
    raw: item ?? {},
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Segredo opcional: só valida se KP_PROSPECCAO_TOKEN estiver configurado.
    const expected = Deno.env.get("KP_PROSPECCAO_TOKEN");
    if (expected) {
      const provided = req.headers.get("x-prospeccao-token") ||
        (Array.isArray(body) ? body[0]?.token : body?.token);
      if (norm(provided) !== expected) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const items = Array.isArray(body) ? body : [body];
    const rows = items.map(buildRow);

    const supabase = sb();
    const { data, error } = await supabase
      .from("kp_comercial_prospeccao")
      .insert(rows)
      .select("id");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, inserted: data?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("kp-prospeccao-webhook error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
