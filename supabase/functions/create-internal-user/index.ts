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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
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

    const body = await req.json();

    // DELETE action
    if (body.action === "delete" && body.user_id) {
      await adminClient.from("user_dashboard_access").delete().eq("user_id", body.user_id);
      await adminClient.from("user_client_access").delete().eq("user_id", body.user_id);
      await adminClient.from("user_roles").delete().eq("user_id", body.user_id);
      await adminClient.from("profiles").delete().eq("user_id", body.user_id);
      await adminClient.auth.admin.deleteUser(body.user_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE action
    const { username, password, full_name, role, dashboard_keys, client_ids } = body;
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

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
