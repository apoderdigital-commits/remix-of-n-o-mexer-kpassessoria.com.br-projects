import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const N8N_WEBHOOK_URL = Deno.env.get("N8N_WHATSAPP_WEBHOOK_URL") ||
  "https://kpadm-n8n.a6hrr3.easypanel.host/webhook/4d42e487-02de-410d-92c3-6c855da1525b";

const EMAIL_DOMAIN = "@kp.local";

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, "0");
}

function maskPhone(digits: string): string {
  if (!digits || digits.length < 4) return "••••";
  const last4 = digits.slice(-4);
  return `(••) •••••-${last4}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const send = Boolean(body.send);

    if (!username) {
      return new Response(JSON.stringify({ error: "Usuário obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = username + EMAIL_DOMAIN;

    // Look up profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("user_id, full_name, phone, email")
      .eq("email", email)
      .maybeSingle();

    if (!profile?.user_id) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneDigits = String(profile.phone ?? "").replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      return new Response(JSON.stringify({
        error: "Este usuário não tem um WhatsApp cadastrado. Entre em contato com o administrador.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const masked_phone = maskPhone(phoneDigits);
    const full_name = profile.full_name || username;

    if (!send) {
      // Step 1 — just reveal masked phone for confirmation
      return new Response(JSON.stringify({ masked_phone, full_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2 — send the code

    // Rate limit: 1 request per 30s per user (unconsumed only)
    const { data: recent } = await adminClient
      .from("password_reset_verifications")
      .select("created_at")
      .eq("user_id", profile.user_id)
      .is("consumed_at", null)
      .gt("created_at", new Date(Date.now() - 30 * 1000).toISOString())
      .limit(1);
    if (recent?.length) {
      return new Response(JSON.stringify({ error: "Aguarde 30s antes de pedir um novo código" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invalidate previous unconsumed codes
    await adminClient
      .from("password_reset_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", profile.user_id)
      .is("consumed_at", null);

    const code = generateCode();
    const code_hash = await sha256(code);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: inserted, error: insertError } = await adminClient
      .from("password_reset_verifications")
      .insert({
        user_id: profile.user_id,
        phone: phoneDigits,
        code_hash,
        expires_at,
      })
      .select("id, expires_at")
      .single();

    if (insertError || !inserted) {
      console.error("[request-password-reset] insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao registrar verificação" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "password_reset_code",
        phone: phoneDigits,
        code,
        user_name: profile.full_name || username,
        expires_in_minutes: 10,
      }),
    });

    if (!webhookResponse.ok) {
      const errText = await webhookResponse.text();
      console.error("[request-password-reset] n8n error:", errText);
      return new Response(JSON.stringify({ error: "Erro ao enviar código pelo WhatsApp" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      verification_id: inserted.id,
      expires_at: inserted.expires_at,
      masked_phone,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[request-password-reset] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
