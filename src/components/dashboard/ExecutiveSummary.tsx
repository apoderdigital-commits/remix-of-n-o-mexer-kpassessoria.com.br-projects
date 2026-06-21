import { Activity, TrendingUp, TrendingDown, Minus, Sparkles, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useMemo, useState } from "react";
import { CreativePreviewDialog } from "./CreativePreviewDialog";

interface ExecutiveSummaryProps {
  totalLeads: number;
  totalSpent: number;
  cpl: number;
  simulacoes: number;
  cpfAprovado: number;
  vendasFinanciamento: number;
  vendasConsorcio: number;
  previous?: {
    totalLeads: number;
    totalSpent: number;
    cpl: number;
    simulacoes: number;
    cpfAprovado: number;
    vendasFinanciamento: number;
    vendasConsorcio: number;
  } | null;
  // Para detectar criativos em alta/queda
  leadsByDate?: { creative_name: string; lead_date: string; status: string }[];
  onJumpTo?: (target: "funnel" | "creatives" | "sellers") => void;
}

const fmtPct = (n: number) => {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
};

function deltaPct(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return ((curr - prev) / prev) * 100;
}

function shortenName(name: string, max = 32) {
  if (!name) return "";
  if (name.startsWith("http")) {
    try {
      const u = new URL(name);
      const path = u.hostname + u.pathname;
      return path.length > max ? path.slice(0, max) + "…" : path;
    } catch {
      // fallthrough
    }
  }
  return name.length > max ? name.slice(0, max) + "…" : name;
}

export function ExecutiveSummary({
  totalLeads,
  cpl,
  cpfAprovado,
  vendasFinanciamento,
  vendasConsorcio,
  previous,
  leadsByDate = [],
  onJumpTo,
}: ExecutiveSummaryProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const openPreview = (name: string) => {
    if (!name) return;
    setPreviewUrl(name);
    setPreviewOpen(true);
  };

  const monthName = useMemo(
    () => new Date().toLocaleDateString("pt-BR", { month: "long" }),
    []
  );

  // ===== Detecta criativos em alta / queda (últimos 14 dias) =====
  const movers = useMemo(() => {
    if (!leadsByDate.length)
      return {
        rising: null as null | { name: string; pct: number },
        falling: null as null | { name: string; pct: number },
      };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff14 = new Date(today);
    cutoff14.setDate(cutoff14.getDate() - 14);
    const cutoff7 = new Date(today);
    cutoff7.setDate(cutoff7.getDate() - 7);
    const recent = leadsByDate.filter(
      (l) =>
        (l.status === "cpf_approved" ||
          l.status === "sale_financing" ||
          l.status === "sale_consortium" ||
          l.status === "sale") &&
        new Date(l.lead_date + "T00:00:00") >= cutoff14
    );
    const map = new Map<string, { last7: number; prev7: number }>();
    recent.forEach((l) => {
      const d = new Date(l.lead_date + "T00:00:00");
      const bucket = d >= cutoff7 ? "last7" : "prev7";
      const cur = map.get(l.creative_name) || { last7: 0, prev7: 0 };
      cur[bucket] += 1;
      map.set(l.creative_name, cur);
    });
    let rising: { name: string; pct: number } | null = null;
    let falling: { name: string; pct: number } | null = null;
    map.forEach((v, name) => {
      if (v.last7 + v.prev7 < 4) return; // ignora ruído
      if (v.prev7 === 0) {
        if (!rising || v.last7 > rising.pct / 100) rising = { name, pct: 100 };
        return;
      }
      const pct = ((v.last7 - v.prev7) / v.prev7) * 100;
      if (pct > 30 && (!rising || pct > rising.pct)) rising = { name, pct };
      if (pct < -30 && (!falling || pct < falling.pct)) falling = { name, pct };
    });
    return { rising, falling };
  }, [leadsByDate]);

  // ===== Comparativos mês anterior =====
  const deltas = previous
    ? {
        leads: deltaPct(totalLeads, previous.totalLeads),
        cpf: deltaPct(cpfAprovado, previous.cpfAprovado),
        sales: deltaPct(
          vendasFinanciamento + vendasConsorcio,
          previous.vendasFinanciamento + previous.vendasConsorcio
        ),
        cpl: cpl > 0 && previous.cpl > 0 ? deltaPct(cpl, previous.cpl) : null,
      }
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 via-card/60 to-background/60 backdrop-blur-sm p-4 sm:p-5">
      {/* glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-fuchsia-600 shadow-lg shadow-primary/20">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                Destaques do período
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-foreground capitalize leading-tight">
                O que mudou · {monthName}
              </h2>
            </div>
          </div>
        </div>

        {/* vs período anterior */}
        <div className="p-3 rounded-xl border border-border/40 bg-background/40">
          <div className="flex items-center gap-2 mb-2.5">
            <Activity className="h-3 w-3 text-cyan-400" />
            <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
              vs período anterior
            </p>
          </div>
          {deltas ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <DeltaRow label="Leads" pct={deltas.leads} />
              <DeltaRow label="Leads qualificados" pct={deltas.cpf} />
              <DeltaRow label="Vendas" pct={deltas.sales} />
              <DeltaRow label="CPL" pct={deltas.cpl} invertColor />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Sem dados suficientes do período anterior.
            </p>
          )}
        </div>

        {/* Ações sugeridas */}
        {(movers.rising || movers.falling) && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {movers.rising && (
              <button
                onClick={() => openPreview(movers.rising!.name)}
                className="group flex items-start gap-2.5 text-left p-3 rounded-xl border border-green-500/25 bg-gradient-to-br from-green-500/[0.08] to-transparent hover:border-green-500/50 transition-all"
              >
                <div className="p-1.5 rounded-lg bg-green-500/15 shrink-0">
                  <ArrowUpRight className="h-3.5 w-3.5 text-green-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-green-300">
                    Sugestão · Escalar
                  </p>
                  <p className="text-xs text-foreground/90 mt-0.5 truncate">
                    <span className="font-semibold">{shortenName(movers.rising.name)}</span> subiu{" "}
                    <span className="text-green-300 font-bold">+{movers.rising.pct.toFixed(0)}%</span>{" "}
                    nos últimos 7 dias.
                  </p>
                </div>
              </button>
            )}
            {movers.falling && (
              <button
                onClick={() => openPreview(movers.falling!.name)}
                className="group flex items-start gap-2.5 text-left p-3 rounded-xl border border-border/40 bg-background/30 hover:border-border/70 hover:bg-background/50 transition-all"
              >
                <div className="p-1.5 rounded-lg bg-muted/40 shrink-0">
                  <ArrowDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Avaliar pausa
                  </p>
                  <p className="text-xs text-foreground/80 mt-0.5 truncate">
                    <span className="font-medium text-foreground/90">{shortenName(movers.falling.name)}</span>{" "}
                    caiu{" "}
                    <span className="text-foreground font-semibold">{movers.falling.pct.toFixed(0)}%</span>{" "}
                    vs semana anterior.
                  </p>
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      <CreativePreviewDialog url={previewUrl} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}

function DeltaRow({
  label,
  pct,
  invertColor = false,
}: {
  label: string;
  pct: number | null;
  invertColor?: boolean;
}) {
  if (pct === null) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/60 font-medium text-sm">—</span>
      </div>
    );
  }
  const isUp = pct > 0.5;
  const isDown = pct < -0.5;
  const positive = invertColor ? isDown : isUp;
  const negative = invertColor ? isUp : isDown;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const color = positive
    ? "text-green-300"
    : negative
    ? "text-red-300"
    : "text-muted-foreground";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1 font-semibold text-sm ${color}`}>
        <Icon className="h-3 w-3" />
        {fmtPct(pct)}
      </span>
    </div>
  );
}
