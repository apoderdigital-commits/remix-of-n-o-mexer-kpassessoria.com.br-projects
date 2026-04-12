import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface SellerData {
  name: string;
  count: number;
  percentage: number;
}

interface SellerRankingProps {
  title: string;
  data: SellerData[];
  color: string;
  icon: string;
}

export function SellerRanking({ title, data, color, icon }: SellerRankingProps) {
  const top10 = data.slice(0, 10);

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {top10.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado encontrado
          </p>
        ) : (
          <>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fill: "hsl(210 40% 98%)", fontSize: 11 }}
                    tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + "…" : v}
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
                  <TableHead className="text-muted-foreground">Vendedor</TableHead>
                  <TableHead className="text-right text-muted-foreground">Qtd</TableHead>
                  <TableHead className="text-right text-muted-foreground">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top10.map((item, i) => (
                  <TableRow key={item.name} className="border-border/20">
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
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
