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
import { Activity, Users, CheckCircle2, Banknote, BarChart3 } from "lucide-react";

interface DataPoint {
  date: string;
  leads: number;
  cpf: number;
  sales: number;
}

interface EvolutionChartProps {
  data: DataPoint[];
  simulacoesTotal?: number;
}

type SeriesKey = "leads" | "simulacoes" | "cpf" | "sales";

interface SeriesDef {
  key: SeriesKey;
  name: string;
  description: string;
  color: string;
  icon: typeof Users;
  // metric of conversion: value / base * 100, with a target %
  goal?: { baseKey: SeriesKey; target: number; label: string };
}

const SERIES: SeriesDef[] = [
  {
    key: "leads",
    name: "Leads Totais",
    description: "Total de leads captados pela Meta Ads no dia",
    color: "hsl(199 89% 48%)",
    icon: Users,
  },
  {
    key: "simulacoes",
    name: "Simulações",
    description: "Simulações de crédito registradas no GHL",
    color: "hsl(190 80% 55%)",
    icon: BarChart3,
    goal: { baseKey: "leads", target: 60, label: "Sim/Leads" },
  },
  {
    key: "cpf",
    name: "CPF Aprovado",
    description: "Leads que tiveram CPF aprovado para crédito",
    color: "hsl(142 71% 45%)",
    icon: CheckCircle2,
    goal: { baseKey: "simulacoes", target: 15, label: "Aprov/Sim" },
  },
  {
    key: "sales",
    name: "Vendas",
    description: "Vendas fechadas (financiamento + consórcio)",
    color: "hsl(263 70% 58%)",
    icon: Banknote,
    goal: { baseKey: "cpf", target: 20, label: "Vendas/Aprov" },
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

export function EvolutionChart({ data, simulacoesTotal }: EvolutionChartProps) {
  const totalLeads = data.reduce((sum, d) => sum + d.leads, 0);

  // Distribute total simulações proportionally to leads per day (approximation since GHL only provides total)
  const dataWithSim = data.map((d) => ({
    ...d,
    simulacoes:
      simulacoesTotal !== undefined && totalLeads > 0
        ? Math.round((d.leads / totalLeads) * simulacoesTotal)
        : 0,
  }));

  const totals: Record<SeriesKey, number> = {
    leads: totalLeads,
    simulacoes: simulacoesTotal ?? 0,
    cpf: data.reduce((sum, d) => sum + d.cpf, 0),
    sales: data.reduce((sum, d) => sum + d.sales, 0),
  };

  const summary = SERIES.map((s) => {
    const total = totals[s.key];
    let achievedPct: number | null = null;
    if (s.goal) {
      const base = totals[s.goal.baseKey];
      achievedPct = base > 0 ? (total / base) * 100 : 0;
    }
    return { ...s, total, achievedPct };
  });

  // Hide simulações series from chart if not provided
  const chartSeries = simulacoesTotal !== undefined ? SERIES : SERIES.filter((s) => s.key !== "simulacoes");

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
              Veja como leads, simulações, aprovações e vendas se comportam dia a dia no período selecionado.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {summary.map((s) => {
                const Icon = s.icon;
                const hasGoal = s.goal && s.achievedPct !== null;
                const met = hasGoal ? (s.achievedPct as number) >= (s.goal!.target) : false;
                const pctColor = met ? "text-green-400" : "text-amber-400";
                const dotColor = met ? "bg-green-400" : "bg-amber-400";
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
                    {hasGoal ? (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                          met
                            ? "border-green-500/30 bg-green-500/10"
                            : "border-amber-500/30 bg-amber-500/10"
                        } ${pctColor}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                          {s.goal!.label}: {(s.achievedPct as number).toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          meta {s.goal!.target}%
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[11px] text-muted-foreground">topo do funil</span>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{s.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Chart */}
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dataWithSim} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    {chartSeries.map((s) => (
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
                  {chartSeries.map((s) => (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-border/30">
              {chartSeries.map((s) => (
                <div key={s.key} className="flex items-start gap-2 text-xs">
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }}
                  />
                  <div>
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="text-muted-foreground leading-snug">
                      {s.key === "simulacoes"
                        ? "Distribuído proporcional aos leads (total do GHL)"
                        : s.description}
                    </p>
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
