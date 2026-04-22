import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Image as ImageIcon, Facebook, Instagram, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

type Platform = "instagram" | "facebook" | "other";

function detectPlatform(url: string): Platform {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, "").toLowerCase();
    if (host.includes("instagram.com") || host === "instagr.am") return "instagram";
    if (host.includes("facebook.com") || host === "fb.me" || host === "fb.watch") return "facebook";
    return "other";
  } catch {
    return "other";
  }
}

function normalizeInstagramUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    let path = u.pathname;
    if (!path.endsWith("/")) path += "/";
    return `${u.origin}${path}`;
  } catch {
    return url;
  }
}

/**
 * Facebook plugin requires canonical www.facebook.com URLs.
 * Converts m.facebook.com → www.facebook.com, strips tracking params,
 * and tries to resolve common shortlink patterns.
 */
function normalizeFacebookUrl(url: string): string {
  try {
    const u = new URL(url);
    // Force www subdomain
    if (u.hostname === "m.facebook.com" || u.hostname === "mobile.facebook.com") {
      u.hostname = "www.facebook.com";
    }
    if (u.hostname === "facebook.com") {
      u.hostname = "www.facebook.com";
    }
    // Strip tracking parameters that confuse the plugin
    const allowedParams = ["v", "story_fbid", "id", "fbid"];
    const newSearch = new URLSearchParams();
    u.searchParams.forEach((value, key) => {
      if (allowedParams.includes(key)) newSearch.set(key, value);
    });
    u.search = newSearch.toString();
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

function loadInstagramScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.instgrm) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[src*="instagram.com/embed.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    s.onload = () => resolve();
    document.body.appendChild(s);
  });
}

interface CreativePreviewDialogProps {
  url: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreativePreviewDialog({ url, open, onOpenChange }: CreativePreviewDialogProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fallbackPreview, setFallbackPreview] = useState<{ image: string | null; title: string | null } | null>(null);

  const platform = resolvedUrl ? detectPlatform(resolvedUrl) : "other";

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    setLoading(true);
    setResolvedUrl(null);
    setFallbackPreview(null);

    (async () => {
      let finalUrl = url;
      const initialPlatform = detectPlatform(url);

      // Always resolve Facebook short links (fb.me / fb.watch) and unknowns through unfurl
      try {
        const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
        const needsUnfurl =
          host === "fb.me" ||
          host === "fb.watch" ||
          initialPlatform === "facebook" ||
          initialPlatform === "other";

        if (needsUnfurl) {
          const { data } = await supabase.functions.invoke("unfurl-url", { body: { url } });
          if (data?.finalUrl) finalUrl = data.finalUrl;
          if (data) {
            setFallbackPreview({ image: data.image ?? null, title: data.title ?? null });
          }
        }
      } catch {
        // ignore — we'll fall back to the original URL
      }

      if (cancelled) return;

      // Normalize for embed
      const finalPlatform = detectPlatform(finalUrl);
      if (finalPlatform === "facebook") {
        finalUrl = normalizeFacebookUrl(finalUrl);
      }

      setResolvedUrl(finalUrl);

      if (finalPlatform === "instagram") {
        await loadInstagramScript();
        if (!cancelled) {
          setTimeout(() => window.instgrm?.Embeds.process(), 50);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  const PlatformIcon =
    platform === "instagram" ? Instagram : platform === "facebook" ? Facebook : Link2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] w-[92vw] max-h-[90vh] overflow-hidden p-0 gap-0 border-border/40 bg-card/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="px-5 py-4 border-b border-border/30 flex-row items-center justify-between space-y-0 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <PlatformIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold leading-tight">Preview do criativo</DialogTitle>
              <p className="text-[11px] text-muted-foreground capitalize leading-tight mt-0.5">
                {platform === "other" ? "Link externo" : platform}
              </p>
            </div>
          </div>
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-7"
            >
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-border/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary">
                Abrir original <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-72px)] bg-muted/20">
          <div className="p-5 min-h-[300px]">
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-[450px] w-full rounded-lg" />
              </div>
            )}

            {!loading && resolvedUrl && platform === "instagram" && (
              <blockquote
                key={resolvedUrl}
                className="instagram-media"
                data-instgrm-permalink={normalizeInstagramUrl(resolvedUrl)}
                data-instgrm-version="14"
                style={{ background: "#FFF", border: 0, margin: "0 auto", maxWidth: 540, width: "100%", borderRadius: 12, overflow: "hidden" }}
              />
            )}

            {!loading && resolvedUrl && platform === "facebook" && (
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden border border-border/30 bg-white">
                  <iframe
                    key={resolvedUrl}
                    src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(
                      resolvedUrl
                    )}&show_text=true&width=540`}
                    width="100%"
                    height="600"
                    style={{ border: "none", overflow: "hidden", display: "block" }}
                    scrolling="no"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                {fallbackPreview?.image && (
                  <div className="rounded-lg border border-border/30 p-3 bg-card/50">
                    <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide">
                      Caso o post não carregue acima:
                    </p>
                    <img
                      src={fallbackPreview.image}
                      alt={fallbackPreview.title ?? ""}
                      className="w-full max-h-[300px] object-contain rounded-md"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                    {fallbackPreview.title && (
                      <p className="text-sm font-medium mt-2">{fallbackPreview.title}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {!loading && resolvedUrl && platform === "other" && (
              <div className="space-y-3">
                {fallbackPreview?.image ? (
                  <div className="rounded-lg overflow-hidden border border-border/30 bg-card/50">
                    <img
                      src={fallbackPreview.image}
                      alt={fallbackPreview.title ?? ""}
                      className="w-full max-h-[400px] object-contain"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] bg-muted/30 rounded-lg border border-border/30">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                {fallbackPreview?.title && (
                  <p className="text-sm font-medium">{fallbackPreview.title}</p>
                )}
                <p className="text-xs text-muted-foreground break-all bg-muted/30 rounded-md px-3 py-2 border border-border/30">
                  {resolvedUrl}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
