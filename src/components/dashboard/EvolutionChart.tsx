import { forwardRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity, Users, CheckCircle2, Banknote, BarChart3, TrendingUp } from "lucide-react";

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

const PROJECTION_KEYS: SeriesKey[] = ["leads", "simulacoes", "cpf"];

function formatDateLabel(v: string) {
  const d = new Date(v + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatFullDate(v: string) {
  const d = new Date(v + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

const CustomTooltip = forwardRef<HTMLDivElement, any>(function CustomTooltip(
  { active, payload, label, projectionEndIso },
  ref
) {
  if (!active || !payload?.length) return null;
  const isProjection = label > projectionEndIso ? false : label >= (payload[0]?.payload?.__projectionStartIso ?? "9999");
  // Filter duplicate (real + proj at same date) — show only relevant ones
  const filtered = payload.filter((p: any) => p.value !== null && p.value !== undefined);
  return (
    <div ref={ref} className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm px-4 py-3 shadow-xl max-w-xs">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-semibold text-foreground capitalize">{formatFullDate(label)}</p>
        {isProjection && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-300/90">
            projeção
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {filtered.map((p: any) => {
          const baseKey = String(p.dataKey).replace(/^proj_/, "") as SeriesKey;
          const meta = SERIES.find((s) => s.key === baseKey);
          const Icon = meta?.icon ?? Activity;
          const isProj = String(p.dataKey).startsWith("proj_");
          return (
            <div key={p.dataKey} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: p.color,
                  boxShadow: isProj ? "none" : `0 0 6px ${p.color}`,
                  opacity: isProj ? 0.7 : 1,
                }}
              />
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {meta?.name ?? p.name}
                {isProj ? " (proj.)" : ""}:
              </span>
              <span className="font-semibold text-foreground">
                {Number(p.value).toLocaleString("pt-BR")}
              </span>
            </div>
          );
        })}
      </div>
      {isProjection && (
        <p className="text-[10px] text-muted-foreground/80 mt-2 italic leading-snug">
          Estimativa baseada na média dos últimos 7 dias. Pode variar.
        </p>
      )}
    </div>
  );
});

export function EvolutionChart({ data, simulacoesTotal }: EvolutionChartProps) {
  const totalLeads = data.reduce((sum, d) => sum + d.leads, 0);

  // Distribute total simulações proportionally to leads per day
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

  const chartSeries = simulacoesTotal !== undefined ? SERIES : SERIES.filter((s) => s.key !== "simulacoes");

  // ===== PROJECTION =====
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toIso(today);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);
  const monthEndIso = toIso(monthEnd);

  // Use last 7 available days from data (excluding today if present, since today is partial)
  const sortedData = [...dataWithSim].sort((a, b) => a.date.localeCompare(b.date));
  const completedDays = sortedData.filter((d) => d.date < todayIso);
  const last7 = completedDays.slice(-7);
  const avg = (key: SeriesKey) => {
    if (last7.length === 0) return 0;
    const sum = last7.reduce((s, d: any) => s + (Number(d[key]) || 0), 0);
    return sum / last7.length;
  };

  const dailyAvg: Record<string, number> = {
    leads: avg("leads"),
    simulacoes: avg("simulacoes"),
    cpf: avg("cpf"),
  };

  // Standard deviation of last 7 days (used to create realistic ups/downs in projection)
  const stdDev = (key: SeriesKey) => {
    if (last7.length < 2) return 0;
    const mean = avg(key);
    const variance =
      last7.reduce((s, d: any) => s + Math.pow((Number(d[key]) || 0) - mean, 2), 0) / last7.length;
    return Math.sqrt(variance);
  };
  const dailyStd: Record<string, number> = {
    leads: stdDev("leads"),
    simulacoes: stdDev("simulacoes"),
    cpf: stdDev("cpf"),
  };

  // Deterministic pseudo-random generator (mulberry32) seeded from last real date
  // so projection stays stable across renders but varies between datasets.
  const seedFromString = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const mulberry32 = (a: number) => {
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const lastRealDate = sortedData.length > 0 ? sortedData[sortedData.length - 1].date : todayIso;
  // Project starting the day AFTER the last real data point, so the dashed line
  // connects directly from where the realized series ends (no gap).
  const projectionStart = new Date(lastRealDate + "T00:00:00");
  projectionStart.setDate(projectionStart.getDate() + 1);
  const projectionStartIso = toIso(projectionStart);

  // Generators per series (Box-Muller for gaussian-like noise)
  const rngLeads = mulberry32(seedFromString(lastRealDate + "_leads"));
  const rngSim = mulberry32(seedFromString(lastRealDate + "_sim"));
  const rngCpf = mulberry32(seedFromString(lastRealDate + "_cpf"));
  const gaussian = (rng: () => number) => {
    const u = Math.max(rng(), 1e-9);
    const v = Math.max(rng(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // Dampen volatility so projection doesn't look chaotic — about 70% of historical std
  const VOLATILITY = 0.7;
  // Cap deviation per day to ±1.8σ to avoid extreme spikes
  const clampDev = (z: number) => Math.max(-1.8, Math.min(1.8, z));

  const projectValue = (mean: number, std: number, rng: () => number) => {
    if (mean <= 0) return 0;
    const z = clampDev(gaussian(rng)) * VOLATILITY;
    const v = mean + z * std;
    return Math.max(0, Math.round(v));
  };

  // Build projection points (one per day until month end) with realistic ups/downs
  const projectionPoints: any[] = [];
  if (projectionStart <= monthEnd && last7.length > 0) {
    const cursor = new Date(projectionStart);
    while (cursor <= monthEnd) {
      const iso = toIso(cursor);
      projectionPoints.push({
        date: iso,
        leads: null,
        simulacoes: null,
        cpf: null,
        sales: null,
        proj_leads: projectValue(dailyAvg.leads, dailyStd.leads, rngLeads),
        proj_simulacoes: projectValue(dailyAvg.simulacoes, dailyStd.simulacoes, rngSim),
        proj_cpf: projectValue(dailyAvg.cpf, dailyStd.cpf, rngCpf),
        __projectionStartIso: projectionStartIso,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Add bridge point: the last real data point also carries proj_* values so lines connect
  const dataWithProj = sortedData.map((d, idx) => {
    const isLastReal = idx === sortedData.length - 1 && projectionPoints.length > 0;
    return {
      ...d,
      proj_leads: isLastReal ? d.leads : null,
      proj_simulacoes: isLastReal ? (d as any).simulacoes : null,
      proj_cpf: isLastReal ? d.cpf : null,
      __projectionStartIso: projectionStartIso,
    };
  });

  const chartData = [...dataWithProj, ...projectionPoints];

  // Days remaining in month (from tomorrow through month end)
  const daysRemaining = projectionPoints.length;
  const projectedTotals = {
    leads: Math.round(dailyAvg.leads * daysRemaining),
    simulacoes: Math.round(dailyAvg.simulacoes * daysRemaining),
    cpf: Math.round(dailyAvg.cpf * daysRemaining),
  };

  // Realized so far this month (from data points within current month)
  const monthStartIso = toIso(new Date(today.getFullYear(), today.getMonth(), 1));
  const realizedThisMonth = sortedData
    .filter((d) => d.date >= monthStartIso && d.date <= todayIso)
    .reduce(
      (acc, d: any) => ({
        leads: acc.leads + (Number(d.leads) || 0),
        simulacoes: acc.simulacoes + (Number(d.simulacoes) || 0),
        cpf: acc.cpf + (Number(d.cpf) || 0),
      }),
      { leads: 0, simulacoes: 0, cpf: 0 }
    );
  const monthEstimate = {
    leads: realizedThisMonth.leads + projectedTotals.leads,
    simulacoes: realizedThisMonth.simulacoes + projectedTotals.simulacoes,
    cpf: realizedThisMonth.cpf + projectedTotals.cpf,
  };
  const currentMonthName = today.toLocaleDateString("pt-BR", { month: "long" });
  const showProjection = projectionPoints.length > 0 && last7.length > 0;

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

            {/* Projection summary */}
            {showProjection && (
              <div
                className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] to-transparent p-3.5 flex items-start gap-3"
                title="Estimativa baseada na média dos últimos 7 dias. Pode variar."
              >
                <div className="p-2 rounded-lg bg-amber-500/15 shrink-0">
                  <TrendingUp className="h-4 w-4 text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-300/90">
                    Projeção para {currentMonthName} · {daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}
                  </p>
                  <p className="text-sm text-foreground/90 mt-1 leading-snug">
                    <span className="font-bold text-foreground">{monthEstimate.leads.toLocaleString("pt-BR")}</span> leads
                    {" · "}
                    <span className="font-bold text-foreground">{monthEstimate.simulacoes.toLocaleString("pt-BR")}</span> simulações
                    {" · "}
                    <span className="font-bold text-foreground">{monthEstimate.cpf.toLocaleString("pt-BR")}</span> CPFs aprovados
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1 italic">
                    Estimativa baseada na média diária dos últimos 7 dias ({Math.round(dailyAvg.leads)} leads/dia).
                  </p>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
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
                  <Tooltip content={<CustomTooltip projectionEndIso={monthEndIso} />} />

                  {/* Realized series */}
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
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}

                  {/* Projection series (dashed) */}
                  {showProjection &&
                    chartSeries
                      .filter((s) => PROJECTION_KEYS.includes(s.key))
                      .map((s) => (
                        <Line
                          key={`proj-${s.key}`}
                          type="monotone"
                          dataKey={`proj_${s.key}`}
                          name={`${s.name} (projeção)`}
                          stroke={s.color}
                          strokeWidth={2.5}
                          strokeDasharray="7 5"
                          dot={false}
                          activeDot={{
                            r: 4,
                            strokeWidth: 2,
                            stroke: "hsl(var(--background))",
                            fill: s.color,
                          }}
                          connectNulls
                          isAnimationActive={false}
                          legendType="none"
                          strokeOpacity={0.95}
                        />
                      ))}

                  {/* Vertical "today" line */}
                  {showProjection && (
                    <ReferenceLine
                      x={todayIso}
                      stroke="hsl(215 25% 60%)"
                      strokeWidth={1}
                      strokeDasharray="2 3"
                      label={{
                        value: "Hoje",
                        position: "top",
                        fill: "hsl(215 25% 70%)",
                        fontSize: 10,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Custom legend with descriptions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-border/30">
              {chartSeries.map((s) => {
                const hasProj = showProjection && PROJECTION_KEYS.includes(s.key);
                return (
                  <div key={s.key} className="flex items-start gap-2 text-xs">
                    <span
                      className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{s.name}</p>
                      <p className="text-muted-foreground leading-snug">
                        {s.key === "simulacoes"
                          ? "Distribuído proporcional aos leads (total do GHL)"
                          : s.description}
                      </p>
                      {hasProj && (
                        <p className="text-muted-foreground/80 leading-snug mt-0.5 inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-px w-5"
                            style={{
                              borderTop: `2px dashed ${s.color}`,
                            }}
                          />
                          <span className="italic">— projeção</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
