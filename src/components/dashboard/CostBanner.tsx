import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

interface CostBannerProps {
  totalSpent: number;
  vendasFinanciamento: number;
  cpfAprovado: number;
}

const MAX_CPV = 150;
const MAX_CPMQL = 35;

function fmtMoney(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CostBlock({
  label,
  description,
  value,
  max,
}: {
  label: string;
  description: string;
  value: number | null;
  max: number;
}) {
  const invalid = value === null || !isFinite(value) || value <= 0;
  const ok = !invalid && value! <= max;
  const pct = invalid ? 0 : Math.min(160, (value! / max) * 100);
  const diff = invalid ? 0 : Math.abs(value! - max);

  return (
    <div
      className={`flex-1 rounded-2xl p-6 flex flex-col gap-4 border transition-all ${
        invalid
          ? "bg-muted/10 border-border/20"
          : ok
          ? "bg-green-500/8 border-green-500/25 shadow-[0_0_40px_-10px_rgba(34,197,94,0.2)]"
          : "bg-red-500/8 border-red-500/25 shadow-[0_0_40px_-10px_rgba(239,68,68,0.2)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
            {description}
          </p>
          <h2
            className={`text-5xl font-black tracking-tight leading-none mt-1 ${
              invalid
                ? "text-muted-foreground/40"
                : ok
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {label}
          </h2>
        </div>

        {!invalid && (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${
              ok
                ? "bg-green-500/15 text-green-300 border border-green-500/30"
                : "bg-red-500/15 text-red-300 border border-red-500/30"
            }`}
          >
            {ok ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {ok ? "Dentro do limite" : "Acima do limite"}
          </div>
        )}
      </div>

      {/* Values */}
      <div className="flex items-end gap-8">
        <div>
          <p className="text-[11px] text-muted-foreground/60 mb-1 uppercase tracking-wide">
            Atual no período
          </p>
          <p
            className={`text-3xl font-black leading-none ${
              invalid
                ? "text-muted-foreground/40"
                : ok
                ? "text-green-300"
                : "text-red-300"
            }`}
          >
            {invalid ? "—" : fmtMoney(value!)}
          </p>
        </div>

        <div className="pb-0.5">
          <p className="text-[11px] text-muted-foreground/60 mb-1 uppercase tracking-wide">
            Máximo ideal
          </p>
          <p className="text-xl font-bold text-foreground/50">{fmtMoney(max)}</p>
        </div>
      </div>

      {/* Progress bar */}
      {!invalid && (
        <div className="space-y-2">
          <div className="relative h-3 rounded-full bg-muted/30 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                ok
                  ? "bg-gradient-to-r from-green-500 to-emerald-400"
                  : "bg-gradient-to-r from-red-500 to-red-400"
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
            {/* Target marker at 100% */}
            <div className="absolute top-0 right-0 bottom-0 w-px bg-white/20" />
          </div>

          <div className="flex items-center justify-between">
            <p
              className={`text-xs font-semibold flex items-center gap-1 ${
                ok ? "text-green-400" : "text-red-400"
              }`}
            >
              {ok ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              {ok
                ? `${fmtMoney(diff)} abaixo do limite`
                : `${fmtMoney(diff)} acima do limite`}
            </p>
            <p
              className={`text-xs font-bold ${
                ok ? "text-green-400/70" : "text-red-400/70"
              }`}
            >
              {pct.toFixed(0)}% do máximo
            </p>
          </div>
        </div>
      )}

      {invalid && (
        <p className="text-xs text-muted-foreground/50 italic">
          Sem dados suficientes para calcular no período selecionado.
        </p>
      )}
    </div>
  );
}

export function CostBanner({ totalSpent, vendasFinanciamento, cpfAprovado }: CostBannerProps) {
  const cpv = vendasFinanciamento > 0 ? totalSpent / vendasFinanciamento : null;
  const cpmql = cpfAprovado > 0 ? totalSpent / cpfAprovado : null;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <CostBlock
        label="CPV"
        description="Custo por Venda"
        value={cpv}
        max={MAX_CPV}
      />
      <CostBlock
        label="CPMQL"
        description="Custo por Lead Qualificado"
        value={cpmql}
        max={MAX_CPMQL}
      />
    </div>
  );
}
