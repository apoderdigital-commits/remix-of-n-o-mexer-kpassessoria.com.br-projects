import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Activity, Users, CheckCircle2, Banknote } from "lucide-react";

interface DataPoint {
  date: string;
  leads: number;
  cpf: number;
  sales: number;
}

interface EvolutionChartProps {
  data: DataPoint[];
}

const SERIES = [
  {
    key: "leads" as const,
    name: "Leads Totais",
    description: "Total de leads captados pela Meta Ads no dia",
    color: "hsl(199 89% 48%)",
    icon: Users,
  },
  {
    key: "cpf" as const,
    name: "CPF Aprovado",
    description: "Leads que tiveram CPF aprovado para crédito",
    color: "hsl(142 71% 45%)",
    icon: CheckCircle2,
  },
  {
    key: "sales" as const,
    name: "Vendas",
    description: "Vendas fechadas (financiamento + consórcio)",
    color: "hsl(263 70% 58%)",
    icon: Banknote,
  },
];

function formatDateLabel(v: string) {
  const d = new Date(v + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatFullDate(v: string) {
  const d = new Date(v + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-foreground mb-2 capitalize">{formatFullDate(label)}</p>
      <div className="space-y-1.5">
        {payload.map((p: any) => {
          const meta = SERIES.find((s) => s.key === p.dataKey);
          const Icon = meta?.icon ?? Activity;
          return (
            <div key={p.dataKey} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{meta?.name ?? p.name}:</span>
              <span className="font-semibold text-foreground">{Number(p.value).toLocaleString("pt-BR")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EvolutionChart({ data }: EvolutionChartProps) {
  // KPI summary: total + comparison between first half and second half of the period
  const summary = SERIES.map((s) => {
    const total = data.reduce((sum, d) => sum + (d[s.key] as number), 0);
    const half = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, half).reduce((sum, d) => sum + (d[s.key] as number), 0);
    const secondHalf = data.slice(half).reduce((sum, d) => sum + (d[s.key] as number), 0);
    let trendPct = 0;
    if (firstHalf > 0) trendPct = ((secondHalf - firstHalf) / firstHalf) * 100;
    else if (secondHalf > 0) trendPct = 100;
    return { ...s, total, trendPct, firstHalf, secondHalf };
  });

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-md">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">Evolução Temporal</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Veja como leads, aprovações e vendas se comportam dia a dia no período selecionado.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum dado para exibir
          </p>
        ) : (
          <>
            {/* KPI summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {summary.map((s) => {
                const Icon = s.icon;
                const TrendIcon = s.trendPct > 1 ? TrendingUp : s.trendPct < -1 ? TrendingDown : Minus;
                const trendColor =
                  s.trendPct > 1 ? "text-green-400" : s.trendPct < -1 ? "text-red-400" : "text-muted-foreground";
                return (
                  <div
                    key={s.key}
                    className="p-4 rounded-xl border border-border/40 bg-card/60"
                    style={{ borderLeft: `3px solid ${s.color}` }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color: s.color }} />
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                        {s.name}
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-foreground mt-2 leading-none">
                      {s.total.toLocaleString("pt-BR")}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                      <span className={`text-xs font-semibold ${trendColor}`}>
                        {s.trendPct > 0 ? "+" : ""}
                        {s.trendPct.toFixed(1)}%
                      </span>
                      <span className="text-[11px] text-muted-foreground">vs. início do período</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{s.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Chart */}
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    {SERIES.map((s) => (
                      <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
                    tickFormatter={formatDateLabel}
                  />
                  <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  {SERIES.map((s) => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={2.5}
                      fill={`url(#grad-${s.key})`}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(222 40% 10%)" }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Custom legend with descriptions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/30">
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-start gap-2 text-xs">
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }}
                  />
                  <div>
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="text-muted-foreground leading-snug">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
