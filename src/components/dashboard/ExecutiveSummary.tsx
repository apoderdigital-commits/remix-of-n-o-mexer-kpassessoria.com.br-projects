import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Sparkles, ArrowUpRight, ArrowDownRight, Target } from "lucide-react";
import { useMemo } from "react";

interface CreativeStat {
  name: string;
  count: number;
  percentage: number;
}

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
  // Vendedores
  sellersConv?: { name: string; count: number }[];
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

function shortenName(name: string, max = 26) {
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
  totalSpent,
  cpl,
  simulacoes,
  cpfAprovado,
  vendasFinanciamento,
  vendasConsorcio,
  previous,
  leadsByDate = [],
  onJumpTo,
}: ExecutiveSummaryProps) {
  // ===== Health score =====
  const health = useMemo(() => {
    const reasons: { type: "good" | "bad"; text: string }[] = [];
    let score = 50;

    // Sim/Leads (meta 60%)
    if (totalLeads > 0) {
      const rate = (simulacoes / totalLeads) * 100;
      if (rate >= 60) {
        score += 15;
        reasons.push({ type: "good", text: `Simulações em ${rate.toFixed(0)}% (meta 60%)` });
      } else {
        score -= 10;
        reasons.push({ type: "bad", text: `Simulações em ${rate.toFixed(0)}% — abaixo da meta 60%` });
      }
    }

    // Aprov/Sim (meta 15-20%)
    if (simulacoes > 0) {
      const rate = (cpfAprovado / simulacoes) * 100;
      if (rate >= 15) {
        score += 15;
        reasons.push({ type: "good", text: `Aprovação em ${rate.toFixed(0)}% das simulações` });
      } else {
        score -= 10;
        reasons.push({ type: "bad", text: `Aprovação só ${rate.toFixed(0)}% das simulações — meta 15%` });
      }
    }

    // Fin/Aprov (meta 20-25%)
    if (cpfAprovado > 0) {
      const rate = (vendasFinanciamento / cpfAprovado) * 100;
      if (rate >= 20) {
        score += 20;
        reasons.push({ type: "good", text: `Conversão venda em ${rate.toFixed(0)}% dos aprovados` });
      } else {
        score -= 15;
        reasons.push({ type: "bad", text: `Conversão venda em ${rate.toFixed(0)}% — meta 20%` });
      }
    }

    score = Math.max(0, Math.min(100, score));
    const status: "saudavel" | "atencao" | "critico" =
      score >= 70 ? "saudavel" : score >= 45 ? "atencao" : "critico";

    return { score, status, reasons };
  }, [totalLeads, simulacoes, cpfAprovado, vendasFinanciamento]);

  // ===== Ritmo do mês =====
  const pacing = useMemo(() => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const totalDays = monthEnd.getDate();
    const dayOfMonth = today.getDate();
    const monthIso = monthStart.toISOString().slice(0, 7);

    // Filtra leads do mês corrente
    const monthLeads = leadsByDate.filter((l) => l.lead_date?.slice(0, 7) === monthIso);
    const monthCpf = monthLeads.filter((l) => l.status === "cpf_approved").length;
    const monthSales = monthLeads.filter(
      (l) => l.status === "sale_financing" || l.status === "sale_consortium" || l.status === "sale"
    ).length;
    const dailyAvgSales = dayOfMonth > 0 ? monthSales / dayOfMonth : 0;
    const projectedSales = Math.round(dailyAvgSales * totalDays);
    const dailyAvgCpf = dayOfMonth > 0 ? monthCpf / dayOfMonth : 0;
    const projectedCpf = Math.round(dailyAvgCpf * totalDays);

    return {
      monthName: today.toLocaleDateString("pt-BR", { month: "long" }),
      dayOfMonth,
      totalDays,
      projectedSales,
      projectedCpf,
      monthCpf,
      monthSales,
    };
  }, [leadsByDate]);

  // ===== Detecta criativos em alta / queda (últimos 14 dias) =====
  const movers = useMemo(() => {
    if (!leadsByDate.length) return { rising: null as null | { name: string; pct: number }, falling: null as null | { name: string; pct: number } };
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

  const statusConfig = {
    saudavel: {
      label: "Saudável",
      color: "text-green-300",
      bg: "bg-green-500/10",
      border: "border-green-500/40",
      dot: "bg-green-400",
      ring: "ring-green-500/30",
      Icon: CheckCircle2,
    },
    atencao: {
      label: "Atenção",
      color: "text-amber-300",
      bg: "bg-amber-500/10",
      border: "border-amber-500/40",
      dot: "bg-amber-400",
      ring: "ring-amber-500/30",
      Icon: AlertTriangle,
    },
    critico: {
      label: "Crítico",
      color: "text-red-300",
      bg: "bg-red-500/10",
      border: "border-red-500/40",
      dot: "bg-red-400",
      ring: "ring-red-500/30",
      Icon: AlertTriangle,
    },
  }[health.status];

  const StatusIcon = statusConfig.Icon;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 via-card/60 to-background/60 backdrop-blur-sm p-5 sm:p-6">
      {/* glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-fuchsia-600 shadow-lg shadow-primary/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                Resumo Executivo
              </p>
              <h2 className="text-base sm:text-lg font-semibold text-foreground capitalize leading-tight">
                Status da operação · {pacing.monthName}
              </h2>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ring-1 ${statusConfig.bg} ${statusConfig.border} ${statusConfig.ring}`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${statusConfig.dot}`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${statusConfig.dot}`} />
            </span>
            <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.color}`} />
            <span className={`text-xs font-semibold ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            <span className="text-[10px] text-muted-foreground/80 font-medium pl-0.5 border-l border-border/40 ml-0.5">
              score {health.score}/100
            </span>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Coluna 1 — Pacing do mês */}
          <button
            onClick={() => onJumpTo?.("funnel")}
            className="text-left group p-4 rounded-xl border border-border/40 bg-background/40 hover:border-primary/40 hover:bg-background/60 transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Ritmo do mês
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground leading-none">
              {pacing.projectedSales.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              vendas projetadas até dia {pacing.totalDays}
            </p>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="text-foreground/80 font-medium">{pacing.monthSales}</span> realizadas
              <span className="text-muted-foreground/50">·</span>
              <span className="text-foreground/80 font-medium">{pacing.monthCpf}</span> CPFs aprovados
            </div>
            <p className="mt-2 text-[10px] text-primary/70 group-hover:text-primary transition-colors">
              Ver funil →
            </p>
          </button>

          {/* Coluna 2 — Variação vs mês anterior */}
          <div className="p-4 rounded-xl border border-border/40 bg-background/40">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                vs período anterior
              </p>
            </div>
            {deltas ? (
              <div className="space-y-1.5 mt-1">
                <DeltaRow label="Leads" pct={deltas.leads} />
                <DeltaRow label="CPFs aprovados" pct={deltas.cpf} />
                <DeltaRow label="Vendas" pct={deltas.sales} />
                <DeltaRow label="CPL" pct={deltas.cpl} invertColor />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic mt-2">
                Sem dados suficientes do período anterior.
              </p>
            )}
          </div>

          {/* Coluna 3 — Saúde / motivos */}
          <div className="p-4 rounded-xl border border-border/40 bg-background/40">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Por que esse status
              </p>
            </div>
            <ul className="space-y-1.5 mt-1">
              {health.reasons.length === 0 && (
                <li className="text-xs text-muted-foreground italic">
                  Aguardando dados suficientes para diagnóstico.
                </li>
              )}
              {health.reasons.slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-snug">
                  <span
                    className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                      r.type === "good" ? "bg-green-400" : "bg-amber-400"
                    }`}
                  />
                  <span className={r.type === "good" ? "text-foreground/85" : "text-amber-200/90"}>
                    {r.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Ações sugeridas */}
        {(movers.rising || movers.falling) && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {movers.rising && (
              <button
                onClick={() => onJumpTo?.("creatives")}
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
                onClick={() => onJumpTo?.("creatives")}
                className="group flex items-start gap-2.5 text-left p-3 rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-transparent hover:border-amber-500/50 transition-all"
              >
                <div className="p-1.5 rounded-lg bg-amber-500/15 shrink-0">
                  <ArrowDownRight className="h-3.5 w-3.5 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-amber-300">
                    Atenção · Avaliar pausa
                  </p>
                  <p className="text-xs text-foreground/90 mt-0.5 truncate">
                    <span className="font-semibold">{shortenName(movers.falling.name)}</span> caiu{" "}
                    <span className="text-amber-300 font-bold">{movers.falling.pct.toFixed(0)}%</span>{" "}
                    vs semana anterior.
                  </p>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
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
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/60 font-medium">—</span>
      </div>
    );
  }
  const isUp = pct > 0.5;
  const isDown = pct < -0.5;
  // Para CPL, subir é ruim (invertColor)
  const positive = invertColor ? isDown : isUp;
  const negative = invertColor ? isUp : isDown;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const color = positive
    ? "text-green-300"
    : negative
    ? "text-red-300"
    : "text-muted-foreground";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1 font-semibold ${color}`}>
        <Icon className="h-3 w-3" />
        {fmtPct(pct)}
      </span>
    </div>
  );
}
