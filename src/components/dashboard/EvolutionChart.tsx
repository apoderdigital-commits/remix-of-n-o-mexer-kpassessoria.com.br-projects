import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DataPoint {
  date: string;
  leads: number;
  cpf: number;
  sales: number;
}

interface EvolutionChartProps {
  data: DataPoint[];
}

export function EvolutionChart({ data }: EvolutionChartProps) {
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Evolução Temporal</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum dado para exibir
          </p>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
                  tickFormatter={(v) => {
                    const d = new Date(v + "T00:00:00");
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(222 40% 10%)",
                    border: "1px solid hsl(222 30% 20%)",
                    borderRadius: 8,
                    color: "hsl(210 40% 98%)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="leads"
                  name="Leads Totais"
                  stroke="hsl(199 89% 48%)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cpf"
                  name="CPF Aprovado"
                  stroke="hsl(142 71% 45%)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="Vendas"
                  stroke="hsl(263 70% 58%)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
