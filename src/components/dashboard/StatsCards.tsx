import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, CheckCircle, TrendingDown, CreditCard, Handshake, XCircle, BarChart3, Image, ImagePlus, ArrowLeftRight } from "lucide-react";

interface StatsCardsProps {
  totalLeads: number;
  totalSpent: number;
  salesConsortium: number;
  salesFinancing: number;
  uniqueCreativesCpf: number;
  uniqueCreativesSales: number;
  planilhaCpfApproved: number;
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

function SourceToggle({ source, onToggle }: { source: "ghl" | "planilha"; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-0.5 hover:text-muted-foreground transition-colors cursor-pointer"
      title="Alternar entre GHL e Planilha"
    >
      <ArrowLeftRight className="h-3 w-3" />
      <span className={source === "ghl" ? "text-cyan-400/80 text-sm" : "text-emerald-400/80 text-sm"}>
        {source === "ghl" ? "GHL" : "Planilha"}
      </span>
    </button>
  );
}

export function StatsCards({ totalLeads, totalSpent, salesConsortium, salesFinancing, uniqueCreativesCpf, uniqueCreativesSales, planilhaCpfApproved, ghlData, ghlLoading }: StatsCardsProps) {
  const [simSource, setSimSource] = useState<"ghl" | "planilha">("ghl");
  const [cpfAprovSource, setCpfAprovSource] = useState<"ghl" | "planilha">("ghl");
  const [cpfNaoSource, setCpfNaoSource] = useState<"ghl" | "planilha">("ghl");

  const costPerLead = totalLeads > 0 ? (totalSpent / totalLeads).toFixed(2) : "—";

  const simulacoes = ghlData?.simulacoes ?? 0;
  const ghlAprovado = ghlData?.cpf_aprovado ?? 0;
  const ghlNaoAprovado = ghlData?.cpf_nao_aprovado ?? 0;

  // Planilha doesn't have simulações or CPF não aprovado, so show "—" 
  const planilhaSimulacoes = planilhaCpfApproved; // Only CPF approved from planilha as approximation
  const planilhaNaoAprovado = 0; // Not tracked in planilha

  const simRate = totalLeads > 0 ? (simulacoes / totalLeads) * 100 : 0;
  const aprovRate = simulacoes > 0 ? (ghlAprovado / simulacoes) * 100 : 0;
  const vendasFinancRate = ghlAprovado > 0 ? (salesFinancing / ghlAprovado) * 100 : 0;

  // Current displayed values based on source toggle
  const displaySimulacoes = simSource === "ghl" ? simulacoes : planilhaSimulacoes;
  const displayCpfAprovado = cpfAprovSource === "ghl" ? ghlAprovado : planilhaCpfApproved;
  const displayCpfNaoAprovado = cpfNaoSource === "ghl" ? ghlNaoAprovado : planilhaNaoAprovado;

  const cards = [
    // Row 1 - Funnel
    {
      title: "Investimento",
      value: `R$ ${totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-purple-300",
    },
    {
      title: "Total de Leads",
      value: totalLeads.toLocaleString("pt-BR"),
      icon: Users,
      color: "text-violet-400",
    },
    {
      title: "Custo / Lead",
      value: costPerLead === "—" ? "—" : `R$ ${costPerLead}`,
      icon: TrendingDown,
      color: "text-fuchsia-400",
    },
    {
      title: "Simulações",
      value: ghlLoading && simSource === "ghl" ? "..." : displaySimulacoes.toLocaleString("pt-BR"),
      icon: BarChart3,
      color: "text-cyan-400",
      sourceToggle: { source: simSource, onToggle: () => setSimSource(s => s === "ghl" ? "planilha" : "ghl") },
      indicator: simSource === "ghl" && ghlData ? { label: "Sim/Leads", value: simRate, target: 60 } : undefined,
      note: simSource === "planilha" ? "CPFs aprovados (planilha)" : undefined,
    },
    {
      title: "CPF Aprovado",
      value: ghlLoading && cpfAprovSource === "ghl" ? "..." : displayCpfAprovado.toLocaleString("pt-BR"),
      icon: CheckCircle,
      color: "text-green-400",
      sourceToggle: { source: cpfAprovSource, onToggle: () => setCpfAprovSource(s => s === "ghl" ? "planilha" : "ghl") },
      indicator: cpfAprovSource === "ghl" && ghlData ? { label: "Aprov/Sim", value: aprovRate, target: 15 } : undefined,
    },
    // Row 2 - Results
    {
      title: "CPF Não Aprovado",
      value: ghlLoading && cpfNaoSource === "ghl" ? "..." : (cpfNaoSource === "planilha" ? "—" : displayCpfNaoAprovado.toLocaleString("pt-BR")),
      icon: XCircle,
      color: "text-red-400",
      sourceToggle: { source: cpfNaoSource, onToggle: () => setCpfNaoSource(s => s === "ghl" ? "planilha" : "ghl") },
      note: cpfNaoSource === "planilha" ? "Não disponível na planilha" : undefined,
    },
    {
      title: "Vendas Financiamento",
      value: salesFinancing.toLocaleString("pt-BR"),
      icon: CreditCard,
      color: "text-amber-400",
      subtitle: "Planilha",
      indicator: ghlData ? { label: "Fin/Aprov", value: vendasFinancRate, target: 20 } : undefined,
    },
    {
      title: "Vendas Consórcio",
      value: salesConsortium.toLocaleString("pt-BR"),
      icon: Handshake,
      color: "text-blue-400",
      subtitle: "Planilha",
    },
    {
      title: "Criativos c/ CPF Aprov.",
      value: uniqueCreativesCpf.toLocaleString("pt-BR"),
      icon: Image,
      color: "text-emerald-400",
      subtitle: "Planilha",
    },
    {
      title: "Criativos c/ Vendas",
      value: uniqueCreativesSales.toLocaleString("pt-BR"),
      icon: ImagePlus,
      color: "text-orange-400",
      subtitle: "Planilha",
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
            {card.sourceToggle && (
              <SourceToggle {...card.sourceToggle} />
            )}
            {card.subtitle && !card.sourceToggle && (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{card.subtitle}</p>
            )}
            {card.note && (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 italic">{card.note}</p>
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
