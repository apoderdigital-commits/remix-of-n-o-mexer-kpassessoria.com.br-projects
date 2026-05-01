import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_DOMAIN = "@kp.local";
const MAX_ATTEMPTS = 5;

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await adminClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Apenas admins" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { verification_id, code } = await req.json();
    if (!verification_id || !code) {
      return new Response(JSON.stringify({ error: "verification_id e code obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ver, error: verError } = await adminClient
      .from("user_creation_verifications")
      .select("*")
      .eq("id", verification_id)
      .eq("requested_by", user.id)
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
    if ((ver.attempts ?? 0) >= MAX_ATTEMPTS) {
      return new Response(JSON.stringify({ error: "Tentativas excedidas" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incoming_hash = await sha256(String(code).trim());
    if (incoming_hash !== ver.code_hash) {
      await adminClient
        .from("user_creation_verifications")
        .update({ attempts: (ver.attempts ?? 0) + 1 })
        .eq("id", ver.id);
      return new Response(JSON.stringify({
        error: "Código inválido",
        attempts_left: MAX_ATTEMPTS - ((ver.attempts ?? 0) + 1),
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark consumed first to prevent reuse
    await adminClient
      .from("user_creation_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", ver.id);

    const { username, password, full_name, role, dashboard_keys, client_ids, phone } = ver.payload as any;
    const email = String(username).toLowerCase() + EMAIL_DOMAIN;

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "" },
    });

    if (createError || !newUser?.user) {
      console.error("[confirm-user-creation-code] createUser error:", createError);
      return new Response(JSON.stringify({ error: createError?.message || "Erro ao criar usuário" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    if (role) {
      await adminClient.from("user_roles").insert({ user_id: userId, role });
    }
    if (dashboard_keys?.length) {
      await adminClient.from("user_dashboard_access").insert(
        dashboard_keys.map((dk: string) => ({ user_id: userId, dashboard_key: dk }))
      );
    }
    if (client_ids?.length) {
      await adminClient.from("user_client_access").insert(
        client_ids.map((cid: string) => ({ user_id: userId, client_id: cid }))
      );
    }
    if (phone) {
      await adminClient.from("profiles").update({ phone }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[confirm-user-creation-code] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
