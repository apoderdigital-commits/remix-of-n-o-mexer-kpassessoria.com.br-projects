import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, CheckCircle, ShoppingCart, TrendingDown } from "lucide-react";

interface StatsCardsProps {
  totalLeads: number;
  totalSpent: number;
  cpfApproved: number;
  sales: number;
}

export function StatsCards({ totalLeads, totalSpent, cpfApproved, sales }: StatsCardsProps) {
  const qualified = cpfApproved + sales;
  const qualificationRate = totalLeads > 0 ? ((qualified / totalLeads) * 100).toFixed(1) : "0";
  const costPerLead = totalLeads > 0 ? (totalSpent / totalLeads).toFixed(2) : "—";
  const costPerQualified = qualified > 0 ? (totalSpent / qualified).toFixed(2) : "—";
  const costPerSale = sales > 0 ? (totalSpent / sales).toFixed(2) : "—";

  const cards = [
    {
      title: "Total de Leads",
      value: totalLeads.toLocaleString("pt-BR"),
      icon: Users,
      color: "text-blue-400",
    },
    {
      title: "Investimento",
      value: `R$ ${totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-yellow-400",
    },
    {
      title: "Custo / Lead",
      value: costPerLead === "—" ? "—" : `R$ ${costPerLead}`,
      icon: TrendingDown,
      color: "text-pink-400",
    },
    {
      title: "CPFs Aprovados",
      value: cpfApproved.toLocaleString("pt-BR"),
      icon: CheckCircle,
      color: "text-green-400",
    },
    {
      title: "Vendas",
      value: sales.toLocaleString("pt-BR"),
      icon: ShoppingCart,
      color: "text-primary",
    },
    {
      title: "Custo / Lead Qualificado",
      value: costPerQualified === "—" ? "—" : `R$ ${costPerQualified}`,
      icon: TrendingDown,
      subtitle: `Taxa: ${qualificationRate}%`,
      color: "text-cyan-400",
    },
    {
      title: "Custo / Venda",
      value: costPerSale === "—" ? "—" : `R$ ${costPerSale}`,
      icon: TrendingDown,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((card) => (
        <Card key={card.title} className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">{card.title}</span>
            </div>
            <p className="text-xl font-bold">{card.value}</p>
            {card.subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
