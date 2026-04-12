import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const N8N_WEBHOOK_URL = Deno.env.get("N8N_WHATSAPP_WEBHOOK_URL") || 
  "https://kpadm-n8n.a6hrr3.easypanel.host/webhook/4d42e487-02de-410d-92c3-6c855da1525b";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { client_id, creative_url } = body;

    if (!client_id || typeof client_id !== "string") {
      return new Response(JSON.stringify({ error: "client_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!creative_url || typeof creative_url !== "string") {
      return new Response(JSON.stringify({ error: "creative_url obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client phone
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("phone, name")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!client.phone) {
      return new Response(JSON.stringify({ error: "Telefone não cadastrado para este cliente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send to n8n webhook
    const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: client.phone,
        client_name: client.name,
        creative_url,
      }),
    });

    if (!webhookResponse.ok) {
      console.error("n8n webhook error:", await webhookResponse.text());
      return new Response(JSON.stringify({ error: "Erro ao enviar para o webhook" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
