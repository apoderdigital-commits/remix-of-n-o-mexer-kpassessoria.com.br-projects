import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, X, Image as ImageIcon, Copy, Trophy, ChevronRight, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreativeGuideButton } from "./CreativeGuideButton";
import { CreativePreviewDialog } from "./CreativePreviewDialog";
const PREVIEW_TIMEOUT_MS = 10000;

function supportsUrlPreview(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return !["fb.me", "wa.me", "api.whatsapp.com"].includes(hostname);
  } catch {
    return false;
  }
}

function decodeHtmlEntities(text: string) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return doc.documentElement.textContent || text;
}

interface CreativeData {
  name: string;
  count: number;
  percentage: number;
}

interface CreativeRankingProps {
  title: string;
  data: CreativeData[];
  color: string;
  category: "cpf" | "consortium" | "financing";
  clientId?: string | null;
  since?: string;
  until?: string;
}

interface PreviewData {
  image: string | null;
  title: string | null;
  finalUrl: string;
}

function FullRankingContent({
  top10,
  color,
  preview,
  previewLoading,
  previewUrl,
  setPreview,
  setPreviewUrl,
  handlePreview,
  isUrl,
  shortenUrl,
  clientId,
  sendingUrl,
  handleSendWhatsApp,
}: {
  top10: CreativeData[];
  color: string;
  preview: PreviewData | null;
  previewLoading: boolean;
  previewUrl: string | null;
  setPreview: (v: PreviewData | null) => void;
  setPreviewUrl: (v: string | null) => void;
  handlePreview: (url: string) => void;
  isUrl: (name: string) => boolean;
  shortenUrl: (url: string) => string;
  clientId?: string | null;
  sendingUrl: string | null;
  handleSendWhatsApp: (url: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Preview panel */}
      {(preview || previewLoading) && (
        <div className="relative rounded-lg border border-border/30 bg-background/50 p-3">
          <button
            onClick={() => { setPreview(null); setPreviewUrl(null); }}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          {previewLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando preview...</span>
            </div>
          ) : preview ? (
            <div className="space-y-2">
              <div className="flex gap-3 items-start">
                {preview.image && (
                  <img
                    src={preview.image}
                    alt=""
                    className="w-28 h-28 object-cover rounded-md flex-shrink-0"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
                <div className="space-y-1 min-w-0 flex-1">
                  {preview.title && (
                    <p className="text-sm font-medium line-clamp-3">
                      {decodeHtmlEntities(preview.title)}
                    </p>
                  )}
                  {!preview.title && !preview.image && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      <span className="text-sm">Preview não disponível para esse link</span>
                    </div>
                  )}
                  <a
                    href={previewUrl || preview.finalUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Abrir criativo <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top10} layout="vertical" margin={{ left: 0, right: 16 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: "hsl(210 40% 98%)", fontSize: 11 }}
              tickFormatter={(v) => {
                if (isUrl(v)) return shortenUrl(v);
                return v.length > 18 ? v.slice(0, 18) + "…" : v;
              }}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(222 40% 10%)",
                border: "1px solid hsl(222 30% 20%)",
                borderRadius: 8,
                color: "hsl(210 40% 98%)",
              }}
              formatter={(value: number) => [value, "Quantidade"]}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {top10.map((_, i) => (
                <Cell key={i} fill={color} fillOpacity={1 - i * 0.07} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-border/30">
            <TableHead className="text-muted-foreground">#</TableHead>
            <TableHead className="text-muted-foreground">Criativo</TableHead>
            <TableHead className="text-right text-muted-foreground">Qtd</TableHead>
            <TableHead className="text-right text-muted-foreground">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {top10.map((item, i) => (
            <TableRow key={item.name} className="border-border/20">
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium max-w-[200px]">
                <div className="flex items-center gap-1">
                  {isUrl(item.name) ? (
                    <>
                      <button
                        onClick={() => handlePreview(item.name)}
                        className={`text-left text-primary hover:underline truncate flex-1 ${
                          previewUrl === item.name ? "underline" : ""
                        }`}
                        title={item.name}
                      >
                        {shortenUrl(item.name)}
                      </button>
                      <button
                        onClick={() => {
                          window.open(item.name, "_blank", "noopener,noreferrer");
                        }}
                        className="flex-shrink-0 p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Abrir em nova aba"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.name);
                          toast.success("Link copiado!");
                        }}
                        className="flex-shrink-0 p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {clientId && (
                        <button
                          onClick={() => handleSendWhatsApp(item.name)}
                          disabled={sendingUrl === item.name}
                          className="flex-shrink-0 p-1 rounded hover:bg-green-500/20 text-green-500 hover:text-green-400 transition-colors disabled:opacity-50"
                          title="Enviar no WhatsApp"
                        >
                          {sendingUrl === item.name ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="truncate block">{item.name}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">{item.count}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {item.percentage.toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CreativeRanking({ title, data, color, category, clientId, since, until }: CreativeRankingProps) {
  const top10 = data.slice(0, 10);
  const isMobile = useIsMobile();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sendingUrl, setSendingUrl] = useState<string | null>(null);

  const handleSendWhatsApp = async (creativeUrl: string) => {
    const item = top10.find(d => d.name === creativeUrl);
    setSendingUrl(creativeUrl);
    try {
      const { data, error } = await supabase.functions.invoke("send-creative-whatsapp", {
        body: {
          creative_url: creativeUrl,
          period_since: since,
          period_until: until,
          category,
          count: item?.count ?? 0,
          percentage: item?.percentage ?? 0,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success("Link enviado no WhatsApp! 📲");
      }
    } catch {
      toast.error("Erro ao enviar para o WhatsApp");
    } finally {
      setSendingUrl(null);
    }
  };

  const handlePreview = async (url: string) => {
    if (previewUrl === url) {
      setPreview(null);
      setPreviewUrl(null);
      return;
    }

    if (!supportsUrlPreview(url)) {
      setPreviewUrl(url);
      setPreview({ image: null, title: null, finalUrl: url });
      return;
    }

    setPreviewLoading(true);
    setPreviewUrl(url);

    try {
      const invokePromise = supabase.functions.invoke("unfurl-url", {
        body: { url },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("preview-timeout")), PREVIEW_TIMEOUT_MS);
      });

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
      if (error) throw error;
      setPreview(data as PreviewData);
    } catch {
      setPreview({ image: null, title: null, finalUrl: url });
    } finally {
      setPreviewLoading(false);
    }
  };

  const isUrl = (name: string) => name.startsWith("http");

  const shortenUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.slice(0, 20) + (u.pathname.length > 20 ? "…" : "");
    } catch {
      return url.length > 30 ? url.slice(0, 30) + "…" : url;
    }
  };

  const winner = top10[0];

  if (top10.length === 0) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado encontrado
          </p>
        </CardContent>
      </Card>
    );
  }

  // Mobile: compact card with winner + dialog
  if (isMobile) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
              <Trophy className="h-4 w-4" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{title}</p>
              <p className="text-sm font-semibold text-foreground truncate" title={winner.name}>
                {isUrl(winner.name) ? shortenUrl(winner.name) : winner.name}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-foreground">{winner.count}</p>
              <p className="text-xs text-muted-foreground">{winner.percentage.toFixed(1)}%</p>
            </div>
          </div>

          <div className="flex gap-2">
            <CreativeGuideButton
              creativeName={winner.name}
              category={category}
              count={winner.count}
              percentage={winner.percentage}
              compact
            />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 gap-2 text-xs border-border/40">
                  Ver todos <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[85vh] overflow-y-auto p-4">
                <DialogHeader>
                  <DialogTitle className="text-base">{title}</DialogTitle>
                </DialogHeader>
                <FullRankingContent
                  top10={top10}
                  color={color}
                  preview={preview}
                  previewLoading={previewLoading}
                  previewUrl={previewUrl}
                  setPreview={setPreview}
                  setPreviewUrl={setPreviewUrl}
                  handlePreview={handlePreview}
                  isUrl={isUrl}
                  shortenUrl={shortenUrl}
                  clientId={clientId}
                  sendingUrl={sendingUrl}
                  handleSendWhatsApp={handleSendWhatsApp}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Desktop: full view
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CreativeGuideButton
            creativeName={winner.name}
            category={category}
            count={winner.count}
            percentage={winner.percentage}
          />
        </div>
      </CardHeader>
      <CardContent>
        <FullRankingContent
          top10={top10}
          color={color}
          preview={preview}
          previewLoading={previewLoading}
          previewUrl={previewUrl}
          setPreview={setPreview}
          setPreviewUrl={setPreviewUrl}
          handlePreview={handlePreview}
          isUrl={isUrl}
          shortenUrl={shortenUrl}
          clientId={clientId}
          sendingUrl={sendingUrl}
          handleSendWhatsApp={handleSendWhatsApp}
        />
      </CardContent>
    </Card>
  );
}
