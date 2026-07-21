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
    const { client_id, since, until, assigned_to } = await req.json();
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

    // Lista de vendedores (usuarios) da subconta — para o dropdown do filtro por vendedor.
    const fetchUsers = async (): Promise<{ id: string; name: string }[]> => {
      try {
        const r = await fetch(`${GHL_BASE}/users/?locationId=${client.ghl_location_id}`, { headers: ghlHeaders });
        if (!r.ok) return [];
        const j = await r.json();
        return (j.users || []).map((u: any) => ({
          id: u.id,
          name: u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id,
        }));
      } catch { return []; }
    };

    // Contatos atribuidos a um vendedor (paginado).
    const sellerContactIds = async (uid: string): Promise<Set<string>> => {
      const ids = new Set<string>();
      let url: string | null = `${GHL_BASE}/contacts/?locationId=${client.ghl_location_id}&assignedTo=${uid}&limit=100`;
      let guard = 0;
      while (url && guard < 60) {
        const r = await fetch(url, { headers: ghlHeaders });
        if (!r.ok) break;
        const j = await r.json();
        for (const c of (j.contacts || [])) if (c.id) ids.add(c.id);
        url = j.meta?.nextPageUrl || null;
        guard++;
      }
      return ids;
    };

    // Todas as oportunidades do pipeline no periodo (contactId + estagio).
    const fetchAllOpps = async (): Promise<{ contactId: string | null; stageId: string }[]> => {
      const out: { contactId: string | null; stageId: string }[] = [];
      let startAfterId: string | null = null, startAfter: string | null = null, guard = 0;
      while (guard < 60) {
        const p = new URLSearchParams({ location_id: client.ghl_location_id, pipeline_id: pipeline.id, limit: "100" });
        if (since) { const [y, m, d] = since.split("-"); p.set("date", `${m}-${d}-${y}`); }
        if (until) { const [y, m, d] = until.split("-"); p.set("endDate", `${m}-${d}-${y}`); }
        if (startAfterId) p.set("startAfterId", startAfterId);
        if (startAfter) p.set("startAfter", startAfter);
        const r = await fetch(`${GHL_BASE}/opportunities/search?${p.toString()}`, { headers: ghlHeaders });
        if (!r.ok) break;
        const j = await r.json();
        const batch = j.opportunities || [];
        for (const o of batch) out.push({ contactId: o.contactId ?? null, stageId: o.pipelineStageId });
        startAfterId = j.meta?.startAfterId ?? null;
        startAfter = j.meta?.startAfter ?? null;
        guard++;
        if (!startAfterId || batch.length < 100) break;
      }
      return out;
    };

    const users = await fetchUsers();

    let simulacoes: number, cpfAprovado: number, cpfNaoAprovado: number, vendasFinanc: number, vendasConsorcio: number, totalPipelineLeads: number;

    if (assigned_to) {
      // Por vendedor: leads = oportunidades cujo CONTATO esta atribuido a esse vendedor (1 dono por lead).
      const [contactSet, allOpps] = await Promise.all([sellerContactIds(assigned_to), fetchAllOpps()]);
      const mine = allOpps.filter((o) => o.contactId && contactSet.has(o.contactId));
      const cnt = (ids: string[]) => mine.filter((o) => ids.includes(o.stageId)).length;
      simulacoes = cnt(simulacaoStageIds);
      cpfAprovado = cnt(cpfAprovadoStageIds);
      cpfNaoAprovado = cnt(cpfNaoAprovadoStageIds);
      vendasFinanc = cnt(vendasFinancIds);
      vendasConsorcio = cnt(vendasConsorcioIds);
      totalPipelineLeads = mine.length;
    } else {
      [simulacoes, cpfAprovado, cpfNaoAprovado, vendasFinanc, vendasConsorcio, totalPipelineLeads] =
        await Promise.all([
          countForStages(simulacaoStageIds),
          countForStages(cpfAprovadoStageIds),
          countForStages(cpfNaoAprovadoStageIds),
          countForStages(vendasFinancIds),
          countForStages(vendasConsorcioIds),
          countPipelineTotal(),
        ]);
    }

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
        users,
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
