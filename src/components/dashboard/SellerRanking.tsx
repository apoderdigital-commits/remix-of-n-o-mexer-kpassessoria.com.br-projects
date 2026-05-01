import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Trophy, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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

const medalFor = (i: number) =>
  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

function FullSellerContent({ top10, color }: { top10: SellerData[]; color: string }) {
  const chartData = top10.map((r, i) => ({
    ...r,
    rankLabel: ["🥇 Top 1", "🥈 Top 2", "🥉 Top 3"][i] ?? `#${i + 1}`,
  }));
  const gradId = `seller-bar-grad-${color.replace(/[^a-z0-9]/gi, "")}`;
  const rowH = 44;
  const chartH = Math.max(160, chartData.length * rowH + 32);
  return (
    <div className="space-y-4">
      <div style={{ height: chartH }} className="rounded-lg bg-background/30 border border-border/20 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 56, top: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={color} stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="rankLabel"
              width={86}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(210 40% 92%)", fontSize: 12, fontWeight: 600 }}
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
              formatter={(value: number) => [value, "Quantidade"]}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload as SellerData | undefined;
                return item?.name ?? "";
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 6, 6]} barSize={22} background={{ fill: "hsl(var(--muted) / 0.15)", radius: 6 } as any}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={`url(#${gradId})`} fillOpacity={1 - i * 0.12} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fill: "hsl(210 40% 98%)", fontSize: 12, fontWeight: 700 }}
                formatter={(v: number) => {
                  const item = chartData.find((d) => d.count === v);
                  return item ? `${v} · ${item.percentage.toFixed(1)}%` : `${v}`;
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-border/30">
            <TableHead className="text-muted-foreground w-12">#</TableHead>
            <TableHead className="text-muted-foreground">Vendedor</TableHead>
            <TableHead className="text-right text-muted-foreground">Qtd</TableHead>
            <TableHead className="text-right text-muted-foreground">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {top10.map((item, i) => {
            const medal = medalFor(i);
            return (
              <TableRow key={item.name} className="border-border/20">
                <TableCell className="text-muted-foreground">
                  {medal ? (
                    <span className="text-xl leading-none" title={`${i + 1}º lugar`}>{medal}</span>
                  ) : (
                    i + 1
                  )}
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-right">{item.count}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.percentage.toFixed(1)}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function SellerRanking({ title, data, color, icon }: SellerRankingProps) {
  const top10 = data.slice(0, 10);
  const isMobile = useIsMobile();
  const winner = top10[0];

  if (top10.length === 0) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{icon} {title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado encontrado
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
              <Trophy className="h-4 w-4" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{icon} {title}</p>
              <p className="text-sm font-semibold text-foreground truncate">{winner.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-foreground">{winner.count}</p>
              <p className="text-xs text-muted-foreground">{winner.percentage.toFixed(1)}%</p>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-border/40">
                Ver todos os vendedores <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base">{icon} {title}</DialogTitle>
              </DialogHeader>
              <FullSellerContent top10={top10} color={color} />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent>
        <FullSellerContent top10={top10} color={color} />
      </CardContent>
    </Card>
  );
}
