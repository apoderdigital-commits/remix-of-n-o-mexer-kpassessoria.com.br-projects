const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const EMAIL_DOMAIN = "@kp.local";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    console.log("[create-internal-user] request received, has auth:", !!authHeader);
    if (!authHeader) {
      console.error("[create-internal-user] missing Authorization header");
      return new Response(JSON.stringify({ error: "Não autorizado - cabeçalho ausente" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: getUserError } = await userClient.auth.getUser();
    if (getUserError) console.error("[create-internal-user] getUser error:", getUserError.message);
    if (!user) {
      console.error("[create-internal-user] no user from token");
      return new Response(JSON.stringify({ error: "Não autorizado - token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[create-internal-user] caller:", user.id);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await adminClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Apenas admins" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // SOFT DELETE (move to trash for 7 days)
    if ((body.action === "delete" || body.action === "soft_delete") && body.user_id) {
      // Mark profile as deleted and ban auth user (prevents login)
      await adminClient
        .from("profiles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", body.user_id);
      await adminClient.auth.admin.updateUserById(body.user_id, {
        ban_duration: "876000h", // ~100 years
      });
      return new Response(JSON.stringify({ success: true, action: "soft_delete" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RESTORE from trash
    if (body.action === "restore" && body.user_id) {
      await adminClient
        .from("profiles")
        .update({ deleted_at: null })
        .eq("user_id", body.user_id);
      await adminClient.auth.admin.updateUserById(body.user_id, {
        ban_duration: "none",
      });
      return new Response(JSON.stringify({ success: true, action: "restore" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PURGE definitive (manual permanent delete)
    if (body.action === "purge" && body.user_id) {
      await adminClient.from("user_dashboard_access").delete().eq("user_id", body.user_id);
      await adminClient.from("user_client_access").delete().eq("user_id", body.user_id);
      await adminClient.from("user_roles").delete().eq("user_id", body.user_id);
      await adminClient.from("profiles").delete().eq("user_id", body.user_id);
      await adminClient.auth.admin.deleteUser(body.user_id);
      return new Response(JSON.stringify({ success: true, action: "purge" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE action
    const { username, password, full_name, role, dashboard_keys, client_ids, phone } = body;
    if (!username || !password) {
      return new Response(JSON.stringify({ error: "username e password obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = username.toLowerCase() + EMAIL_DOMAIN;

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "" },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Assign role
    if (role) {
      await adminClient.from("user_roles").insert({ user_id: userId, role });
    }

    // Assign dashboard access
    if (dashboard_keys?.length) {
      await adminClient.from("user_dashboard_access").insert(
        dashboard_keys.map((dk: string) => ({ user_id: userId, dashboard_key: dk }))
      );
    }

    // Assign client access
    if (client_ids?.length) {
      await adminClient.from("user_client_access").insert(
        client_ids.map((cid: string) => ({ user_id: userId, client_id: cid }))
      );
    }

    // Save phone to profile
    if (phone) {
      await adminClient.from("profiles").update({ phone }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-internal-user] unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
