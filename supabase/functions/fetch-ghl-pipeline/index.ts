import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("ghl_api_key, ghl_location_id")
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

    const pipeline = pipelines[0];
    const stages = pipeline.stages || [];

    console.log("Pipeline:", pipeline.name, "Stages:", stages.map((s: any) => s.name));

    // Categorize stages
    const cpfAprovadoStageIds: string[] = [];
    const cpfNaoAprovadoStageIds: string[] = [];

    for (const stage of stages) {
      const name = stage.name.toLowerCase();
      if (
        name.includes("desqualificado") ||
        name.includes("não aprovado") ||
        name.includes("nao aprovado") ||
        name.includes("reprovado")
      ) {
        cpfNaoAprovadoStageIds.push(stage.id);
      } else if (
        name.includes("qualificado") ||
        name.includes("aprovado")
      ) {
        cpfAprovadoStageIds.push(stage.id);
      }
    }

    const simulacaoStageIds = [...cpfAprovadoStageIds, ...cpfNaoAprovadoStageIds];

    console.log("Mapped stages - Aprovado:", cpfAprovadoStageIds, "NaoAprovado:", cpfNaoAprovadoStageIds);
    console.log("Date filter:", since, "to", until);

    // 2. Count opportunities per stage, with optional date filtering
    const countForStages = async (stageIds: string[]): Promise<number> => {
      let total = 0;
      for (const stageId of stageIds) {
        const params = new URLSearchParams({
          location_id: client.ghl_location_id,
          pipeline_id: pipeline.id,
          pipeline_stage_id: stageId,
          limit: "1",
        });

        // GHL uses "date" for start and "endDate" for end, format: mm-dd-yyyy
        if (since) {
          const [y, m, d] = since.split("-");
          params.set("date", `${m}-${d}-${y}`);
        }
        if (until) {
          const [y, m, d] = until.split("-");
          params.set("endDate", `${m}-${d}-${y}`);
        }

        const searchRes = await fetch(
          `${GHL_BASE}/opportunities/search?${params.toString()}`,
          { method: "GET", headers: ghlHeaders }
        );

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          console.log("Search result for stage", stageId, ":", JSON.stringify(searchData.meta || {}));
          total += searchData.meta?.total ?? searchData.count ?? 0;
        } else {
          const errText = await searchRes.text();
          console.error("Search failed for stage", stageId, errText);
        }
      }
      return total;
    };

    const [simulacoes, cpfAprovado, cpfNaoAprovado] = await Promise.all([
      countForStages(simulacaoStageIds),
      countForStages(cpfAprovadoStageIds),
      countForStages(cpfNaoAprovadoStageIds),
    ]);

    const result = {
      simulacoes,
      cpf_aprovado: cpfAprovado,
      cpf_nao_aprovado: cpfNaoAprovado,
      pipeline_name: pipeline.name,
      stages: stages.map((s: any) => ({ id: s.id, name: s.name })),
    };

    console.log("GHL result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-ghl-pipeline error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
