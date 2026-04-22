import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use a real browser User-Agent so Facebook doesn't bounce us to /login
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    const html = await res.text();
    let finalUrl = res.url;

    // If Facebook bounced us to a login page, extract the real URL from ?next=
    try {
      const u = new URL(finalUrl);
      if (
        (u.hostname.includes("facebook.com") || u.hostname.includes("fb.com")) &&
        u.pathname.startsWith("/login")
      ) {
        const next = u.searchParams.get("next");
        if (next) {
          finalUrl = decodeURIComponent(next);
        }
      }
    } catch {
      // ignore
    }

    // Extract og:image
    let ogImage: string | null = null;
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch) {
      ogImage = ogMatch[1];
    }

    // Extract og:title
    let ogTitle: string | null = null;
    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (titleMatch) {
      ogTitle = titleMatch[1];
    }

    return new Response(
      JSON.stringify({ image: ogImage, title: ogTitle, finalUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unfurl error:", err);
    return new Response(JSON.stringify({ error: "Failed to unfurl URL" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
