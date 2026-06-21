import { TrendingDown, TrendingUp } from "lucide-react";

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
      className={`flex-1 rounded-xl px-5 py-4 flex flex-col gap-2.5 border ${
        invalid
          ? "bg-muted/10 border-border/20"
          : ok
          ? "bg-green-500/5 border-green-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`text-2xl font-black tracking-tight ${
              invalid
                ? "text-muted-foreground/30"
                : ok
                ? "text-green-400"
                : "text-amber-400"
            }`}
          >
            {label}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
            {description}
          </span>
        </div>

        {!invalid && (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              ok
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}
          >
            {ok ? "✓ ok" : "↑ acima"}
          </span>
        )}
      </div>

      {/* Values row */}
      <div className="flex items-baseline gap-4">
        <p
          className={`text-xl font-bold leading-none ${
            invalid
              ? "text-muted-foreground/40"
              : ok
              ? "text-green-300"
              : "text-amber-300"
          }`}
        >
          {invalid ? "—" : fmtMoney(value!)}
        </p>
        <p className="text-sm text-muted-foreground/50">
          máx <span className="font-semibold text-muted-foreground/70">{fmtMoney(max)}</span>
        </p>
      </div>

      {/* Progress bar */}
      {!invalid && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted/25 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                ok
                  ? "bg-gradient-to-r from-green-500 to-emerald-400"
                  : "bg-gradient-to-r from-amber-500 to-yellow-400"
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <p
            className={`text-[10px] flex items-center gap-1 ${
              ok ? "text-green-500/70" : "text-amber-500/70"
            }`}
          >
            {ok ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <TrendingUp className="h-3 w-3" />
            )}
            {ok ? `${fmtMoney(diff)} abaixo` : `${fmtMoney(diff)} acima`}
            <span className="ml-auto text-muted-foreground/40">{pct.toFixed(0)}% do máx</span>
          </p>
        </div>
      )}
    </div>
  );
}

export function CostBanner({ totalSpent, vendasFinanciamento, cpfAprovado }: CostBannerProps) {
  const cpv = vendasFinanciamento > 0 ? totalSpent / vendasFinanciamento : null;
  const cpmql = cpfAprovado > 0 ? totalSpent / cpfAprovado : null;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <CostBlock label="CPV" description="Custo por Venda" value={cpv} max={MAX_CPV} />
      <CostBlock label="CPMQL" description="Custo por Lead Qualificado" value={cpmql} max={MAX_CPMQL} />
    </div>
  );
}
