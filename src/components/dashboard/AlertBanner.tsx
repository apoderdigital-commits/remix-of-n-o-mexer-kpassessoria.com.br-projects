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
          message: `Sim/Lead ${simRate.toFixed(1)}% · meta 60%`,
        });
      }
    }

    if (simulacoes > 0) {
      const aprovRate = (cpfAprovado / simulacoes) * 100;
      if (aprovRate < 20) {
        list.push({
          id: "aprov-sim",
          level: "warning",
          message: `Aprov/Sim ${aprovRate.toFixed(1)}% · meta 20%`,
        });
      }
    }

    if (cpfAprovado > 0) {
      const finRate = (vendasFinanciamento / cpfAprovado) * 100;
      if (finRate < 25) {
        list.push({
          id: "fin-aprov",
          level: "critical",
          message:
            vendasFinanciamento === 0
              ? "Fin/Aprov 0% — sem vendas"
              : `Fin/Aprov ${finRate.toFixed(1)}% · meta 25%`,
        });
      }
    }

    return list;
  }, [totalLeads, simulacoes, cpfAprovado, vendasFinanciamento]);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((alert) => {
        const isCritical = alert.level === "critical";
        const Icon = isCritical ? AlertOctagon : AlertTriangle;
        return (
          <div
            key={alert.id}
            role="alert"
            className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
              isCritical
                ? "border-red-500/25 bg-red-500/[0.06] text-red-200/90"
                : "border-amber-500/25 bg-amber-500/[0.06] text-amber-200/90"
            }`}
          >
            <Icon
              className={`h-3.5 w-3.5 shrink-0 ${
                isCritical ? "text-red-400" : "text-amber-400"
              }`}
            />
            <span className="font-medium whitespace-nowrap">{alert.message}</span>
            <button
              onClick={onScrollToFunnel}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                isCritical
                  ? "text-red-300 hover:bg-red-500/15"
                  : "text-amber-300 hover:bg-amber-500/15"
              }`}
            >
              <ArrowDown className="h-2.5 w-2.5" />
              funil
            </button>
            <button
              onClick={() =>
                setDismissed((prev) => new Set(prev).add(alert.id))
              }
              aria-label="Dispensar"
              className={`flex h-4 w-4 items-center justify-center rounded transition-colors ${
                isCritical
                  ? "text-red-300/60 hover:bg-red-500/15 hover:text-red-200"
                  : "text-amber-300/60 hover:bg-amber-500/15 hover:text-amber-200"
              }`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
