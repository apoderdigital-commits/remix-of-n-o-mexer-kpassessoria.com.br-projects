import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Segredo compartilhado com o n8n. Se a env estiver definida, passa a ser exigido.
const WEBHOOK_SECRET = Deno.env.get("QUALIFIED_LEADS_SECRET") || "";

const VALID_STATUSES = ["cpf_approved", "sale", "sale_consortium", "sale_financing"] as const;
type LeadStatus = (typeof VALID_STATUSES)[number];

// Mesma regra da planilha (sync-google-sheet): aceita o texto cru da etapa do
// pipeline que o n8n já monta hoje (ex.: "Cpf Aprovado/Qualificado"), além do enum.
function mapStatus(raw: string): LeadStatus | null {
  const lower = (raw || "").toLowerCase().trim();
  if (!lower) return null;
  if ((VALID_STATUSES as readonly string[]).includes(lower)) return lower as LeadStatus;
  if (lower.includes("cpf aprovado") || lower.includes("cpf_aprovado")) return "cpf_approved";
  if (lower.includes("consórcio") || lower.includes("consorcio")) return "sale_consortium";
  if (
    lower.includes("financiamento") ||
    lower.includes("cartão") || lower.includes("cartao") ||
    lower.includes("à vista") || lower.includes("a vista")
  ) return "sale_financing";
  if (lower.includes("venda")) return "sale";
  return null;
}

// Aceita "24/07/2026, 12:50:55" (toLocaleString pt-BR do n8n) ou ISO.
function parseDate(raw: string): string {
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return new Date().toISOString().split("T")[0];
}

// Primeiro valor não-vazio entre várias chaves possíveis do payload.
function pick(body: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "null") {
      return String(v).trim();
    }
  }
  return "";
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (WEBHOOK_SECRET) {
      const sent = pick(body, ["secret"]) || req.headers.get("x-webhook-secret") || "";
      if (sent !== WEBHOOK_SECRET) return json({ error: "Segredo inválido" }, 401);
    }

    // A loja pode vir pelo UUID direto ou — melhor — pelo location do GHL,
    // assim o mesmo nó do n8n serve para todas as subcontas sem editar nada.
    let client_id = pick(body, ["client_id", "clientId"]);
    if (!client_id) {
      const locationId = pick(body, ["location_id", "ghl_location_id", "locationId"]);
      if (!locationId) {
        return json({ error: "Informe client_id ou location_id (GHL)" }, 400);
      }
      const { data: cli } = await supabase
        .from("clients")
        .select("id")
        .eq("ghl_location_id", locationId)
        .is("deleted_at", null)
        .limit(1);
      if (!cli || cli.length === 0) {
        return json(
          { error: `Nenhum cliente com ghl_location_id = "${locationId}". Cadastre o Location ID na tela de Clientes.` },
          404
        );
      }
      client_id = cli[0].id as string;
    }

    const creative_name = pick(body, [
      "creative_name", "url_criativo", "URL_CRIATIVO", "creative_url", "url",
    ]);
    if (!creative_name) {
      return json({ error: "creative_name (URL do criativo) é obrigatório" }, 400);
    }

    const statusRaw = pick(body, ["status", "tipo_de_evento", "TIPO_DE_EVENTO", "tipo", "evento", "pipeline_stage"]);
    const status = mapStatus(statusRaw);
    if (!status) {
      return json(
        { error: `Evento não reconhecido: "${statusRaw}". Esperado algo como "Cpf Aprovado", "Venda Financiamento" ou "Consórcio".` },
        400
      );
    }

    const seller_name = pick(body, ["seller_name", "nome_do_vendedor", "NOME_DO_VENDEDOR", "vendedor", "owner"]) || null;
    const lead_name = pick(body, ["lead_name", "nome_do_cliente", "NOME_DO_CLIENTE", "full_name", "cliente"]) || null;
    const creative_id = pick(body, ["creative_id", "id_criativo", "ID_CRIATIVO", "ad_id", "adId"]) || null;
    const lead_date = parseDate(pick(body, ["lead_date", "data", "DATA", "data_hora", "Data/Hora", "date"]));

    // Dedup igual ao da planilha: mesma pessoa + mesmo tipo de evento = 1 registro.
    if (lead_name) {
      const { data: dupes } = await supabase
        .from("qualified_leads")
        .select("id")
        .eq("client_id", client_id)
        .eq("status", status)
        .ilike("lead_name", lead_name)
        .limit(1);
      if (dupes && dupes.length > 0) {
        return json({ success: true, duplicated: true, status });
      }
    }

    const { error } = await supabase.from("qualified_leads").insert({
      client_id,
      creative_name,
      creative_id,
      status,
      lead_date,
      seller_name,
      lead_name,
      source: "n8n",
    });

    if (error) {
      console.error("Insert error:", error);
      return json({ error: error.message }, 500);
    }

    return json({ success: true, client_id, status, lead_date, seller_name, lead_name });
  } catch (err) {
    console.error("Webhook error:", err);
    return json({ error: "Invalid request body" }, 400);
  }
});
