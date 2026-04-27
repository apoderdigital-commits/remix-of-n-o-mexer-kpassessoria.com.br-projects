import { useState } from "react";
import { Users, Calculator, CheckCircle2, Banknote, ArrowDown, Target, AlertTriangle, CheckCheck, Eye, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface GoalsFunnelProps {
  totalLeads: number;
  ghlSimulacoes: number;
  ghlCpfApproved: number;
  planilhaCpfApproved: number;
  salesFinancing: number;
  onScrollTo: (target: "cpf" | "financing") => void;
}

const META_SIMULACOES = 60; // % dos leads
const META_CPF = 20; // % das simulacoes
const META_VENDAS = 25; // % dos cpfs aprovados

const formatNumber = (n: number) => Math.round(n).toLocaleString("pt-BR");

interface StepProps {
  label: string;
  icon: any;
  value: number;
  baseValue?: number;
  metaPct?: number;
  metaLabel?: string;
  gradient: string;
  textColor: string;
  highlight?: boolean;
  extra?: React.ReactNode;
}

function FunnelStep({ label, icon: Icon, value, baseValue, metaPct, metaLabel, gradient, textColor, highlight, extra }: StepProps) {
  const metaQty = baseValue !== undefined && metaPct !== undefined ? Math.ceil(baseValue * (metaPct / 100)) : null;
  const achievedPct = baseValue && baseValue > 0 ? (value / baseValue) * 100 : 0;
  const hitGoal = metaQty !== null ? value >= metaQty : true;
  const missing = metaQty !== null ? Math.max(0, metaQty - value) : 0;
  const missingPct = metaQty !== null && metaPct !== undefined ? Math.max(0, metaPct - achievedPct) : 0;

  return (
    <div className={`flex flex-col gap-3 p-5 rounded-2xl border transition-all ${
      highlight ? "bg-gradient-to-r from-fuchsia-900/40 to-pink-900/40 border-fuchsia-500/40 shadow-lg shadow-fuchsia-500/10" : "bg-card/60 border-border/30"
    }`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-md`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className={`text-xs uppercase tracking-wide ${textColor}`}>{label}</p>
            <p className="text-2xl font-bold text-foreground">{formatNumber(value)}</p>
            {metaLabel && <p className="text-xs text-muted-foreground">{metaLabel}</p>}
          </div>
        </div>

        {metaQty !== null && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-2 rounded-xl bg-muted/30 border border-border/30 text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 justify-end">
                <Target className="h-3 w-3" /> Meta
              </p>
              <p className="text-sm font-semibold text-foreground">{formatNumber(metaQty)} <span className="text-muted-foreground text-xs">({metaPct}%)</span></p>
            </div>
            {hitGoal ? (
              <div className="px-3 py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-right">
                <p className="text-[10px] uppercase tracking-wide text-green-400 flex items-center gap-1 justify-end">
                  <CheckCheck className="h-3 w-3" /> Bateu
                </p>
                <p className="text-sm font-semibold text-green-300">{achievedPct.toFixed(1)}%</p>
              </div>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-right">
                <p className="text-[10px] uppercase tracking-wide text-amber-400 flex items-center gap-1 justify-end">
                  <AlertTriangle className="h-3 w-3" /> Faltou
                </p>
                <p className="text-sm font-semibold text-amber-300">
                  {formatNumber(missing)} <span className="text-amber-400/80 text-xs">({missingPct.toFixed(1)}%)</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {extra && <div className="pt-1">{extra}</div>}
    </div>
  );
}

export function GoalsFunnel({ totalLeads, ghlSimulacoes, ghlCpfApproved, planilhaCpfApproved, salesFinancing, onScrollTo }: GoalsFunnelProps) {
  const [showCpfCompare, setShowCpfCompare] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 shadow-lg">
          <Target className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Funil de Metas</h2>
          <p className="text-sm text-muted-foreground">Acompanhe quanto cada etapa bateu vs. a meta esperada</p>
        </div>
      </div>

      <div className="space-y-2">
        <FunnelStep
          label="Leads"
          icon={Users}
          value={totalLeads}
          gradient="from-violet-600 to-purple-700"
          textColor="text-violet-300"
          metaLabel="Base do funil — 100% dos leads captados"
        />
        <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground/50" /></div>

        <FunnelStep
          label="Simulações (GHL)"
          icon={Calculator}
          value={ghlSimulacoes}
          baseValue={totalLeads}
          metaPct={META_SIMULACOES}
          metaLabel={`Mín. ${META_SIMULACOES}% dos leads precisam simular`}
          gradient="from-blue-600 to-blue-700"
          textColor="text-blue-300"
        />
        <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground/50" /></div>

        <FunnelStep
          label="CPFs Aprovados (GHL)"
          icon={CheckCircle2}
          value={ghlCpfApproved}
          baseValue={ghlSimulacoes}
          metaPct={META_CPF}
          metaLabel={`Mín. ${META_CPF}% das simulações precisam aprovar`}
          gradient="from-emerald-600 to-green-700"
          textColor="text-emerald-300"
          extra={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => setShowCpfCompare(true)}>
                <Eye className="h-3.5 w-3.5" /> GHL × Planilha
              </Button>
              <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => onScrollTo("cpf")}>
                <ArrowRight className="h-3.5 w-3.5" /> Ver criativos de CPF Aprovado
              </Button>
            </div>
          }
        />
        <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground/50" /></div>

        <FunnelStep
          label="Vendas Financiamento"
          icon={Banknote}
          value={salesFinancing}
          baseValue={ghlCpfApproved}
          metaPct={META_VENDAS}
          metaLabel={`Mín. ${META_VENDAS}% dos CPFs aprovados precisam virar venda`}
          gradient="from-fuchsia-600 to-pink-600"
          textColor="text-fuchsia-300"
          highlight
          extra={
            <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => onScrollTo("financing")}>
              <ArrowRight className="h-3.5 w-3.5" /> Ver criativos de Venda Financiamento
            </Button>
          }
        />
      </div>

      <Dialog open={showCpfCompare} onOpenChange={setShowCpfCompare}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CPFs Aprovados | GHL × Planilha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-400">GHL</p>
                <p className="text-xs text-muted-foreground">Pipeline automático</p>
              </div>
              <p className="text-2xl font-bold text-emerald-300">{formatNumber(ghlCpfApproved)}</p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-400">Planilha</p>
                <p className="text-xs text-muted-foreground">Registro por API</p>
              </div>
              <p className="text-2xl font-bold text-blue-300">{formatNumber(planilhaCpfApproved)}</p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Diferença</p>
                <p className="text-xs text-primary-foreground">GHL | Planilha</p>
              </div>
              <p className={`text-2xl font-bold ${ghlCpfApproved - planilhaCpfApproved >= 0 ? "text-foreground" : "text-amber-300"}`}>
                {ghlCpfApproved - planilhaCpfApproved >= 0 ? "+" : ""}{formatNumber(ghlCpfApproved - planilhaCpfApproved)}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
