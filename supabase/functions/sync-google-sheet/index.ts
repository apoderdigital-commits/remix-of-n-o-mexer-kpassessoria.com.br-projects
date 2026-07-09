import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Map spreadsheet event types to our lead_status enum
function mapStatus(tipo: string, extraCpf: string[] = []): "cpf_approved" | "sale" | "sale_consortium" | "sale_financing" | null {
  const lower = tipo.toLowerCase();
  if (lower.includes("cpf aprovado") || extraCpf.some((k) => k && lower.includes(k))) return "cpf_approved";
  if (lower.includes("consórcio") || lower.includes("consorcio")) return "sale_consortium";
  if (lower.includes("financiamento") || lower.includes("cartão") || lower.includes("cartao") || lower.includes("à vista") || lower.includes("a vista")) return "sale_financing";
  if (lower.includes("venda") || lower.includes("vendas")) return "sale";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { client_id, since, until } = await req.json();

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client's google_sheet_id
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("google_sheet_id, sheet_cpf_keywords")
      .eq("id", client_id)
      .single();

    if (clientError || !client?.google_sheet_id) {
      return new Response(
        JSON.stringify({ error: "Client has no Google Sheet configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sheetId = client.google_sheet_id;
    // Palavras-chave extras que contam como "CPF Aprovado" (config por cliente)
    const extraCpf = String((client as any).sheet_cpf_keywords || "")
      .split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean);

    // Fetch sheet as CSV
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch Google Sheet. Make sure it's shared as 'Anyone with the link'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csvText = await csvRes.text();
    const lines = csvText.split("\n").map((line) => {
      // Simple CSV parsing (handles quoted fields)
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });

    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "Sheet is empty or has no data rows" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find column indices from header
    const header = lines[0].map((h) => h.toLowerCase().replace(/[^a-z_]/g, ""));
    const colNome = header.findIndex((h) => h.includes("nome_do_cliente") || h.includes("nomedocliente") || h.includes("cliente"));
    const colVendedor = header.findIndex((h) => h.includes("vendedor") || h.includes("nome_do_vendedor") || h.includes("nomedovendedor"));
    const colTipo = header.findIndex((h) => h.includes("tipo"));
    const colUrl = header.findIndex((h) => h.includes("url_criativo") || h.includes("urlcriativo") || h.includes("url"));
    const colData = header.findIndex((h) => h.includes("data") || h.includes("hora"));

    console.log("Header:", header);
    console.log("Columns found - nome:", colNome, "tipo:", colTipo, "url:", colUrl, "data:", colData);

    if (colTipo === -1 || colUrl === -1) {
      return new Response(
        JSON.stringify({ error: "Could not find required columns (TIPO_DE_EVENTO, URL_CRIATIVO)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows: Array<{
      client_id: string;
      creative_name: string;
      status: "cpf_approved" | "sale" | "sale_consortium" | "sale_financing";
      lead_date: string;
      seller_name: string | null;
    }> = [];

    // Deduplicate: same person + same event type = count only once
    const seen = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i];
      if (!cols || cols.length < 3) continue;

      const nome = colNome !== -1 ? (cols[colNome] || "").trim().toLowerCase() : "";
      const vendedor = colVendedor !== -1 ? (cols[colVendedor] || "").trim() : null;
      const tipo = cols[colTipo] || "";
      const url = cols[colUrl] || "";
      const dataStr = cols[colData] || "";

      const status = mapStatus(tipo, extraCpf);
      if (!status || !url) continue;

      // Dedup key: person name + event type (one person = one event per type)
      if (nome) {
        const dedupKey = `${nome}::${status}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
      }

      // Parse date (format: DD/MM/YYYY, HH:MM:SS)
      let leadDate = new Date().toISOString().split("T")[0];
      if (dataStr) {
        const match = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
          leadDate = `${match[3]}-${match[2]}-${match[1]}`;
        }
      }

      // Filter by date range if provided
      if (since && leadDate < since) continue;
      if (until && leadDate > until) continue;

      rows.push({
        client_id,
        creative_name: url,
        status,
        lead_date: leadDate,
        seller_name: vendedor || null,
      });
    }

    console.log(`Parsed ${rows.length} qualified leads from sheet`);

    // Delete existing leads for this client in the date range, then insert
    if (rows.length > 0) {
      let deleteQuery = supabase
        .from("qualified_leads")
        .delete()
        .eq("client_id", client_id);

      if (since) deleteQuery = deleteQuery.gte("lead_date", since);
      if (until) deleteQuery = deleteQuery.lte("lead_date", until);

      await deleteQuery;

      // Insert in batches
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error: insertError } = await supabase
          .from("qualified_leads")
          .insert(batch);
        if (insertError) {
          console.error(`Insert error batch ${i / 500 + 1}:`, insertError);
        }
      }
    }

    const cpfCount = rows.filter((r) => r.status === "cpf_approved").length;
    const consortiumCount = rows.filter((r) => r.status === "sale_consortium").length;
    const financingCount = rows.filter((r) => r.status === "sale_financing").length;
    const legacySaleCount = rows.filter((r) => r.status === "sale").length;

    return new Response(
      JSON.stringify({
        success: true,
        total: rows.length,
        cpf_approved: cpfCount,
        sale_consortium: consortiumCount,
        sale_financing: financingCount,
        sale_legacy: legacySaleCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
