import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const N8N_WEBHOOK_URL = Deno.env.get("N8N_WHATSAPP_WEBHOOK_URL") ||
  "https://kpadm-n8n.a6hrr3.easypanel.host/webhook/4d42e487-02de-410d-92c3-6c855da1525b";

type Action =
  | "create_user"
  | "delete_user"
  | "purge_user"
  | "create_client"
  | "update_client"
  | "update_client_meta_token"
  | "delete_client"
  | "purge_client"
  | "purge_squad_daily_session";

const ACTION_LABELS: Record<Action, string> = {
  create_user: "criar usuário",
  delete_user: "excluir usuário",
  purge_user: "excluir usuário definitivamente",
  create_client: "criar cliente",
  update_client: "atualizar cliente",
  update_client_meta_token: "atualizar token Meta do cliente",
  delete_client: "excluir cliente",
  purge_client: "excluir cliente definitivamente",
  purge_squad_daily_session: "excluir daily definitivamente",
};

// Actions that any signed-in user can request (not admin-only)
const NON_ADMIN_ACTIONS: Set<Action> = new Set(["purge_squad_daily_session"]);

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, "0");
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

    const body = await req.json();
    const action = body.action as Action;
    const payload = body.payload ?? {};
    const target_label: string = body.target_label || "";

    if (!action || !(action in ACTION_LABELS)) {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!NON_ADMIN_ACTIONS.has(action)) {
      const { data: roles } = await adminClient
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      if (!roles?.length) {
        return new Response(JSON.stringify({ error: "Apenas admins" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get admin phone
    const { data: adminProfile } = await adminClient
      .from("profiles").select("full_name, email, phone").eq("user_id", user.id).maybeSingle();

    const adminPhoneDigits = String(adminProfile?.phone ?? "").replace(/\D/g, "");
    if (adminPhoneDigits.length < 10) {
      return new Response(JSON.stringify({
        error: "Seu perfil de admin não tem telefone cadastrado. Atualize seu telefone antes de executar esta ação."
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit: 30s per admin per action (only counting active codes)
    const { data: recent } = await adminClient
      .from("user_creation_verifications")
      .select("created_at")
      .eq("requested_by", user.id)
      .eq("action", action)
      .is("consumed_at", null)
      .gt("created_at", new Date(Date.now() - 30 * 1000).toISOString())
      .limit(1);
    if (recent?.length) {
      return new Response(JSON.stringify({ error: "Aguarde 30s antes de pedir um novo código" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invalidate previous unconsumed codes for same action
    await adminClient
      .from("user_creation_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("requested_by", user.id)
      .eq("action", action)
      .is("consumed_at", null);

    const code = generateCode();
    const code_hash = await sha256(code);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: inserted, error: insertError } = await adminClient
      .from("user_creation_verifications")
      .insert({
        requested_by: user.id,
        phone: adminPhoneDigits,
        code_hash,
        payload,
        action,
        expires_at,
      })
      .select("id, expires_at")
      .single();

    if (insertError || !inserted) {
      console.error("[request-action-code] insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao registrar verificação" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "verification_code",
        phone: adminPhoneDigits,
        code,
        admin_name: adminProfile?.full_name || adminProfile?.email || "Admin KP",
        action,
        action_label: ACTION_LABELS[action],
        target_label,
        expires_in_minutes: 10,
      }),
    });

    if (!webhookResponse.ok) {
      const errText = await webhookResponse.text();
      console.error("[request-action-code] n8n error:", errText);
      return new Response(JSON.stringify({ error: "Erro ao enviar código pelo WhatsApp" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      verification_id: inserted.id,
      expires_at: inserted.expires_at,
      action_label: ACTION_LABELS[action],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[request-action-code] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
