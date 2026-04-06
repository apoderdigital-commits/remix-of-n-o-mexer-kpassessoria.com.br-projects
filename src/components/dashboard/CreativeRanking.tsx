import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, X, Image as ImageIcon } from "lucide-react";

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
}

interface PreviewData {
  image: string | null;
  title: string | null;
  finalUrl: string;
}

export function CreativeRanking({ title, data, color }: CreativeRankingProps) {
  const top10 = data.slice(0, 10);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handlePreview = async (url: string) => {
    if (previewUrl === url) {
      setPreview(null);
      setPreviewUrl(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewUrl(url);
    try {
      const { data, error } = await supabase.functions.invoke("unfurl-url", {
        body: { url },
      });
      if (error) throw error;
      setPreview(data as PreviewData);
    } catch {
      setPreview({ image: null, title: null, finalUrl: url });
    }
    setPreviewLoading(false);
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

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {top10.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado encontrado
          </p>
        ) : (
          <>
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
                ) : preview?.image ? (
                  <div className="flex gap-3 items-start">
                    <img
                      src={preview.image}
                      alt={preview.title || "Preview"}
                      className="w-32 h-32 object-cover rounded-md flex-shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      {preview.title && (
                        <p className="text-sm font-medium line-clamp-2">{preview.title}</p>
                      )}
                      <a
                        href={preview.finalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Abrir link <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">Preview não disponível</p>
                    <a
                      href={previewUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center justify-center gap-1 mt-1"
                    >
                      Abrir link <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
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
                      {isUrl(item.name) ? (
                        <button
                          onClick={() => handlePreview(item.name)}
                          className={`text-left text-primary hover:underline truncate block max-w-full ${
                            previewUrl === item.name ? "underline" : ""
                          }`}
                          title={item.name}
                        >
                          {shortenUrl(item.name)}
                        </button>
                      ) : (
                        <span className="truncate block">{item.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.percentage.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
