import { useState } from "react";
import { Users, Calculator, CheckCircle2, Banknote, ArrowDown, Target, AlertTriangle, CheckCheck, Eye, ArrowRight, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface GoalsFunnelProps {
  totalLeads: number;
  ghlTotalLeads?: number;
  ghlSimulacoes: number;
  ghlCpfApproved: number;
  planilhaCpfApproved: number;
  salesFinancing: number;
  planilhaSalesFinancing?: number;
  ghlSalesFinancing?: number;
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
  description?: string;
  gradient: string;
  textColor: string;
  highlight?: boolean;
  extra?: React.ReactNode;
}

function FunnelStep({ label, icon: Icon, value, baseValue, metaPct, metaLabel, description, gradient, textColor, highlight, extra }: StepProps) {
  const metaQty = baseValue !== undefined && metaPct !== undefined ? Math.ceil(baseValue * (metaPct / 100)) : null;
  const achievedPct = baseValue && baseValue > 0 ? (value / baseValue) * 100 : 0;
  const hitGoal = metaQty !== null ? value >= metaQty : true;
  const missing = metaQty !== null ? Math.max(0, metaQty - value) : 0;
  const missingPct = metaQty !== null && metaPct !== undefined ? Math.max(0, metaPct - achievedPct) : 0;

  const progressPct = metaPct ? Math.min(100, (achievedPct / metaPct) * 100) : 0;

  return (
    <div className={`flex flex-col gap-4 p-5 rounded-2xl border transition-all ${
      highlight ? "bg-gradient-to-r from-fuchsia-900/40 to-pink-900/40 border-fuchsia-500/40 shadow-lg shadow-fuchsia-500/10" : "bg-card/60 border-border/30"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-md`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs uppercase tracking-wide ${textColor}`}>{label}</p>
          {metaLabel && <p className="text-xs text-muted-foreground">{metaLabel}</p>}
          {description && <p className="text-[11px] text-muted-foreground/60 italic mt-0.5">{description}</p>}
        </div>
      </div>

      {metaQty !== null ? (
        <>
          {/* Big comparison cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Realizado */}
            <div className={`p-4 rounded-xl border ${
              hitGoal ? "bg-green-500/10 border-green-500/30" : "bg-blue-500/10 border-blue-500/30"
            }`}>
              <p className={`text-[11px] uppercase tracking-wider font-semibold ${hitGoal ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400"}`}>
                Realizado
              </p>
              <p className="text-3xl font-bold text-foreground mt-1 leading-none">{formatNumber(value)}</p>
              <p className={`text-base font-semibold mt-1 ${hitGoal ? "text-green-700 dark:text-green-300" : "text-blue-700 dark:text-blue-300"}`}>
                {achievedPct.toFixed(1)}%
              </p>
              {baseValue !== undefined && (
                <p className="text-[11px] text-muted-foreground mt-1">de {formatNumber(baseValue)}</p>
              )}
            </div>

            {/* Meta */}
            <div className="p-4 rounded-xl border bg-muted/30 border-border/40">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" /> Meta
              </p>
              <p className="text-3xl font-bold text-foreground mt-1 leading-none">{formatNumber(metaQty)}</p>
              <p className="text-base font-semibold text-foreground/80 mt-1">{metaPct}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">esperado</p>
            </div>

            {/* Faltou ou Bateu */}
            {hitGoal ? (
              <div className="p-4 rounded-xl border bg-green-500/15 border-green-500/40">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> Bateu a meta
                </p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-1 leading-none">
                  +{formatNumber(value - metaQty)}
                </p>
                <p className="text-base font-semibold text-green-700 dark:text-green-300 mt-1">
                  +{(achievedPct - metaPct!).toFixed(1)}%
                </p>
                <p className="text-[11px] text-green-700/80 dark:text-green-400/80 mt-1">acima do mínimo</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl border bg-amber-500/10 border-amber-500/40">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Faltou
                </p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-300 mt-1 leading-none">
                  {formatNumber(missing)}
                </p>
                <p className="text-base font-semibold text-amber-700 dark:text-amber-300 mt-1">
                  {missingPct.toFixed(1)}%
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">para bater a meta</p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Progresso da meta</span>
              <span className={`font-semibold ${hitGoal ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}>
                {progressPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  hitGoal ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-amber-500 to-orange-400"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </>
      ) : (
        // Topo do funil (Leads) — sem meta comparativa
        <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
          <p className="text-3xl font-bold text-foreground leading-none">{formatNumber(value)}</p>
          <p className="text-xs text-muted-foreground mt-1">leads captados</p>
        </div>
      )}

      {extra && <div className="pt-1">{extra}</div>}
    </div>
  );
}

export function GoalsFunnel({ totalLeads, ghlTotalLeads, ghlSimulacoes, ghlCpfApproved, planilhaCpfApproved, salesFinancing, planilhaSalesFinancing, ghlSalesFinancing, onScrollTo }: GoalsFunnelProps) {
  const [leadSource, setLeadSource] = useState<"trafego" | "crm">("trafego");
  // Base do funil: tráfego (leads da Meta) ou todos os leads da pipeline do CRM (inclui orgânicos).
  const leadBase = leadSource === "crm" && ghlTotalLeads != null ? ghlTotalLeads : totalLeads;
  const [showCpfCompare, setShowCpfCompare] = useState(false);
  const [salesSource, setSalesSource] = useState<"planilha" | "ghl">("ghl");
  const [showSalesCompare, setShowSalesCompare] = useState(false);

  const planilhaSales = planilhaSalesFinancing ?? salesFinancing;
  const ghlSales = ghlSalesFinancing ?? 0;
  const displaySales = salesSource === "planilha" ? planilhaSales : ghlSales;
  const hasBothSources = ghlSalesFinancing !== undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 shadow-lg">
          <Target className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Funil de Metas Comerciais</h2>
          <p className="text-sm text-muted-foreground">Acompanhe quanto cada etapa bateu vs. a meta esperada</p>
        </div>
        {ghlTotalLeads != null && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground hidden sm:inline">Base de leads:</span>
            <div className="inline-flex rounded-lg border border-border/40 bg-secondary/30 p-0.5 text-xs">
              {([["trafego", "Tráfego"], ["crm", "Todos (CRM)"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setLeadSource(k)} className={`px-2.5 py-1 rounded transition ${leadSource === k ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FunnelStep
          label="Leads"
          icon={Users}
          value={leadBase}
          gradient="from-violet-600 to-purple-700"
          textColor="text-violet-700 dark:text-violet-300"
          metaLabel={leadSource === "crm" ? "Base do funil — todos os leads da pipeline (CRM, inclui orgânicos)" : "Base do funil — leads captados via tráfego"}
        />
        <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground/50" /></div>

        <FunnelStep
          label="Qualificações Realizadas (CRM)"
          icon={Calculator}
          value={ghlSimulacoes}
          baseValue={leadBase}
          metaPct={META_SIMULACOES}
          metaLabel={`Mín. ${META_SIMULACOES}% dos leads precisam ser qualificados`}
          description="Leads avaliados, com financiamento ou pagamento à vista/cartão."
          gradient="from-blue-600 to-blue-700"
          textColor="text-blue-700 dark:text-blue-300"
        />
        <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground/50" /></div>

        <FunnelStep
          label="Leads Qualificados (CRM)"
          icon={CheckCircle2}
          value={ghlCpfApproved}
          baseValue={ghlSimulacoes}
          metaPct={META_CPF}
          metaLabel={`Mín. ${META_CPF}% das qualificações precisam aprovar`}
          gradient="from-emerald-600 to-green-700"
          textColor="text-emerald-700 dark:text-emerald-300"
          extra={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => setShowCpfCompare(true)}>
                <Eye className="h-3.5 w-3.5" /> CRM × Planilha
              </Button>
              <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => onScrollTo("cpf")}>
                <ArrowRight className="h-3.5 w-3.5" /> Ver criativos de Lead Qualificado
              </Button>
            </div>
          }
        />
        <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground/50" /></div>

        <FunnelStep
          label={`Vendas Totais${hasBothSources ? ` (${salesSource === "ghl" ? "CRM" : "Planilha"})` : ""}`}
          icon={Banknote}
          value={displaySales}
          baseValue={ghlCpfApproved}
          metaPct={META_VENDAS}
          metaLabel={`Mín. ${META_VENDAS}% dos Leads Qualificados precisam virar venda`}
          gradient="from-fuchsia-600 to-pink-600"
          textColor="text-fuchsia-700 dark:text-fuchsia-300"
          highlight
          extra={
            <div className="flex flex-wrap gap-2">
              {hasBothSources && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 h-8"
                    onClick={() => setSalesSource(s => s === "ghl" ? "planilha" : "ghl")}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Ver {salesSource === "ghl" ? "Planilha" : "CRM"}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => setShowSalesCompare(true)}>
                    <Eye className="h-3.5 w-3.5" /> CRM × Planilha
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => onScrollTo("financing")}>
                <ArrowRight className="h-3.5 w-3.5" /> Ver criativos de Venda Total
              </Button>
            </div>
          }
        />
      </div>

      <Dialog open={showSalesCompare} onOpenChange={setShowSalesCompare}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vendas Totais | CRM × Planilha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">CRM</p>
                <p className="text-xs text-muted-foreground">Pipeline automático</p>
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatNumber(ghlSales)}</p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-400">Planilha</p>
                <p className="text-xs text-muted-foreground">Registro por API</p>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatNumber(planilhaSales)}</p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Diferença</p>
                <p className="text-xs text-primary-foreground">CRM | Planilha</p>
              </div>
              <p className={`text-2xl font-bold ${ghlSales - planilhaSales >= 0 ? "text-foreground" : "text-amber-700 dark:text-amber-300"}`}>
                {ghlSales - planilhaSales >= 0 ? "+" : ""}{formatNumber(ghlSales - planilhaSales)}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCpfCompare} onOpenChange={setShowCpfCompare}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leads Qualificados | CRM × Planilha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">CRM</p>
                <p className="text-xs text-muted-foreground">Pipeline automático</p>
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatNumber(ghlCpfApproved)}</p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-400">Planilha</p>
                <p className="text-xs text-muted-foreground">Registro por API</p>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatNumber(planilhaCpfApproved)}</p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Diferença</p>
                <p className="text-xs text-primary-foreground">CRM | Planilha</p>
              </div>
              <p className={`text-2xl font-bold ${ghlCpfApproved - planilhaCpfApproved >= 0 ? "text-foreground" : "text-amber-700 dark:text-amber-300"}`}>
                {ghlCpfApproved - planilhaCpfApproved >= 0 ? "+" : ""}{formatNumber(ghlCpfApproved - planilhaCpfApproved)}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
