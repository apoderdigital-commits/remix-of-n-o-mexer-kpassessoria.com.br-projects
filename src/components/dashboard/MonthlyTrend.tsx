import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

interface MonthlyTrendProps {
  data: { key: string; label: string; leads: number; cpf: number; sales: number; spent: number }[];
}

export function MonthlyTrend({ data }: MonthlyTrendProps) {
  if (!data || data.length === 0) return null;

  // Marca o mês corrente para destaque
  const currentKey = new Date().toISOString().slice(0, 7);
  const chartData = data.map((d) => ({ ...d, isCurrent: d.key === currentKey }));

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
              Comparativo dos últimos {data.length} meses — leads, CPFs aprovados e vendas.
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
              <Bar dataKey="leads" name="Leads" fill="hsl(199 89% 48%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cpf" name="Lead Qual." fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sales" name="Vendas" fill="hsl(263 70% 58%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
