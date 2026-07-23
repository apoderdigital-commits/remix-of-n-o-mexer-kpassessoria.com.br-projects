import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_API_BASE = "https://graph.facebook.com/v21.0";

// Campos de conta usados: valores monetários vêm em CENTAVOS (dividir por 100).
const ACCOUNT_FIELDS =
  "name,balance,amount_spent,spend_cap,currency,account_status,funding_source_details{display_string,type,id}";

const centsToMoney = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v) / 100;

// Classifica a forma de pagamento em pré-pago (tem "Saldo disponível") x cartão,
// e, se for pré-pago, extrai o valor disponível do texto da Meta.
// Ex.: "Saldo disponível (R$2.989,60 BRL)" -> { tipo: "prepago", saldo_disponivel: 2989.6 }
//      "Mastercard *3252"                  -> { tipo: "cartao",  saldo_disponivel: null }
function fundingInfo(display: string | null): {
  tipo: "prepago" | "cartao";
  saldo_disponivel: number | null;
} {
  if (!display) return { tipo: "cartao", saldo_disponivel: null };
  const isPrepago = /dispon[ií]vel|pr[eé]-?pag/i.test(display);
  if (!isPrepago) return { tipo: "cartao", saldo_disponivel: null };
  const m = display.match(/R\$\s*([\d.,]+)/);
  let val: number | null = null;
  if (m) {
    let num = m[1];
    // Formato brasileiro: "." milhar, "," decimal.
    if (num.includes(",")) num = num.replace(/\./g, "").replace(",", ".");
    const p = parseFloat(num);
    val = Number.isFinite(p) ? p : null;
  }
  return { tipo: "prepago", saldo_disponivel: val };
}

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
          const forma = j.funding_source_details?.display_string ?? null;
          const funding = fundingInfo(forma);
          return {
            ...base,
            account_name: j.name || null,
            saldo: centsToMoney(j.balance),
            gasto: centsToMoney(j.amount_spent),
            limite: spendCap > 0 ? centsToMoney(spendCap) : null,
            currency: j.currency || "BRL",
            status: j.account_status ?? null,
            forma_pagamento: forma,
            tipo: funding.tipo,
            saldo_disponivel: funding.saldo_disponivel,
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
