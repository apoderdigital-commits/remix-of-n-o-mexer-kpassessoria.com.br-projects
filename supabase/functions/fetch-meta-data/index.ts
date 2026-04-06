import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_API_BASE = "https://graph.facebook.com/v21.0";

// Action types that count as "leads" — covers multiple campaign objectives
const LEAD_ACTION_TYPES = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_web_lead",
  "onsite_web_app_lead",
  // Messaging / WhatsApp conversations
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply",
  "offsite_conversion.messaging_conversation_started_7d",
  // Generic results (covers "Conversas por mensagem" objective)
  "messaging_conversation_started_7d",
  "messaging_first_reply",
];

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

    // Fetch ads insights — include action_breakdowns to see all action types
    const url = `${META_API_BASE}/act_${client.meta_account_id}/insights?fields=campaign_name,ad_name,spend,actions&level=ad&time_increment=1${timeRange}&access_token=${client.meta_access_token}&limit=500`;

    const metaRes = await fetch(url);
    const metaData = await metaRes.json();

    if (metaData.error) {
      console.error("Meta API error:", metaData.error);
      return new Response(
        JSON.stringify({ error: metaData.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log all action types found for debugging
    const allActionTypes = new Set<string>();
    (metaData.data || []).forEach((item: any) => {
      (item.actions || []).forEach((a: any) => {
        allActionTypes.add(a.action_type);
      });
    });
    console.log("Action types found:", [...allActionTypes]);

    const rows = (metaData.data || []).map((item: any) => {
      // Sum all matching lead/conversation action types
      let totalLeads = 0;
      const matchedTypes: string[] = [];
      for (const action of item.actions || []) {
        if (LEAD_ACTION_TYPES.includes(action.action_type)) {
          totalLeads += parseInt(action.value, 10);
          matchedTypes.push(action.action_type);
        }
      }

      // Fallback: if no specific lead type matched, use the campaign result count
      // by looking for any "result" type or the first action
      if (totalLeads === 0 && (item.actions || []).length > 0) {
        // Use the first action as fallback (Meta puts the optimization result first)
        const firstAction = item.actions[0];
        totalLeads = parseInt(firstAction.value, 10) || 0;
        matchedTypes.push(`fallback:${firstAction.action_type}`);
      }

      if (matchedTypes.length > 0) {
        console.log(`Ad "${item.ad_name}" → ${totalLeads} leads via: ${matchedTypes.join(", ")}`);
      }

      return {
        client_id,
        campaign_name: item.campaign_name || "",
        ad_name: item.ad_name || "Unknown",
        leads_total: totalLeads,
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
      } else {
        // If no period specified, delete all for this client to avoid duplicates
        const dates = rows.map((r: any) => r.date);
        const minDate = dates.sort()[0];
        const maxDate = dates.sort().reverse()[0];
        await supabase
          .from("meta_campaigns")
          .delete()
          .eq("client_id", client_id)
          .gte("date", minDate)
          .lte("date", maxDate);
      }

      const { error: insertError } = await supabase
        .from("meta_campaigns")
        .insert(rows);

      if (insertError) {
        console.error("Insert error:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: rows.length,
        action_types_found: [...allActionTypes],
        total_leads: rows.reduce((sum: number, r: any) => sum + r.leads_total, 0),
        total_spent: rows.reduce((sum: number, r: any) => sum + r.amount_spent, 0),
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
