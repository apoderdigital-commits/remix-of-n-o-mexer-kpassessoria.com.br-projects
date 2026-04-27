import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: toDelete, error } = await supabase
      .from("profiles")
      .select("user_id, email, deleted_at")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (error) throw error;

    let purged = 0;
    for (const p of toDelete ?? []) {
      try {
        await supabase.from("user_dashboard_access").delete().eq("user_id", p.user_id);
        await supabase.from("user_client_access").delete().eq("user_id", p.user_id);
        await supabase.from("user_roles").delete().eq("user_id", p.user_id);
        await supabase.from("profiles").delete().eq("user_id", p.user_id);
        await supabase.auth.admin.deleteUser(p.user_id);
        purged++;
      } catch (e) {
        console.error(`Failed to purge user ${p.user_id}:`, e);
      }
    }

    console.log(`Purged ${purged} user(s) older than 7 days`);

    return new Response(
      JSON.stringify({ purged, candidates: toDelete?.length ?? 0 }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("purge-deleted-users error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
