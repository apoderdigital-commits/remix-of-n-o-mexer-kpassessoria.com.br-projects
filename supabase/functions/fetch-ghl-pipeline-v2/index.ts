import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("ghl_api_key, ghl_location_id, ghl_stage_mapping")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!client.ghl_api_key || !client.ghl_location_id) {
      return new Response(JSON.stringify({ error: "GHL not configured for this client" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghlHeaders = {
      Authorization: `Bearer ${client.ghl_api_key}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    };

    // 1. Get pipelines
    const pipelinesRes = await fetch(
      `${GHL_BASE}/opportunities/pipelines?locationId=${client.ghl_location_id}`,
      { headers: ghlHeaders }
    );

    if (!pipelinesRes.ok) {
      const errBody = await pipelinesRes.text();
      console.error("GHL pipelines error:", pipelinesRes.status, errBody);
      return new Response(
        JSON.stringify({ error: `GHL API error: ${pipelinesRes.status}`, details: errBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pipelinesData = await pipelinesRes.json();
    const pipelines = pipelinesData.pipelines || [];

    if (pipelines.length === 0) {
      return new Response(JSON.stringify({ error: "No pipelines found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Manual mapping (preferred) ----
    const mapping = (client.ghl_stage_mapping ?? {}) as {
      pipeline_id?: string;
      cpf_aprovado?: string[];
      cpf_nao_aprovado?: string[];
      vendas_financiamento?: string[];
      vendas_consorcio?: string[];
    };

    // Seleção da pipeline:
    // 1) a escolhida explicitamente (pipeline_id)
    // 2) senão, DETECTA automaticamente a pipeline que contém as etapas mapeadas
    //    (conserta sozinho clientes com múltiplas pipelines, sem re-editar)
    // 3) senão, a primeira (comportamento antigo)
    const mappedStageIds = new Set<string>([
      ...(mapping.cpf_aprovado ?? []),
      ...(mapping.cpf_nao_aprovado ?? []),
      ...(mapping.vendas_financiamento ?? []),
      ...(mapping.vendas_consorcio ?? []),
    ]);
    let pipeline: any =
      (mapping.pipeline_id && pipelines.find((p: any) => p.id === mapping.pipeline_id)) || null;
    if (!pipeline && mappedStageIds.size > 0) {
      pipeline =
        pipelines.find((p: any) => (p.stages || []).some((s: any) => mappedStageIds.has(s.id))) || null;
    }
    if (!pipeline) pipeline = pipelines[0];
    const stages = pipeline.stages || [];

    const hasMapping =
      (mapping.cpf_aprovado?.length ?? 0) > 0 ||
      (mapping.cpf_nao_aprovado?.length ?? 0) > 0 ||
      (mapping.vendas_financiamento?.length ?? 0) > 0 ||
      (mapping.vendas_consorcio?.length ?? 0) > 0;

    let cpfAprovadoStageIds: string[] = [];
    let cpfNaoAprovadoStageIds: string[] = [];
    let vendasFinancIds: string[] = [];
    let vendasConsorcioIds: string[] = [];
    let mappingComplete = true;
    let missingMetrics: string[] = [];

    if (hasMapping) {
      cpfAprovadoStageIds = mapping.cpf_aprovado ?? [];
      cpfNaoAprovadoStageIds = mapping.cpf_nao_aprovado ?? [];
      vendasFinancIds = mapping.vendas_financiamento ?? [];
      vendasConsorcioIds = mapping.vendas_consorcio ?? [];

      if (!cpfAprovadoStageIds.length) missingMetrics.push("CPF Aprovado");
      if (!cpfNaoAprovadoStageIds.length) missingMetrics.push("CPF Não Aprovado");
      if (!vendasFinancIds.length) missingMetrics.push("Vendas Financiamento");
      if (!vendasConsorcioIds.length) missingMetrics.push("Vendas Consórcio");
      mappingComplete = missingMetrics.length === 0;
    } else {
      // ---- Fallback: auto-detect by stage name ----
      mappingComplete = false;
      missingMetrics = ["CPF Aprovado", "CPF Não Aprovado", "Vendas Financiamento", "Vendas Consórcio"];

      const cpfAprovadoQualificadoIds: string[] = [];
      const propostaPerdidaIds: string[] = [];
      for (const stage of stages) {
        const name = stage.name.toLowerCase();
        if (
          name.includes("desqualificado") ||
          name.includes("não aprovado") ||
          name.includes("nao aprovado") ||
          name.includes("reprovado")
        ) {
          cpfNaoAprovadoStageIds.push(stage.id);
        } else if (name.includes("proposta perdida")) {
          propostaPerdidaIds.push(stage.id);
        } else if (
          name.includes("cons\u00f3rcio") ||
          name.includes("consorcio")
        ) {
          vendasConsorcioIds.push(stage.id);
        } else if (
          name.includes("vendas financiamento") ||
          name.includes("venda financiamento") ||
          name.includes("\u00e0 vista") ||
          name.includes("a vista") ||
          name.includes("cart\u00e3o") ||
          name.includes("cartao")
        ) {
          vendasFinancIds.push(stage.id);
        } else if (name.includes("qualificado") || name.includes("aprovado")) {
          cpfAprovadoQualificadoIds.push(stage.id);
        }
      }
      cpfAprovadoStageIds = [
        ...cpfAprovadoQualificadoIds,
        ...propostaPerdidaIds,
        ...vendasFinancIds,
        ...vendasConsorcioIds,
      ];
    }

    // Simulação = todos que passaram análise de CPF (aprovado + não aprovado é o universo de simulações)
    const simulacaoStageIds = Array.from(
      new Set([
        ...cpfAprovadoStageIds,
        ...cpfNaoAprovadoStageIds,
        ...vendasFinancIds,
        ...vendasConsorcioIds,
      ])
    );

    const countForStages = async (stageIds: string[]): Promise<number> => {
      let total = 0;
      for (const stageId of stageIds) {
        const params = new URLSearchParams({
          location_id: client.ghl_location_id,
          pipeline_id: pipeline.id,
          pipeline_stage_id: stageId,
          limit: "1",
        });
        if (since) {
          const [y, m, d] = since.split("-");
          params.set("date", `${m}-${d}-${y}`);
        }
        if (until) {
          const [y, m, d] = until.split("-");
          params.set("endDate", `${m}-${d}-${y}`);
        }
        const r = await fetch(
          `${GHL_BASE}/opportunities/search?${params.toString()}`,
          { method: "GET", headers: ghlHeaders }
        );
        if (r.ok) {
          const json = await r.json();
          total += json.meta?.total ?? json.count ?? 0;
        }
      }
      return total;
    };

    // Total de leads da pipeline inteira (todos os estágios = todos que entraram no CRM,
    // inclusive orgânicos). Sem filtro de estágio.
    const countPipelineTotal = async (): Promise<number> => {
      const params = new URLSearchParams({
        location_id: client.ghl_location_id,
        pipeline_id: pipeline.id,
        limit: "1",
      });
      if (since) { const [y, m, d] = since.split("-"); params.set("date", `${m}-${d}-${y}`); }
      if (until) { const [y, m, d] = until.split("-"); params.set("endDate", `${m}-${d}-${y}`); }
      const r = await fetch(`${GHL_BASE}/opportunities/search?${params.toString()}`, { method: "GET", headers: ghlHeaders });
      if (r.ok) { const json = await r.json(); return json.meta?.total ?? json.count ?? 0; }
      return 0;
    };

    const [simulacoes, cpfAprovado, cpfNaoAprovado, vendasFinanc, vendasConsorcio, totalPipelineLeads] =
      await Promise.all([
        countForStages(simulacaoStageIds),
        countForStages(cpfAprovadoStageIds),
        countForStages(cpfNaoAprovadoStageIds),
        countForStages(vendasFinancIds),
        countForStages(vendasConsorcioIds),
        countPipelineTotal(),
      ]);

    return new Response(
      JSON.stringify({
        simulacoes,
        total_pipeline_leads: totalPipelineLeads,
        cpf_aprovado: cpfAprovado,
        cpf_nao_aprovado: cpfNaoAprovado,
        vendas_financiamento: vendasFinanc,
        vendas_consorcio: vendasConsorcio,
        pipeline_name: pipeline.name,
        stages: stages.map((s: any) => ({ id: s.id, name: s.name })),
        mapping_complete: mappingComplete,
        missing_metrics: missingMetrics,
        has_manual_mapping: hasMapping,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("fetch-ghl-pipeline error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
