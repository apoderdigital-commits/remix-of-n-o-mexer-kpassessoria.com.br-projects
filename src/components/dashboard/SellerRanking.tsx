import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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

function FullSellerContent({ top10, color }: { top10: SellerData[]; color: string }) {
  return (
    <div className="space-y-4">
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
