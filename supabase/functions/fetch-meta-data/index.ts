import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_API_BASE = "https://graph.facebook.com/v21.0";

// Priority list: use the FIRST match found (avoid double-counting)
const LEAD_ACTION_PRIORITY = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
  "lead",
  "onsite_conversion.lead_grouped",
  "onsite_web_lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.messaging_first_reply",
  "messaging_first_reply",
];

async function fetchAllPages(initialUrl: string): Promise<any[]> {
  const allData: any[] = [];
  let url: string | null = initialUrl;
  let page = 0;

  while (url) {
    page++;
    console.log(`Fetching page ${page}...`);
    const res = await fetch(url);
    const json = await res.json();

    if (json.error) {
      throw new Error(json.error.message);
    }

    allData.push(...(json.data || []));

    // Check for next page
    url = json.paging?.next || null;
    
    // Safety limit to prevent infinite loops
    if (page >= 20) {
      console.log("Reached page limit (20), stopping pagination");
      break;
    }
  }

  console.log(`Total records fetched: ${allData.length} across ${page} page(s)`);
  return allData;
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

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("meta_account_id, meta_access_token, meta_token_id")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let metaAccessToken = client.meta_access_token;

    if (!metaAccessToken && client.meta_token_id) {
      const { data: linkedToken } = await supabase
        .from("meta_tokens")
        .select("token")
        .eq("id", client.meta_token_id)
        .maybeSingle();

      metaAccessToken = linkedToken?.token ?? null;
    }

    if (!metaAccessToken) {
      const { data: defaultToken } = await supabase
        .from("meta_tokens")
        .select("token")
        .eq("name", "Token Padrão")
        .maybeSingle();

      metaAccessToken = defaultToken?.token ?? null;
    }

    if (!client.meta_account_id || !metaAccessToken) {
      return new Response(
        JSON.stringify({ error: "Client missing Meta Ads credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timeRange = since && until
      ? `&time_range={"since":"${since}","until":"${until}"}`
      : "";

    const initialUrl = `${META_API_BASE}/act_${client.meta_account_id}/insights?fields=campaign_name,ad_name,spend,actions&level=ad&time_increment=1${timeRange}&access_token=${metaAccessToken}&limit=500`;

    // Fetch ALL pages
    let allItems: any[];
    try {
      allItems = await fetchAllPages(initialUrl);
    } catch (err: any) {
      console.error("Meta API error:", err.message);
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log all action types for debugging
    const allActionTypes = new Set<string>();
    allItems.forEach((item: any) => {
      (item.actions || []).forEach((a: any) => {
        allActionTypes.add(a.action_type);
      });
    });
    console.log("Action types found:", [...allActionTypes]);

    const rows = allItems.map((item: any) => {
      // Use PRIORITY: pick the first matching action type only (no double-count)
      let totalLeads = 0;
      let matchedType = "none";

      for (const priorityType of LEAD_ACTION_PRIORITY) {
        const action = (item.actions || []).find(
          (a: any) => a.action_type === priorityType
        );
        if (action) {
          totalLeads = parseInt(action.value, 10);
          matchedType = priorityType;
          break;
        }
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

    const grandTotalLeads = rows.reduce((sum: number, r: any) => sum + r.leads_total, 0);
    const grandTotalSpent = rows.reduce((sum: number, r: any) => sum + r.amount_spent, 0);
    console.log(`Grand total: ${grandTotalLeads} leads, R$ ${grandTotalSpent.toFixed(2)} spent`);

    if (rows.length > 0) {
      if (since && until) {
        await supabase
          .from("meta_campaigns")
          .delete()
          .eq("client_id", client_id)
          .gte("date", since)
          .lte("date", until);
      } else {
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

      // Insert in batches of 500 to avoid payload limits
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error: insertError } = await supabase
          .from("meta_campaigns")
          .insert(batch);

        if (insertError) {
          console.error(`Insert error (batch ${i / 500 + 1}):`, insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: rows.length,
        total_leads: grandTotalLeads,
        total_spent: grandTotalSpent,
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
