import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_API_BASE = "https://graph.facebook.com/v21.0";

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

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("meta_account_id, meta_access_token")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!client.meta_account_id || !client.meta_access_token) {
      return new Response(
        JSON.stringify({ error: "Client missing Meta Ads credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timeRange = since && until
      ? `&time_range={"since":"${since}","until":"${until}"}`
      : "";

    // Fetch ads with insights
    const url = `${META_API_BASE}/act_${client.meta_account_id}/insights?fields=campaign_name,ad_name,spend,actions&level=ad&action_breakdowns=action_type${timeRange}&access_token=${client.meta_access_token}&limit=500`;

    const metaRes = await fetch(url);
    const metaData = await metaRes.json();

    if (metaData.error) {
      console.error("Meta API error:", metaData.error);
      return new Response(
        JSON.stringify({ error: metaData.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = (metaData.data || []).map((item: any) => {
      const leadAction = (item.actions || []).find(
        (a: any) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
      );
      return {
        client_id,
        campaign_name: item.campaign_name || "",
        ad_name: item.ad_name || "Unknown",
        leads_total: leadAction ? parseInt(leadAction.value, 10) : 0,
        amount_spent: parseFloat(item.spend || "0"),
        date: item.date_start || new Date().toISOString().split("T")[0],
      };
    });

    if (rows.length > 0) {
      // Delete old data for this client in the period, then insert fresh
      if (since && until) {
        await supabase
          .from("meta_campaigns")
          .delete()
          .eq("client_id", client_id)
          .gte("date", since)
          .lte("date", until);
      }

      const { error: insertError } = await supabase
        .from("meta_campaigns")
        .insert(rows);

      if (insertError) {
        console.error("Insert error:", insertError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: rows.length }),
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
