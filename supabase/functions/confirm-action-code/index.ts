import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

// ===== Action executors =====

async function execCreateUser(admin: SupabaseClient, payload: any) {
  const { username, password, full_name, role, dashboard_keys, client_ids, phone, crm_links } = payload;
  const email = String(username).toLowerCase() + EMAIL_DOMAIN;
  const { data: newUser, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: full_name || "" },
  });
  if (error || !newUser?.user) throw new Error(error?.message || "Erro ao criar usuário");
  const userId = newUser.user.id;
  if (role) await admin.from("user_roles").insert({ user_id: userId, role });

  // Se o usuário terá vínculo com o CRM e o admin não marcou nenhum dashboard,
  // herda "crm" automaticamente — do jeito que o cliente respondeu na Fase 2.
  const finalDashboards: string[] = Array.isArray(dashboard_keys) ? [...dashboard_keys] : [];
  if (Array.isArray(crm_links) && crm_links.length > 0 && !finalDashboards.includes("crm")) {
    finalDashboards.push("crm");
  }
  if (finalDashboards.length) {
    await admin.from("user_dashboard_access").insert(
      finalDashboards.map((dk: string) => ({ user_id: userId, dashboard_key: dk }))
    );
  }
  if (client_ids?.length) {
    await admin.from("user_client_access").insert(
      client_ids.map((cid: string) => ({ user_id: userId, client_id: cid }))
    );
  }
  if (phone) await admin.from("profiles").update({ phone }).eq("user_id", userId);

  // Vínculos com subcontas do CRM (crm_users): papel + permissões por subconta.
  if (Array.isArray(crm_links) && crm_links.length) {
    const rows = crm_links
      .filter((l: any) => l && l.cliente_id)
      .map((l: any) => ({
        auth_user_id: userId,
        cliente_id: l.cliente_id,
        nome: full_name || String(username),
        email,
        papel: l.papel === "admin" ? "admin" : "usuario",
        permissoes: l.papel === "admin" ? {} : (l.permissoes || {}),
      }));
    if (rows.length) await admin.from("crm_users").insert(rows);
  }
  return { user_id: userId };
}

async function execDeleteUser(admin: SupabaseClient, payload: any) {
  const { user_id } = payload;
  if (!user_id) throw new Error("user_id obrigatório");
  const { error } = await admin.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("user_id", user_id);
  if (error) throw new Error(error.message);
  const { error: banError } = await admin.auth.admin.updateUserById(user_id, {
    ban_duration: "876000h",
  });
  if (banError) throw new Error(banError.message);
  return { user_id };
}

async function execPurgeUser(admin: SupabaseClient, payload: any) {
  const { user_id } = payload;
  if (!user_id) throw new Error("user_id obrigatório");
  await admin.from("user_dashboard_access").delete().eq("user_id", user_id);
  await admin.from("user_client_access").delete().eq("user_id", user_id);
  await admin.from("user_roles").delete().eq("user_id", user_id);
  await admin.from("crm_users").delete().eq("auth_user_id", user_id);
  await admin.from("profiles").delete().eq("user_id", user_id);
  const { error } = await admin.auth.admin.deleteUser(user_id);
  if (error) throw new Error(error.message);
  return { user_id };
}

async function execCreateClient(admin: SupabaseClient, payload: any) {
  const { client } = payload;
  if (!client?.name) throw new Error("Nome do cliente obrigatório");
  const { data, error } = await admin.from("clients").insert(client).select("id").single();
  if (error) throw new Error(error.message);
  return { client_id: data.id };
}

async function execUpdateClient(admin: SupabaseClient, payload: any) {
  const { client_id, client } = payload;
  if (!client_id) throw new Error("client_id obrigatório");
  console.log("[confirm-action-code] update_client payload", {
    client_id,
    squad_id: client?.squad_id ?? null,
    meta_token_id: client?.meta_token_id ?? null,
    has_meta_access_token: !!client?.meta_access_token,
  });
  const { data, error } = await admin
    .from("clients")
    .update(client)
    .eq("id", client_id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Cliente não encontrado para atualização");
  return { client_id };
}

async function execUpdateClientMetaToken(admin: SupabaseClient, payload: any) {
  const { client_id, meta_token_id, meta_access_token } = payload;
  if (!client_id) throw new Error("client_id obrigatório");
  const { error } = await admin.from("clients").update({
    meta_token_id: meta_token_id || null,
    meta_access_token: meta_access_token || null,
  }).eq("id", client_id);
  if (error) throw new Error(error.message);
  return { client_id };
}

async function execDeleteClient(admin: SupabaseClient, payload: any) {
  const { client_id } = payload;
  if (!client_id) throw new Error("client_id obrigatório");
  const { error } = await admin.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", client_id);
  if (error) throw new Error(error.message);
  return { client_id };
}

async function execPurgeClient(admin: SupabaseClient, payload: any) {
  const { client_id } = payload;
  if (!client_id) throw new Error("client_id obrigatório");
  const { error } = await admin.from("clients").delete().eq("id", client_id);
  if (error) throw new Error(error.message);
  return { client_id };
}

async function execPurgeSquadDailySession(admin: SupabaseClient, payload: any) {
  const { session_id } = payload;
  if (!session_id) throw new Error("session_id obrigatório");
  const { error } = await admin.from("squad_daily_sessions").delete().eq("id", session_id);
  if (error) throw new Error(error.message);
  return { session_id };
}

async function execPurgeSquadEngagementMonth(admin: SupabaseClient, payload: any) {
  const { squad_id, reference_month } = payload;
  if (!squad_id || !reference_month) throw new Error("squad_id e reference_month obrigatórios");
  const { error } = await admin.from("squad_engagement").delete()
    .eq("squad_id", squad_id).eq("reference_month", reference_month);
  if (error) throw new Error(error.message);
  return { squad_id, reference_month };
}

const NON_ADMIN_ACTIONS = new Set(["purge_squad_daily_session", "purge_squad_engagement_month"]);

const EXECUTORS: Record<string, (a: SupabaseClient, p: any) => Promise<any>> = {
  create_user: execCreateUser,
  delete_user: execDeleteUser,
  purge_user: execPurgeUser,
  create_client: execCreateClient,
  update_client: execUpdateClient,
  update_client_meta_token: execUpdateClientMetaToken,
  delete_client: execDeleteClient,
  purge_client: execPurgeClient,
  purge_squad_daily_session: execPurgeSquadDailySession,
  purge_squad_engagement_month: execPurgeSquadEngagementMonth,
};

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

    // Mark consumed BEFORE executing to prevent reuse
    await adminClient
      .from("user_creation_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", ver.id);

    const action = ver.action as string;
    const executor = EXECUTORS[action];
    if (!executor) {
      return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const result = await executor(adminClient, ver.payload);
      return new Response(JSON.stringify({ success: true, action, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (execErr) {
      console.error(`[confirm-action-code] executor ${action} error:`, execErr);
      return new Response(JSON.stringify({ error: (execErr as Error).message || String(execErr) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[confirm-action-code] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
