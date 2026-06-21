import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, CheckCircle, TrendingDown, CreditCard, Handshake, XCircle, BarChart3, Image, ImagePlus, ArrowLeftRight, ArrowUp, ArrowDown, Minus } from "lucide-react";

interface DayCompare {
  today: number;
  yesterday: number;
  avg7d: number;
  todayDate?: string;      // dd/mm/yyyy
  yesterdayDate?: string;  // dd/mm/yyyy
  rangeStart?: string;     // dd/mm
  rangeEnd?: string;       // dd/mm
}

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
    vendas_financiamento?: number;
    vendas_consorcio?: number;
  } | null;
  ghlLoading?: boolean;
  onScrollTo?: (target: "cpf" | "consortium" | "financing") => void;
  comparisons?: {
    spent?: DayCompare;
    leads?: DayCompare;
    cpf?: DayCompare;
  };
  previousPeriod?: {
    totalLeads: number;
    totalSpent: number;
    cpl: number;
    simulacoes: number;
    cpfAprovado: number;
    vendasFinanciamento: number;
    vendasConsorcio: number;
  } | null;
}

function PrevDelta({
  current,
  previous,
  invertColor = false,
  format,
}: {
  current: number;
  previous: number | null | undefined;
  invertColor?: boolean;
  format?: (n: number) => string;
}) {
  if (previous === null || previous === undefined) return null;
  if (previous === 0 && current === 0) return null;
  let pct: number;
  if (previous === 0) pct = 100;
  else pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0.5;
  const isDown = pct < -0.5;
  const positive = invertColor ? isDown : isUp;
  const negative = invertColor ? isUp : isDown;
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  const color = positive ? "text-green-400" : negative ? "text-red-400" : "text-muted-foreground";
  const sign = pct > 0 ? "+" : "";
  return (
    <p className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold ${color}`}>
      <Icon className="h-2.5 w-2.5" />
      {sign}
      {pct.toFixed(1)}% vs anterior
      {format && (
        <span className="text-muted-foreground/70 font-normal ml-0.5">
          ({format(previous)})
        </span>
      )}
    </p>
  );
}

function CompareLine({ data, format }: { data: DayCompare; format: (n: number) => string }) {
  const { today, yesterday, avg7d, todayDate, yesterdayDate, rangeStart, rangeEnd } = data;
  const Arrow = today > yesterday ? ArrowUp : today < yesterday ? ArrowDown : Minus;
  const arrowColor =
    today > yesterday
      ? "text-green-400"
      : today < yesterday
      ? "text-red-400"
      : "text-muted-foreground";
  return (
    <div className="mt-1.5 space-y-0.5 text-[12px] text-muted-foreground leading-snug">
      <div className="flex items-center gap-1">
        <Arrow className={`h-3 w-3 shrink-0 ${arrowColor}`} />
        <span className="text-foreground/85 font-medium">Hoje</span>
        {todayDate && <span className="text-muted-foreground/60">({todayDate})</span>}
        <span className="text-foreground/85">: {format(today)}</span>
      </div>
      <div className="pl-4">
        <span className="text-foreground/70">Ontem</span>
        {yesterdayDate && <span className="text-muted-foreground/60"> ({yesterdayDate})</span>}
        <span>: {format(yesterday)}</span>
      </div>
      <div className="pl-4">
        <span className="text-foreground/70">Média 7d</span>
        {rangeStart && rangeEnd && (
          <span className="text-muted-foreground/60"> ({rangeStart} – {rangeEnd})</span>
        )}
        <span>: {format(avg7d)}</span>
      </div>
    </div>
  );
}

function MetaIndicator({ label, value, target }: { label: string; value: number; target: number }) {
  const met = value >= target;
  return (
    <div
      className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        met
          ? "border-green-500/30 bg-green-500/10 text-green-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
      }`}
      title={`Meta: ${target}%`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${met ? "bg-green-400" : "bg-amber-400"}`} />
      {label}: {value.toFixed(1)}%
      <span className="text-muted-foreground/70 font-normal">· meta {target}%</span>
    </div>
  );
}

function CostIndicator({ label, value, target, denominatorLabel }: { label: string; value: number; target: number; denominatorLabel?: string }) {
  if (!isFinite(value) || value <= 0) return null;
  const ok = value <= target;
  return (
    <div
      className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        ok
          ? "border-green-500/30 bg-green-500/10 text-green-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
      title={`Máx ideal: R$ ${target.toLocaleString("pt-BR")}${denominatorLabel ? ` por ${denominatorLabel}` : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />
      {label}: R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      <span className="text-muted-foreground/70 font-normal">· máx R$ {target}</span>
    </div>
  );
}

function SourceToggle({ source, onToggle }: { source: "ghl" | "planilha"; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors"
      title="Alternar entre CRM e Planilha"
    >
      <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
      <span className={source === "ghl" ? "text-cyan-300" : "text-emerald-300"}>
        {source === "ghl" ? "CRM" : "Planilha"}
      </span>
    </button>
  );
}

export function StatsCards({ totalLeads, totalSpent, salesConsortium, salesFinancing, uniqueCreativesCpf, uniqueCreativesSales, planilhaCpfApproved, ghlData, ghlLoading, onScrollTo, comparisons, previousPeriod }: StatsCardsProps) {
  const [simSource, setSimSource] = useState<"ghl" | "planilha">("ghl");
  const [cpfAprovSource, setCpfAprovSource] = useState<"ghl" | "planilha">("ghl");
  const [cpfNaoSource, setCpfNaoSource] = useState<"ghl" | "planilha">("ghl");
  const [vendasFinSource, setVendasFinSource] = useState<"ghl" | "planilha">("ghl");
  const [vendasConsSource, setVendasConsSource] = useState<"ghl" | "planilha">("ghl");

  const costPerLead = totalLeads > 0 ? (totalSpent / totalLeads).toFixed(2) : "—";

  const simulacoes = ghlData?.simulacoes ?? 0;
  const ghlAprovado = ghlData?.cpf_aprovado ?? 0;
  const ghlNaoAprovado = ghlData?.cpf_nao_aprovado ?? 0;
  const ghlVendasFin = ghlData?.vendas_financiamento ?? 0;
  const ghlVendasCons = ghlData?.vendas_consorcio ?? 0;

  // Planilha doesn't have simulações or CPF não aprovado, so show "—" 
  const planilhaSimulacoes = planilhaCpfApproved; // Only CPF approved from planilha as approximation
  const planilhaNaoAprovado = 0; // Not tracked in planilha

  const simRate = totalLeads > 0 ? (simulacoes / totalLeads) * 100 : 0;
  const aprovRate = simulacoes > 0 ? (ghlAprovado / simulacoes) * 100 : 0;
  const displayVendasFin = vendasFinSource === "ghl" ? ghlVendasFin : salesFinancing;
  const displayVendasCons = vendasConsSource === "ghl" ? ghlVendasCons : salesConsortium;
  const vendasFinancRate = ghlAprovado > 0 ? (displayVendasFin / ghlAprovado) * 100 : 0;

  // Current displayed values based on source toggle
  const displaySimulacoes = simSource === "ghl" ? simulacoes : planilhaSimulacoes;
  const displayCpfAprovado = cpfAprovSource === "ghl" ? ghlAprovado : planilhaCpfApproved;
  const displayCpfNaoAprovado = cpfNaoSource === "ghl" ? ghlNaoAprovado : planilhaNaoAprovado;

  const fmtMoney = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

  const cards = [
    // Row 1 - Funnel
    {
      title: "Investimento",
      value: `R$ ${totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-purple-300",
      accent: "263 60% 65%",
      compare: comparisons?.spent ? { data: comparisons.spent, format: fmtMoney } : undefined,
      prev: previousPeriod?.totalSpent,
      prevFormat: fmtMoney,
    },
    {
      title: "Total de Leads",
      value: totalLeads.toLocaleString("pt-BR"),
      icon: Users,
      color: "text-violet-400",
      accent: "255 70% 65%",
      compare: comparisons?.leads ? { data: comparisons.leads, format: fmtInt } : undefined,
      prev: previousPeriod?.totalLeads,
      prevFormat: fmtInt,
    },
    {
      title: "Custo / Lead",
      value: costPerLead === "—" ? "—" : `R$ ${costPerLead}`,
      icon: TrendingDown,
      color: "text-fuchsia-400",
      accent: "300 70% 65%",
      insight: "Referência de mercado para CPL no setor é de R$ 6 a R$ 8. Quanto mais baixo, melhor o aproveitamento do investimento.",
      prev: previousPeriod?.cpl,
      prevFormat: fmtMoney,
      prevInvert: true,
      currentForPrev: totalLeads > 0 ? totalSpent / totalLeads : 0,
    },
    {
      title: "Simulações",
      value: ghlLoading && simSource === "ghl" ? "..." : displaySimulacoes.toLocaleString("pt-BR"),
      icon: BarChart3,
      color: "text-cyan-400",
      accent: "190 80% 55%",
      sourceToggle: { source: simSource, onToggle: () => setSimSource(s => s === "ghl" ? "planilha" : "ghl") },
      indicator: simSource === "ghl" && ghlData ? { label: "Sim/Leads", value: simRate, target: 60 } : undefined,
      note: simSource === "planilha" ? "Leads qualificados (planilha)" : undefined,
      insight: simSource === "ghl" && ghlData && totalLeads > 0
        ? (() => {
            const target = Math.round(totalLeads * 0.6);
            const diff = simulacoes - target;
            const status = diff >= 0
              ? `acima da meta em ${diff} simulações`
              : `faltam ${Math.abs(diff)} para bater a meta`;
            return `Atual: ${simulacoes} (${simRate.toFixed(1)}%) · esperado: ${target} (60% dos leads). Estamos ${status}.`;
          })()
        : undefined,
      prev: simSource === "ghl" ? previousPeriod?.simulacoes : undefined,
      prevFormat: fmtInt,
      currentForPrev: displaySimulacoes,
    },
    {
      title: "Lead Qualificado",
      value: ghlLoading && cpfAprovSource === "ghl" ? "..." : displayCpfAprovado.toLocaleString("pt-BR"),
      icon: CheckCircle,
      color: "text-green-400",
      accent: "142 65% 50%",
      sourceToggle: { source: cpfAprovSource, onToggle: () => setCpfAprovSource(s => s === "ghl" ? "planilha" : "ghl") },
      indicator: cpfAprovSource === "ghl" && ghlData ? { label: "Aprov/Sim", value: aprovRate, target: 15 } : undefined,

      scrollTarget: "cpf" as const,
      compare: comparisons?.cpf ? { data: comparisons.cpf, format: fmtInt } : undefined,
      prev: cpfAprovSource === "ghl" ? previousPeriod?.cpfAprovado : undefined,
      prevFormat: fmtInt,
      currentForPrev: displayCpfAprovado,
    },
    // Row 2 - Results
    {
      title: "CPF Não Aprovado",
      value: ghlLoading && cpfNaoSource === "ghl" ? "..." : (cpfNaoSource === "planilha" ? "—" : displayCpfNaoAprovado.toLocaleString("pt-BR")),
      icon: XCircle,
      color: "text-red-400",
      accent: "0 70% 60%",
      sourceToggle: { source: cpfNaoSource, onToggle: () => setCpfNaoSource(s => s === "ghl" ? "planilha" : "ghl") },
      note: cpfNaoSource === "planilha" ? "Não disponível na planilha" : undefined,
      insight: "Estamos otimizando todo o projeto continuamente para buscar a maior taxa de qualificação possível dos leads.",
    },
    {
      title: "Vendas Totais",
      value: ghlLoading && vendasFinSource === "ghl" ? "..." : displayVendasFin.toLocaleString("pt-BR"),
      icon: CreditCard,
      color: "text-amber-400",
      accent: "35 85% 55%",
      sourceToggle: { source: vendasFinSource, onToggle: () => setVendasFinSource(s => s === "ghl" ? "planilha" : "ghl") },
      indicator: ghlData ? { label: "Fin/Aprov", value: vendasFinancRate, target: 20 } : undefined,

      scrollTarget: "financing" as const,
      insight: ghlData && ghlAprovado > 0
        ? (() => {
            const target = Math.round(ghlAprovado * 0.2);
            const diff = displayVendasFin - target;
            const status = diff >= 0
              ? `acima da meta em ${diff} vendas`
              : `faltam ${Math.abs(diff)} para bater a meta`;
            return `Atual: ${displayVendasFin} (${vendasFinancRate.toFixed(1)}%) · esperado: ${target} (20% dos Leads Qualificados). Estamos ${status}.`;
          })()
        : undefined,
      prev: vendasFinSource === "ghl" ? previousPeriod?.vendasFinanciamento : previousPeriod?.vendasFinanciamento,
      prevFormat: fmtInt,
      currentForPrev: displayVendasFin,
    },
    {
      title: "Vendas Consórcio",
      value: ghlLoading && vendasConsSource === "ghl" ? "..." : displayVendasCons.toLocaleString("pt-BR"),
      icon: Handshake,
      color: "text-blue-400",
      accent: "210 75% 60%",
      sourceToggle: { source: vendasConsSource, onToggle: () => setVendasConsSource(s => s === "ghl" ? "planilha" : "ghl") },
      scrollTarget: "consortium" as const,
      insight: (() => {
        const base = displayCpfNaoAprovado;
        if (!base || base <= 0) {
          return "Em média, de 3% a 5% dos CPFs não aprovados se convertem em vendas de consórcio.";
        }
        const min = Math.round(base * 0.03);
        const max = Math.round(base * 0.05);
        return `Em média, 3% a 5% dos CPFs não aprovados viram consórcio. Atual: ${displayVendasCons} · esperado: ${min} a ${max}.`;
      })(),
      prev: previousPeriod?.vendasConsorcio,
      prevFormat: fmtInt,
      currentForPrev: displayVendasCons,
    },
    {
      title: "Criativos c/ Lead Qual.",
      value: uniqueCreativesCpf.toLocaleString("pt-BR"),
      icon: Image,
      color: "text-emerald-400",
      accent: "160 65% 50%",
      subtitle: "Planilha",
      largeValue: true,
      insight: "Meta: manter sempre pelo menos 15 criativos validados rodando ao mesmo tempo para sustentar o volume de aprovações.",
    },
    {
      title: "Criativos c/ Vendas",
      value: uniqueCreativesSales.toLocaleString("pt-BR"),
      icon: ImagePlus,
      color: "text-orange-400",
      accent: "25 85% 60%",
      subtitle: "Planilha",
      largeValue: true,
      insight: "Continuando o trabalho de validação: a média é alcançar 15 criativos validados em até 3 meses de operação.",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-5 gap-3 auto-rows-fr">
      {cards.map((card) => {
        const clickable = !!(card as any).scrollTarget && !!onScrollTo;
        const accent = (card as any).accent as string | undefined;
        return (
          <Card
            key={card.title}
            onClick={clickable ? () => onScrollTo!((card as any).scrollTarget) : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={clickable ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onScrollTo!((card as any).scrollTarget);
              }
            } : undefined}
            style={accent ? { borderLeft: `3px solid hsl(${accent} / 0.7)` } : undefined}
            className={`group relative overflow-hidden glass-card border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_8px_30px_-10px_hsl(var(--primary)/0.4)] h-full flex flex-col ${
              clickable ? "cursor-pointer" : ""
            }`}
          >
            {/* Subtle accent glow */}
            {accent && (
              <div
                className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"
                style={{ background: `hsl(${accent})` }}
              />
            )}
            <CardContent className="relative p-3 flex flex-col h-full">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-md border transition-transform duration-300 group-hover:scale-110"
                  style={accent ? {
                    background: `hsl(${accent} / 0.12)`,
                    borderColor: `hsl(${accent} / 0.3)`,
                  } : undefined}
                >
                  <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  {card.title}
                </span>
              </div>
              <p className={`${(card as any).largeValue ? "text-2xl" : "text-lg"} font-bold tracking-tight text-foreground leading-none`}>{card.value}</p>
              {(card as any).compare && (
                <CompareLine {...(card as any).compare} />
              )}
              {(card as any).prev !== undefined && (card as any).prev !== null && (
                <PrevDelta
                  current={
                    (card as any).currentForPrev !== undefined
                      ? (card as any).currentForPrev
                      : card.title === "Investimento"
                      ? totalSpent
                      : card.title === "Total de Leads"
                      ? totalLeads
                      : 0
                  }
                  previous={(card as any).prev}
                  invertColor={(card as any).prevInvert}
                  format={(card as any).prevFormat}
                />
              )}
              {card.sourceToggle && (
                <SourceToggle {...card.sourceToggle} />
              )}
              {card.subtitle && !card.sourceToggle && (
                <p className="text-[10px] text-muted-foreground/70 mt-1.5">{card.subtitle}</p>
              )}
              {card.note && (
                <p className="text-[10px] text-muted-foreground/60 mt-1 italic">{card.note}</p>
              )}
              {card.indicator && (
                <MetaIndicator {...card.indicator} />
              )}
              {(card as any).costIndicator && (
                <CostIndicator {...(card as any).costIndicator} />
              )}
              {(card as any).insight && (
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground/75">
                  {(card as any).insight}
                </p>
              )}
              {clickable && (
                <p className="mt-auto pt-2 text-[10px] font-medium text-primary/80 group-hover:text-primary transition-colors">
                  Clique para ver os criativos →
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
