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
    const isSiteAdmin = !!roles?.length;

    // Fase 2: admin de subconta do CRM também pode criar/editar usuários,
    // mas apenas dentro da(s) subconta(s) que ele administra e com escopo restrito
    // (role='client', dashboards ⊆ ['crm'], sem client_ids, apenas crm_links da subconta dele).
    let crmAdminSubcontas: string[] = [];
    if (!isSiteAdmin) {
      const { data: crmAdminRows } = await adminClient
        .from("crm_users").select("cliente_id").eq("auth_user_id", user.id).eq("papel", "admin");
      crmAdminSubcontas = (crmAdminRows || []).map((r: any) => r.cliente_id).filter(Boolean);
      if (!crmAdminSubcontas.length) {
        return new Response(JSON.stringify({ error: "Sem permissão para gerenciar usuários" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Aplica o escopo do admin de subconta em cima do body recebido.
    const enforceCrmAdminScope = (b: any) => {
      if (isSiteAdmin) return b;
      const links = Array.isArray(b.crm_links) ? b.crm_links : [];
      const filtered = links.filter((l: any) => l && crmAdminSubcontas.includes(l.cliente_id));
      if (!filtered.length) {
        throw new Error("Admin de subconta só pode gerenciar vínculos da(s) subconta(s) dele.");
      }
      return {
        ...b,
        role: "client",
        dashboard_keys: ["crm"],
        client_ids: [],
        squad_function: null,
        crm_links: filtered,
      };
    };

    const rawBody = await req.json();

    // Ações destrutivas globais ficam exclusivas do admin do site.
    const globalOnlyActions = new Set(["delete", "soft_delete", "restore", "purge"]);
    if (!isSiteAdmin && globalOnlyActions.has(rawBody.action)) {
      return new Response(JSON.stringify({ error: "Ação restrita ao admin do site" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = enforceCrmAdminScope(rawBody);
    } catch (scopeErr: any) {
      return new Response(JSON.stringify({ error: scopeErr.message }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sincroniza vínculos crm_users com o array recebido (insert/update/delete diff).
    async function syncCrmLinks(
      targetUserId: string,
      links: Array<{ cliente_id: string; papel?: string; permissoes?: Record<string, boolean> }>,
      identity: { full_name?: string | null; email?: string | null },
    ) {
      // Admin de subconta só mexe nas subcontas dele; agência mexe em qualquer uma.
      const scoped = isSiteAdmin
        ? links
        : links.filter((l) => crmAdminSubcontas.includes(l.cliente_id));

      const { data: existing } = await adminClient
        .from("crm_users")
        .select("id, cliente_id")
        .eq("auth_user_id", targetUserId);
      const existingMap = new Map<string, string>();
      for (const r of (existing || []) as any[]) existingMap.set(r.cliente_id, r.id);

      const incomingIds = new Set(scoped.map((l) => l.cliente_id));

      // Remove vínculos que sumiram (apenas dentro do escopo do chamador).
      const toRemove = (existing || []).filter((r: any) => {
        if (!incomingIds.has(r.cliente_id)) {
          if (!isSiteAdmin && !crmAdminSubcontas.includes(r.cliente_id)) return false;
          return true;
        }
        return false;
      });
      for (const r of toRemove as any[]) {
        await adminClient.from("crm_users").delete().eq("id", r.id);
      }

      // Upserts
      for (const l of scoped) {
        const papel = l.papel === "admin" ? "admin" : "usuario";
        const permissoes = papel === "admin" ? {} : (l.permissoes || {});
        const existingId = existingMap.get(l.cliente_id);
        if (existingId) {
          await adminClient.from("crm_users").update({
            papel, permissoes,
            nome: identity.full_name || null,
            email: identity.email || null,
          }).eq("id", existingId);
        } else {
          await adminClient.from("crm_users").insert({
            auth_user_id: targetUserId,
            cliente_id: l.cliente_id,
            nome: identity.full_name || null,
            email: identity.email || null,
            papel, permissoes,
          });
        }
      }
    }

    // UPDATE existing user (profile/access/role and optional auth password)
    if ((body.action === "update" || body.action === "update_user") && body.user_id) {
      const { user_id, password, full_name, role, dashboard_keys, client_ids, phone, squad_function, crm_links } = body;

      if (password && String(password).length < 6) {
        return new Response(JSON.stringify({ error: "A senha precisa ter no mínimo 6 caracteres" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authUpdate: Record<string, unknown> = {};
      if (password) authUpdate.password = String(password);
      if (full_name !== undefined) authUpdate.user_metadata = { full_name: full_name || "" };

      if (Object.keys(authUpdate).length > 0) {
        const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(user_id, authUpdate);
        if (authUpdateError) {
          return new Response(JSON.stringify({ error: authUpdateError.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Admin do site substitui dashboards/clientes/role integralmente; admin de
      // subconta CRM não pode mexer nesses vínculos globais.
      if (isSiteAdmin) {
        await adminClient.from("user_dashboard_access").delete().eq("user_id", user_id);
        await adminClient.from("user_client_access").delete().eq("user_id", user_id);
        if (dashboard_keys?.length) {
          await adminClient.from("user_dashboard_access").insert(
            dashboard_keys.map((dk: string) => ({ user_id, dashboard_key: dk }))
          );
        }
        if (client_ids?.length) {
          await adminClient.from("user_client_access").insert(
            client_ids.map((cid: string) => ({ user_id, client_id: cid }))
          );
        }
        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        if (role) await adminClient.from("user_roles").insert({ user_id, role });

        const profileUpdate: Record<string, unknown> = {
          full_name: full_name || null,
          phone: String(phone || "").trim() || null,
          squad_function: squad_function || null,
        };
        const { error: profileError } = await adminClient
          .from("profiles").update(profileUpdate).eq("user_id", user_id);
        if (profileError) {
          return new Response(JSON.stringify({ error: profileError.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (Array.isArray(crm_links)) {
        await syncCrmLinks(user_id, crm_links, {
          full_name: full_name ?? null,
          email: null, // mantém o email já existente na linha (não sobrescreve)
        });
      }

      return new Response(JSON.stringify({ success: true, action: "update_user", user_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SOFT DELETE (move to trash for 7 days)
    if ((body.action === "delete" || body.action === "soft_delete") && body.user_id) {
      await adminClient
        .from("profiles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", body.user_id);
      await adminClient.auth.admin.updateUserById(body.user_id, {
        ban_duration: "876000h",
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

    // PURGE definitive
    if (body.action === "purge" && body.user_id) {
      await adminClient.from("user_dashboard_access").delete().eq("user_id", body.user_id);
      await adminClient.from("user_client_access").delete().eq("user_id", body.user_id);
      await adminClient.from("user_roles").delete().eq("user_id", body.user_id);
      await adminClient.from("crm_users").delete().eq("auth_user_id", body.user_id);
      await adminClient.from("profiles").delete().eq("user_id", body.user_id);
      await adminClient.auth.admin.deleteUser(body.user_id);
      return new Response(JSON.stringify({ success: true, action: "purge" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE action
    const { username, password, full_name, role, dashboard_keys, client_ids, phone, crm_links } = body;
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

    if (role) {
      await adminClient.from("user_roles").insert({ user_id: userId, role });
    }

    // Herda o dashboard "crm" quando o usuário tem vínculo de subconta e nenhum
    // dashboard foi passado explicitamente.
    const finalDashboards: string[] = Array.isArray(dashboard_keys) ? [...dashboard_keys] : [];
    if (Array.isArray(crm_links) && crm_links.length > 0 && !finalDashboards.includes("crm")) {
      finalDashboards.push("crm");
    }
    if (finalDashboards.length) {
      await adminClient.from("user_dashboard_access").insert(
        finalDashboards.map((dk: string) => ({ user_id: userId, dashboard_key: dk }))
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

    if (Array.isArray(crm_links) && crm_links.length) {
      await syncCrmLinks(userId, crm_links, { full_name: full_name || String(username), email });
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
