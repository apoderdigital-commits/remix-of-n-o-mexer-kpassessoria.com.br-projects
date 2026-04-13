import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, CheckCircle, TrendingDown, CreditCard, Handshake, XCircle, BarChart3 } from "lucide-react";

interface StatsCardsProps {
  totalLeads: number;
  totalSpent: number;
  cpfApproved: number;
  salesConsortium: number;
  salesFinancing: number;
  salesLegacy: number;
  ghlData?: {
    simulacoes: number;
    cpf_aprovado: number;
    cpf_nao_aprovado: number;
  } | null;
  ghlLoading?: boolean;
}

function MetaIndicator({ label, value, target }: { label: string; value: number; target: number }) {
  const met = value >= target;
  return (
    <div className={`text-xs mt-1 font-medium ${met ? "text-green-400" : "text-red-400"}`}>
      {label}: {value.toFixed(1)}% {met ? "✅" : "⚠️"} (meta: {target}%)
    </div>
  );
}

export function StatsCards({ totalLeads, totalSpent, cpfApproved, salesConsortium, salesFinancing, salesLegacy, ghlData, ghlLoading }: StatsCardsProps) {
  const totalSales = salesConsortium + salesFinancing + salesLegacy;
  const qualified = cpfApproved + totalSales;
  const costPerLead = totalLeads > 0 ? (totalSpent / totalLeads).toFixed(2) : "—";
  const costPerQualified = qualified > 0 ? (totalSpent / qualified).toFixed(2) : "—";
  const costPerSale = totalSales > 0 ? (totalSpent / totalSales).toFixed(2) : "—";

  // GHL metrics
  const simulacoes = ghlData?.simulacoes ?? 0;
  const ghlAprovado = ghlData?.cpf_aprovado ?? 0;
  const ghlNaoAprovado = ghlData?.cpf_nao_aprovado ?? 0;

  // Conversion rates — corrected flow:
  // Leads → Simulações (60%), Simulações → CPF Aprovado (15%), CPF Aprovado → Vendas Financiamento (20%)
  const simRate = totalLeads > 0 ? (simulacoes / totalLeads) * 100 : 0;
  const aprovRate = simulacoes > 0 ? (ghlAprovado / simulacoes) * 100 : 0;
  const vendasFinancRate = ghlAprovado > 0 ? (salesFinancing / ghlAprovado) * 100 : 0;

  const cards = [
    {
      title: "Total de Leads",
      value: totalLeads.toLocaleString("pt-BR"),
      icon: Users,
      color: "text-violet-400",
    },
    {
      title: "Investimento",
      value: `R$ ${totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-purple-300",
    },
    {
      title: "Custo / Lead",
      value: costPerLead === "—" ? "—" : `R$ ${costPerLead}`,
      icon: TrendingDown,
      color: "text-fuchsia-400",
    },
    {
      title: "Simulações",
      value: ghlLoading ? "..." : simulacoes.toLocaleString("pt-BR"),
      icon: BarChart3,
      color: "text-cyan-400",
      indicator: ghlData ? { label: "Sim/Leads", value: simRate, target: 60 } : undefined,
    },
    {
      title: "CPF Aprovado",
      value: ghlLoading ? "..." : ghlAprovado.toLocaleString("pt-BR"),
      icon: CheckCircle,
      color: "text-green-400",
      indicator: ghlData ? { label: "Aprov/Sim", value: aprovRate, target: 15 } : undefined,
    },
    {
      title: "CPF Não Aprovado",
      value: ghlLoading ? "..." : ghlNaoAprovado.toLocaleString("pt-BR"),
      icon: XCircle,
      color: "text-red-400",
    },
    {
      title: "Vendas Consórcio",
      value: salesConsortium.toLocaleString("pt-BR"),
      icon: Handshake,
      color: "text-blue-400",
    },
    {
      title: "Vendas Financiamento",
      value: salesFinancing.toLocaleString("pt-BR"),
      icon: CreditCard,
      color: "text-amber-400",
      indicator: ghlData ? { label: "Fin/Aprov", value: vendasFinancRate, target: 20 } : undefined,
    },
    {
      title: "Custo / Qualificado",
      value: costPerQualified === "—" ? "—" : `R$ ${costPerQualified}`,
      icon: TrendingDown,
      color: "text-violet-300",
    },
    {
      title: "Custo / Venda",
      value: costPerSale === "—" ? "—" : `R$ ${costPerSale}`,
      icon: TrendingDown,
      subtitle: `Total: ${totalSales}`,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-5 gap-3">
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
            {card.indicator && (
              <MetaIndicator {...card.indicator} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
