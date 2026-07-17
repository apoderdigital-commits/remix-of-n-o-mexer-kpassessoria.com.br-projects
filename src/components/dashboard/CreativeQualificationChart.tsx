import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignRow {
  ad_name: string | null;
  leads_total: number | null;
}

interface LeadRow {
  creative_name: string;
  status: string;
}

interface Props {
  campaigns: CampaignRow[];
  leads: LeadRow[];
  qualifiedStatuses?: string[];
}

const DEFAULT_QUALIFIED = ["cpf_approved", "sale", "sale_consortium", "sale_financing"];

export function CreativeQualificationChart({ campaigns, leads, qualifiedStatuses = DEFAULT_QUALIFIED }: Props) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const totalMap = new Map<string, number>();
    (campaigns || []).forEach((c) => {
      const name = (c.ad_name || "").trim();
      if (!name) return;
      totalMap.set(name, (totalMap.get(name) || 0) + (Number(c.leads_total) || 0));
    });

    const qualMap = new Map<string, number>();
    (leads || []).forEach((l) => {
      if (!qualifiedStatuses.includes(l.status)) return;
      const name = (l.creative_name || "").trim();
      if (!name) return;
      qualMap.set(name, (qualMap.get(name) || 0) + 1);
    });

    const names = new Set<string>([...totalMap.keys(), ...qualMap.keys()]);
    const data = Array.from(names).map((name) => {
      const total = totalMap.get(name) || 0;
      const qualified = qualMap.get(name) || 0;
      const rate = total > 0 ? (qualified / total) * 100 : 0;
      return { name, total, qualified, rate };
    });

    return data
      .filter((r) => r.qualified > 0)
      .sort((a, b) => b.qualified - a.qualified || b.rate - a.rate);
  }, [campaigns, leads, qualifiedStatuses]);

  const totalQualified = rows.reduce((s, r) => s + r.qualified, 0);
  const totalLeadsSum = rows.reduce((s, r) => s + r.total, 0);
  const avgRate = totalLeadsSum > 0 ? (totalQualified / totalLeadsSum) * 100 : 0;

  const visible = showAll ? rows : rows.slice(0, 10);

  const shortName = (n: string) => {
    if (n.startsWith("http")) {
      try {
        const u = new URL(n);
        return u.hostname.replace(/^www\./, "") + u.pathname.slice(0, 14) + (u.pathname.length > 14 ? "…" : "");
      } catch {
        return n.length > 28 ? n.slice(0, 28) + "…" : n;
      }
    }
    return n.length > 32 ? n.slice(0, 32) + "…" : n;
  };

  const chartData = visible.map((r) => ({ ...r, label: shortName(r.name) }));
  const chartH = Math.max(220, chartData.length * 44 + 40);

  if (rows.length === 0) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Qualificação por Criativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Sem dados de leads qualificados no período.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Qualificação por Criativo
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <div className="text-muted-foreground">
              Qualificados: <span className="text-foreground font-semibold">{totalQualified}</span>
            </div>
            <div className="text-muted-foreground">
              Taxa média: <span className="text-foreground font-semibold">{avgRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Volume de leads qualificados por criativo e taxa de qualificação (qualificados ÷ leads totais).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div style={{ height: chartH }} className="rounded-lg bg-background/30 border border-border/20 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 96, top: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="qual-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(263, 60%, 60%)" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="hsl(263, 80%, 68%)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={200}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--primary) / 0.06)" }}
                contentStyle={{
                  background: "hsl(222 40% 10%)",
                  border: "1px solid hsl(222 30% 20%)",
                  borderRadius: 8,
                  color: "hsl(210 40% 98%)",
                  fontSize: 12,
                }}
                formatter={(_v: number, _k, item: any) => {
                  const d = item?.payload;
                  if (!d) return ["", "Desempenho"];
                  const rate = Number(d.rate) || 0;
                  return [
                    `${d.qualified ?? 0} qualif. · ${d.total ?? 0} leads · ${rate.toFixed(1)}%`,
                    "Desempenho",
                  ];
                }}
                labelFormatter={(_l, payload) => (payload?.[0]?.payload as any)?.name ?? ""}
              />
              <Bar dataKey="qualified" radius={[6, 6, 6, 6]} barSize={22}
                background={{ fill: "hsl(var(--muted) / 0.15)", radius: 6 } as any}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="url(#qual-grad)" fillOpacity={1 - i * 0.05} />
                ))}
                <LabelList
                  dataKey="qualified"
                  position="right"
                  style={{ fill: "hsl(210 40% 98%)", fontSize: 12, fontWeight: 700 }}
                  formatter={(v: number) => {
                    const item = chartData.find((d) => d.qualified === v);
                    return item ? `${v} · ${(Number(item.rate) || 0).toFixed(1)}%` : `${v}`;
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {rows.length > 10 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="w-full text-xs border-border/40 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            {showAll ? "Mostrar apenas top 10" : `Ver todos os ${rows.length} criativos`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
