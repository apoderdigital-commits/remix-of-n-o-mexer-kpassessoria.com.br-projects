import { useState, useMemo } from "react";
import { AlertTriangle, AlertOctagon, X, ArrowDown } from "lucide-react";

interface AlertBannerProps {
  totalLeads: number;
  simulacoes: number;
  cpfAprovado: number;
  vendasFinanciamento: number;
  onScrollToFunnel: () => void;
}

type AlertItem = {
  id: string;
  level: "warning" | "critical";
  message: string;
};

export function AlertBanner({
  totalLeads,
  simulacoes,
  cpfAprovado,
  vendasFinanciamento,
  onScrollToFunnel,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts: AlertItem[] = useMemo(() => {
    const list: AlertItem[] = [];

    if (totalLeads > 0) {
      const simRate = (simulacoes / totalLeads) * 100;
      if (simRate < 60) {
        list.push({
          id: "sim-lead",
          level: "warning",
          message: `Simulações abaixo da meta — Sim/Lead atual: ${simRate.toFixed(1)}%. Meta: 60%.`,
        });
      }
    }

    if (simulacoes > 0) {
      const aprovRate = (cpfAprovado / simulacoes) * 100;
      if (aprovRate < 20) {
        list.push({
          id: "aprov-sim",
          level: "warning",
          message: `Aprovação de CPF abaixo da meta — atual: ${aprovRate.toFixed(1)}%. Meta: 20%.`,
        });
      }
    }

    if (cpfAprovado > 0) {
      const finRate = (vendasFinanciamento / cpfAprovado) * 100;
      if (finRate < 25) {
        if (vendasFinanciamento === 0) {
          list.push({
            id: "fin-aprov",
            level: "critical",
            message:
              "Conversão em venda zerada — nenhum CPF aprovado virou venda ainda.",
          });
        } else {
          list.push({
            id: "fin-aprov",
            level: "critical",
            message: `Conversão em venda crítica — Fin/Aprov atual: ${finRate.toFixed(1)}%. Meta: 25%.`,
          });
        }
      }
    }

    return list;
  }, [totalLeads, simulacoes, cpfAprovado, vendasFinanciamento]);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((alert) => {
        const isCritical = alert.level === "critical";
        const Icon = isCritical ? AlertOctagon : AlertTriangle;
        return (
          <div
            key={alert.id}
            role="alert"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-sm ${
              isCritical
                ? "border-red-500/40 bg-red-500/10"
                : "border-amber-500/40 bg-amber-500/10"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isCritical
                  ? "bg-red-500/20 text-red-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p
                className={`text-sm font-medium ${
                  isCritical ? "text-red-100" : "text-amber-100"
                }`}
              >
                {alert.message}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onScrollToFunnel}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  isCritical
                    ? "border-red-400/40 bg-red-500/20 text-red-100 hover:bg-red-500/30"
                    : "border-amber-400/40 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                }`}
              >
                <ArrowDown className="h-3 w-3" />
                Ver funil
              </button>
              <button
                onClick={() =>
                  setDismissed((prev) => new Set(prev).add(alert.id))
                }
                aria-label="Dispensar alerta"
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  isCritical
                    ? "text-red-200/70 hover:bg-red-500/20 hover:text-red-100"
                    : "text-amber-200/70 hover:bg-amber-500/20 hover:text-amber-100"
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
