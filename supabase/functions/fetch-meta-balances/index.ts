import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_API_BASE = "https://graph.facebook.com/v21.0";

// Campos de conta usados: valores monetários vêm em CENTAVOS (dividir por 100).
const ACCOUNT_FIELDS =
  "name,balance,amount_spent,spend_cap,currency,account_status,funding_source_details";

const centsToMoney = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const squad_id: string | undefined = body?.squad_id;
    const client_ids: string[] | undefined = body?.client_ids;

    // Clientes do squad (ou lista explícita), com as credenciais Meta.
    let query = supabase
      .from("clients")
      .select("id, name, meta_account_id, meta_access_token, meta_token_id")
      .is("deleted_at", null);

    if (squad_id) {
      query = query.eq("squad_id", squad_id);
    } else if (Array.isArray(client_ids) && client_ids.length > 0) {
      query = query.in("id", client_ids);
    } else {
      return new Response(
        JSON.stringify({ error: "squad_id ou client_ids é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: clients, error: clientsErr } = await query;
    if (clientsErr) throw clientsErr;

    // Token padrão resolvido no máximo uma vez (fallback).
    let defaultToken: string | null | undefined = undefined;
    const getDefaultToken = async (): Promise<string | null> => {
      if (defaultToken === undefined) {
        const { data } = await supabase
          .from("meta_tokens")
          .select("token")
          .eq("name", "Token Padrão")
          .maybeSingle();
        defaultToken = data?.token ?? null;
      }
      return defaultToken;
    };

    const contas = await Promise.all(
      (clients || []).map(async (c: any) => {
        const base = {
          client_id: c.id,
          name: c.name as string,
          account: (c.meta_account_id as string) || null,
        };

        if (!c.meta_account_id) {
          return { ...base, error: "sem conta de anúncios cadastrada" };
        }

        // Mesma resolução de token da fetch-meta-data: direto -> vinculado -> padrão.
        let token: string | null = c.meta_access_token || null;
        if (!token && c.meta_token_id) {
          const { data: linked } = await supabase
            .from("meta_tokens")
            .select("token")
            .eq("id", c.meta_token_id)
            .maybeSingle();
          token = linked?.token ?? null;
        }
        if (!token) token = await getDefaultToken();
        if (!token) return { ...base, error: "sem token Meta" };

        try {
          const url =
            `${META_API_BASE}/act_${c.meta_account_id}` +
            `?fields=${ACCOUNT_FIELDS}&access_token=${token}`;
          const res = await fetch(url);
          const j = await res.json();
          if (j.error) return { ...base, error: j.error.message };

          const spendCap = j.spend_cap != null ? Number(j.spend_cap) : 0;
          return {
            ...base,
            account_name: j.name || null,
            saldo: centsToMoney(j.balance),
            gasto: centsToMoney(j.amount_spent),
            limite: spendCap > 0 ? centsToMoney(spendCap) : null,
            currency: j.currency || "BRL",
            status: j.account_status ?? null,
            forma_pagamento: j.funding_source_details?.display_string ?? null,
          };
        } catch (e: any) {
          return { ...base, error: e?.message || "falha ao consultar a Meta" };
        }
      })
    );

    return new Response(
      JSON.stringify({ success: true, contas, atualizado_em: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-meta-balances error:", err);
    return new Response(
      JSON.stringify({ error: (err as any)?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
