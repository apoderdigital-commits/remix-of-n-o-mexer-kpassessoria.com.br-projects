import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { verification_id, code, new_password } = await req.json();

    if (!verification_id || !code || !new_password) {
      return new Response(JSON.stringify({ error: "verification_id, code e new_password são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof new_password !== "string" || new_password.length < 6) {
      return new Response(JSON.stringify({ error: "A nova senha deve ter ao menos 6 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ver, error: verError } = await adminClient
      .from("password_reset_verifications")
      .select("*")
      .eq("id", verification_id)
      .maybeSingle();

    if (verError || !ver) {
      return new Response(JSON.stringify({ error: "Verificação não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ver.consumed_at) {
      return new Response(JSON.stringify({ error: "Código já utilizado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(ver.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Código expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ver.attempts >= MAX_ATTEMPTS) {
      await adminClient
        .from("password_reset_verifications")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", verification_id);
      return new Response(JSON.stringify({ error: "Muitas tentativas. Solicite um novo código." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code_hash = await sha256(String(code).trim());
    if (code_hash !== ver.code_hash) {
      await adminClient
        .from("password_reset_verifications")
        .update({ attempts: ver.attempts + 1 })
        .eq("id", verification_id);
      return new Response(JSON.stringify({ error: "Código incorreto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update user password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(ver.user_id, {
      password: new_password,
    });

    if (updateError) {
      console.error("[confirm-password-reset] updateUserById error:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao atualizar senha: " + updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient
      .from("password_reset_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", verification_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[confirm-password-reset] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
