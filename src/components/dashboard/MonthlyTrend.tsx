import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend, Cell } from "recharts";
import { TrendingUp } from "lucide-react";

interface MonthlyTrendProps {
  data: { key: string; label: string; leads: number; cpf: number; sales: number; spent: number }[];
}

// Taxas IDEAIS do funil (mesma filosofia da Evolução Temporal)
const IDEAL_QUAL_OVER_LEADS = 0.12; // leads qualificados / leads (0.6 * 0.2)
const IDEAL_SALES_RATE = 0.25;      // vendas / leads qualificados
const BLEND = 0.6;                  // quanto caminha da taxa real rumo à ideal (otimista, mas não 100%)
const OPT = 1.03;                   // leve empurrão otimista nos leads

export function MonthlyTrend({ data }: MonthlyTrendProps) {
  if (!data || data.length === 0) return null;

  const now = new Date();
  const currentKey = now.toISOString().slice(0, 7);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();

  // Meses já fechados (base do trend e das taxas reais)
  const completed = data.filter((d) => d.key !== currentKey);
  const recent = completed.slice(-3);
  const avgLeads = recent.length ? recent.reduce((s, d) => s + (d.leads || 0), 0) / recent.length : 0;
  const recLeads = recent.reduce((s, d) => s + (d.leads || 0), 0);
  const recQual = recent.reduce((s, d) => s + (d.cpf || 0), 0);
  const recSales = recent.reduce((s, d) => s + (d.sales || 0), 0);
  const actualQualRate = recLeads > 0 ? recQual / recLeads : 0;
  const actualSalesRate = recQual > 0 ? recSales / recQual : 0;
  // Otimista sem exagero: caminha 60% da taxa real até a ideal (e nunca abaixo da real)
  const projQualRate = Math.max(actualQualRate, actualQualRate + (IDEAL_QUAL_OVER_LEADS - actualQualRate) * BLEND);
  const projSalesRate = Math.max(actualSalesRate, actualSalesRate + (IDEAL_SALES_RATE - actualSalesRate) * BLEND);

  const canProject = completed.length > 0 && data.some((d) => d.key === currentKey);

  const chartData = data.map((d) => {
    if (!canProject || d.key !== currentKey) return { ...d, projected: false };
    // Leads projetados: run-rate do mês (se já rodou alguns dias) ou média recente
    const runRate = daysElapsed >= 3 && (d.leads || 0) > 0 ? (d.leads || 0) / (daysElapsed / daysInMonth) : 0;
    const projLeads = Math.round(Math.max(runRate, avgLeads) * OPT);
    const projQual = Math.max(d.cpf || 0, Math.round(projLeads * projQualRate));
    const projSales = Math.max(d.sales || 0, Math.round(projQual * projSalesRate));
    return {
      ...d,
      label: `${d.label} (proj.)`,
      leads: projLeads,
      cpf: projQual,
      sales: projSales,
      projected: true,
    };
  });

  const hasProjection = chartData.some((d) => (d as any).projected);

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 shadow-md">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">Tendência mensal</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Comparativo dos últimos {data.length} meses — leads, Leads qualificados e vendas.
              {hasProjection && (
                <span className="text-cyan-300/80"> O mês atual é uma projeção otimista (barras mais claras).</span>
              )}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(215 20% 60%)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(222 30% 20%)" }}
              />
              <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--primary) / 0.06)" }}
                contentStyle={{
                  background: "hsl(222 40% 10%)",
                  border: "1px solid hsl(222 30% 20%)",
                  borderRadius: 8,
                  color: "hsl(210 40% 98%)",
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(v) => <span className="text-muted-foreground">{v}</span>}
              />
              <Bar dataKey="leads" name="Leads" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={`l-${i}`} fill="hsl(199 89% 48%)" fillOpacity={(d as any).projected ? 0.4 : 1} />
                ))}
              </Bar>
              <Bar dataKey="cpf" name="Lead Qual." radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={`c-${i}`} fill="hsl(142 71% 45%)" fillOpacity={(d as any).projected ? 0.4 : 1} />
                ))}
              </Bar>
              <Bar dataKey="sales" name="Vendas" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={`s-${i}`} fill="hsl(263 70% 58%)" fillOpacity={(d as any).projected ? 0.4 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
