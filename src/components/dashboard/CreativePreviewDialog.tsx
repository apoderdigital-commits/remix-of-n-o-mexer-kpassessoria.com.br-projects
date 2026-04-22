import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

type Platform = "instagram" | "facebook" | "other";

function detectPlatform(url: string): Platform {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
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

      // Resolve fb.me redirects via unfurl-url
      try {
        const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
        if (host === "fb.me" || host === "fb.watch" || initialPlatform === "other") {
          const { data } = await supabase.functions.invoke("unfurl-url", { body: { url } });
          if (data?.finalUrl) finalUrl = data.finalUrl;
          if (initialPlatform === "other" && data) {
            setFallbackPreview({ image: data.image ?? null, title: data.title ?? null });
          }
        }
      } catch {
        // ignore
      }

      if (cancelled) return;
      setResolvedUrl(finalUrl);

      const finalPlatform = detectPlatform(finalUrl);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] w-[90vw] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-4 py-3 border-b border-border/30 flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base">Preview do criativo</DialogTitle>
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-8"
            >
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Abrir original <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </DialogHeader>

        <div className="p-4 min-h-[300px]">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-[400px] w-full" />
            </div>
          )}

          {!loading && resolvedUrl && platform === "instagram" && (
            <blockquote
              key={resolvedUrl}
              className="instagram-media"
              data-instgrm-permalink={normalizeInstagramUrl(resolvedUrl)}
              data-instgrm-version="14"
              style={{ background: "#FFF", border: 0, margin: "0 auto", maxWidth: 540, width: "100%" }}
            />
          )}

          {!loading && resolvedUrl && platform === "facebook" && (
            <iframe
              src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(
                resolvedUrl
              )}&show_text=true&width=500`}
              width="100%"
              height="600"
              style={{ border: "none", overflow: "hidden" }}
              scrolling="no"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
          )}

          {!loading && resolvedUrl && platform === "other" && (
            <div className="space-y-3">
              {fallbackPreview?.image ? (
                <img
                  src={fallbackPreview.image}
                  alt={fallbackPreview.title ?? ""}
                  className="w-full max-h-[400px] object-contain rounded-md border border-border/30"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <div className="flex items-center justify-center h-[200px] bg-muted/30 rounded-md border border-border/30">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              {fallbackPreview?.title && (
                <p className="text-sm font-medium">{fallbackPreview.title}</p>
              )}
              <p className="text-xs text-muted-foreground break-all">{resolvedUrl}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
