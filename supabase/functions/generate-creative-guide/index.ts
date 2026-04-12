const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KP_TEMPLATE = `
Você é um especialista em roteiros de criativos para anúncios de consórcio automotivo. Siga rigorosamente o template KP abaixo.

## REGRAS GERAIS DO TEMPLATE KP

### Estrutura obrigatória de todo criativo:
1. **GANCHO** (primeiros 3-5 segundos) — Deve ser IMPACTANTE. Começar com preço, condição ou dado surpreendente. NUNCA abrir com "carro", "moto" ou nome do veículo.
2. **EXPLICAÇÃO TÉCNICA** — Detalhar a condição, parcela, entrada, ou mecânica do consórcio de forma clara e direta.
3. **QUEBRA DE OBJEÇÃO** — Antecipar e responder a principal dúvida/objeção do público.
4. **CTA (Call to Action)** — Chamada clara para ação: "clique no link", "mande mensagem", "comente aqui".

### Regras de linguagem:
- Linguagem DIRETA, como se estivesse falando com um amigo
- Frases curtas e impactantes
- Usar números sempre que possível (preço, parcela, % de desconto)
- Os primeiros 3-5 segundos decidem se o usuário vai assistir — NUNCA desperdice

### 5 TIPOS DE GUIA:

**TIPO 1 — Motos/Carros Específicos**
Foco em um modelo específico com condição atrativa. Gancho com preço/parcela impactante.

**TIPO 2 — Chamada para Loja/Evento**
Criar urgência para visita presencial. Gancho com oferta limitada ou evento especial.

**TIPO 3 — Quebra de Objeção**
Criativo inteiro focado em destruir uma objeção comum (ex: "consórcio demora", "precisa de entrada alta").

**TIPO 4 — Engajamento/Interação**
Formato que gera comentários e compartilhamentos. Perguntas, enquetes, desafios.

**TIPO 5 — Evento/Data Especial**
Aproveitar datas comemorativas ou eventos para criar urgência e relevância.
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { creativeUrl, category, count, percentage } = await req.json();

    if (!creativeUrl) {
      return new Response(JSON.stringify({ error: "creativeUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Unfurl the creative URL to get og:video or og:image
    let mediaUrl: string | null = null;
    let mediaType: "video" | "image" | null = null;
    let ogTitle: string | null = null;

    try {
      const unfurlRes = await fetch(creativeUrl, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Lovable/1.0; +https://lovable.dev)",
        },
      });
      const html = await unfurlRes.text();

      // Try og:video first
      const videoMatch = html.match(/<meta[^>]*property=["']og:video["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:video["']/i);
      if (videoMatch) {
        mediaUrl = videoMatch[1];
        mediaType = "video";
      }

      // Fallback to og:image
      if (!mediaUrl) {
        const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        if (imgMatch) {
          mediaUrl = imgMatch[1];
          mediaType = "image";
        }
      }

      // Get title
      const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (titleMatch) {
        ogTitle = titleMatch[1];
      }
    } catch (e) {
      console.log("Unfurl failed, will analyze by name only:", e);
    }

    // Step 2: Build the multimodal message
    const categoryLabel = category === "cpf" ? "CPF Aprovado" : category === "consortium" ? "Venda Consórcio" : "Venda Financiamento";

    const userPrompt = `Analise o criativo abaixo e gere um GUIA COMPLETO DE VARIAÇÕES seguindo os 5 tipos do template KP.

**Criativo analisado:** ${ogTitle || creativeUrl}
**URL:** ${creativeUrl}
**Categoria de performance:** ${categoryLabel}
**Resultados:** ${count} conversões (${percentage?.toFixed(1) || "N/A"}% do total)

${mediaUrl ? `A mídia do criativo está anexada (${mediaType}). Analise o conteúdo visual/auditivo para entender o que está funcionando neste criativo.` : "Não foi possível extrair a mídia. Analise pelo título e URL do criativo."}

Para CADA um dos 5 tipos de guia, crie:
1. Um roteiro completo com GANCHO, EXPLICAÇÃO TÉCNICA, QUEBRA DE OBJEÇÃO e CTA
2. Explique por que essa variação funcionaria baseado no criativo original
3. Use dados e números específicos quando possível

Responda em português brasileiro. Formate em markdown com headers claros para cada tipo.`;

    const userContent: any[] = [{ type: "text", text: userPrompt }];

    if (mediaUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: mediaUrl },
      });
    }

    // Step 3: Call AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: KP_TEMPLATE },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos nas configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      return new Response(JSON.stringify({ error: "Erro ao gerar guia com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await aiResponse.json();
    const guide = result.choices?.[0]?.message?.content || "Não foi possível gerar o guia.";

    return new Response(JSON.stringify({ guide, mediaType, mediaUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Generate guide error:", err);
    return new Response(JSON.stringify({ error: "Erro interno ao gerar guia" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
