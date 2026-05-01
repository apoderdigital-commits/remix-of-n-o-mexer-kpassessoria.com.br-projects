import { useEffect, useState } from "react";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AIContext } from "@/lib/aiContext";

interface SummaryResult {
  headline: string;
  funcionando: string[];
  atencao: string[];
  proximos_passos: string[];
}

interface AlertItem {
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
}
interface OpportunityItem {
  title: string;
  description: string;
  action: string;
}
interface AlertsResult {
  alerts: AlertItem[];
  opportunities: OpportunityItem[];
}

interface AIInsightsProps {
  buildContext: () => AIContext | null;
  disabled?: boolean;
}

type Tab = "summary" | "alerts";

export function AIInsights({ buildContext, disabled }: AIInsightsProps) {
  const [tab, setTab] = useState<Tab>("summary");
  const [loading, setLoading] = useState<Tab | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [alerts, setAlerts] = useState<AlertsResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<{ summary?: string; alerts?: string }>({});
  const [open, setOpen] = useState(false);
  const [checkingCache, setCheckingCache] = useState(false);

  // Identifica o "escopo" atual (cliente + período) para invalidar estado quando muda
  const ctxProbe = buildContext();
  const scopeKey = ctxProbe
    ? `${ctxProbe.clientId || ""}|${ctxProbe.period.since}|${ctxProbe.period.until}`
    : "";

  // Reset + tenta carregar do cache quando o escopo (cliente/período) mudar
  useEffect(() => {
    setSummary(null);
    setAlerts(null);
    setGeneratedAt({});
    setOpen(false);

    const ctx = buildContext();
    if (!ctx?.clientId) return;

    let cancelled = false;
    setCheckingCache(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("ai_insights_cache")
          .select("mode, result, created_at")
          .eq("client_id", ctx.clientId!)
          .eq("since", ctx.period.since)
          .eq("until", ctx.period.until)
          .in("mode", ["summary", "alerts"]);
        if (cancelled || !data) return;
        const next: typeof generatedAt = {};
        data.forEach((row: any) => {
          if (row.mode === "summary") setSummary(row.result as SummaryResult);
          if (row.mode === "alerts") setAlerts(row.result as AlertsResult);
          next[row.mode as Tab] = row.created_at;
        });
        if (Object.keys(next).length) setGeneratedAt(next);
      } finally {
        if (!cancelled) setCheckingCache(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const generate = async (mode: Tab, force = false) => {
    const ctx = buildContext();
    if (!ctx) {
      toast.error("Sem dados suficientes para gerar análise");
      return;
    }
    setLoading(mode);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: { mode, force, ...ctx },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (mode === "summary") setSummary((data as any).result as SummaryResult);
      else setAlerts((data as any).result as AlertsResult);
      setGeneratedAt((g) => ({ ...g, [mode]: (data as any).generatedAt || new Date().toISOString() }));
      setOpen(true);
      if ((data as any).cached) {
        toast.info("Análise carregada do cache deste período");
      }
    } catch (e: any) {
      const msg = e?.message || "Falha ao gerar análise";
      if (msg.includes("429") || msg.toLowerCase().includes("limite"))
        toast.error("Limite de uso da IA excedido. Tente em alguns minutos.");
      else if (msg.includes("402") || msg.toLowerCase().includes("crédito"))
        toast.error("Créditos da IA esgotados. Adicione mais no workspace.");
      else toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const hasAny = !!(summary || alerts);
  const hasCurrent = tab === "summary" ? !!summary : !!alerts;
  const ts = generatedAt[tab];
  const tsLabel = ts
    ? new Date(ts).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card/60 to-background/60 backdrop-blur-sm p-4 sm:p-5">
      <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-fuchsia-600 shadow-lg shadow-primary/20">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-primary">
                Análise com IA
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-foreground leading-tight">
                Resumo executivo & alertas inteligentes
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tsLabel && hasAny && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                gerado em {tsLabel}
              </span>
            )}

            {!hasAny && (
              <Button
                size="sm"
                onClick={() => generate(tab, false)}
                disabled={disabled || loading !== null || checkingCache}
                className="gap-1.5 h-8"
              >
                {loading !== null || checkingCache ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Gerar análise
              </Button>
            )}

            {hasAny && (
              <>
                <Button
                  size="sm"
                  variant={open ? "outline" : "default"}
                  onClick={() => setOpen((v) => !v)}
                  className="gap-1.5 h-8"
                >
                  {open ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Recolher
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      Abrir análise
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generate(tab, true)}
                  disabled={disabled || loading !== null}
                  className="gap-1.5 h-8"
                  title="Forçar nova geração ignorando o cache"
                >
                  {loading === tab ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Regenerar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Conteúdo só aparece quando aberto */}
        {open && (
          <div className="mt-4 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-background/40 border border-border/30 w-fit">
              <button
                onClick={() => setTab("summary")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  tab === "summary"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Lightbulb className="h-3 w-3" /> Resumo
                </span>
              </button>
              <button
                onClick={() => setTab("alerts")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  tab === "alerts"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Alertas & oportunidades
                </span>
              </button>
            </div>

            {!hasCurrent && (
              <div className="rounded-xl border border-dashed border-border/40 bg-background/20 px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  {tab === "summary"
                    ? "Ainda não há resumo gerado para este período."
                    : "Ainda não há alertas gerados para este período."}
                </p>
                <Button
                  size="sm"
                  onClick={() => generate(tab, false)}
                  disabled={disabled || loading !== null}
                  className="gap-1.5"
                >
                  {loading === tab ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Gerar {tab === "summary" ? "resumo" : "alertas"}
                </Button>
              </div>
            )}

            {tab === "summary" && summary && <SummaryView data={summary} />}
            {tab === "alerts" && alerts && <AlertsView data={alerts} />}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryView({ data }: { data: SummaryResult }) {
  return (
    <div className="space-y-4">
      <p className="text-sm sm:text-base font-medium text-foreground/95 leading-relaxed">
        {data.headline}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Section
          title="O que está funcionando"
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-300" />}
          tone="green"
          items={data.funcionando}
        />
        <Section
          title="Pontos de atenção"
          icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
          tone="amber"
          items={data.atencao}
        />
        <Section
          title="Próximos passos"
          icon={<ArrowRight className="h-3.5 w-3.5 text-primary" />}
          tone="primary"
          items={data.proximos_passos}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  tone,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "green" | "amber" | "primary";
  items: string[];
}) {
  const toneClasses = {
    green: "border-green-500/20 bg-green-500/[0.04]",
    amber: "border-amber-500/20 bg-amber-500/[0.04]",
    primary: "border-primary/25 bg-primary/[0.05]",
  }[tone];
  const dotClasses = {
    green: "bg-green-400/80",
    amber: "bg-amber-400/80",
    primary: "bg-primary/80",
  }[tone];

  return (
    <div className={`rounded-xl border p-3.5 ${toneClasses}`}>
      <div className="flex items-center gap-1.5 mb-2.5">
        {icon}
        <p className="text-[10px] uppercase tracking-wider font-bold text-foreground/85">{title}</p>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground/85 leading-snug">
            <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${dotClasses}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AlertsView({ data }: { data: AlertsResult }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-amber-300 mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" /> Alertas ({data.alerts.length})
        </p>
        <div className="space-y-2">
          {data.alerts.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum alerta crítico detectado.</p>
          )}
          {data.alerts.map((a, i) => (
            <AlertCard key={i} item={a} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-green-300 mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" /> Oportunidades ({data.opportunities.length})
        </p>
        <div className="space-y-2">
          {data.opportunities.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhuma oportunidade destacada.</p>
          )}
          {data.opportunities.map((o, i) => (
            <OpportunityCard key={i} item={o} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ item }: { item: AlertItem }) {
  const sevColor = {
    high: "border-red-500/30 bg-red-500/[0.06]",
    medium: "border-amber-500/30 bg-amber-500/[0.06]",
    low: "border-border/40 bg-background/30",
  }[item.severity];
  const sevLabel = { high: "Alto", medium: "Médio", low: "Baixo" }[item.severity];
  const sevBadge = {
    high: "bg-red-500/20 text-red-300",
    medium: "bg-amber-500/20 text-amber-300",
    low: "bg-muted/40 text-muted-foreground",
  }[item.severity];

  return (
    <div className={`rounded-xl border p-3 ${sevColor}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-foreground">{item.title}</p>
        <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${sevBadge}`}>
          {sevLabel}
        </span>
      </div>
      <p className="text-xs text-foreground/75 mb-1.5 leading-snug">{item.description}</p>
      <p className="text-[11px] text-primary/90 leading-snug">
        <span className="font-semibold">Ação:</span> {item.action}
      </p>
    </div>
  );
}

function OpportunityCard({ item }: { item: OpportunityItem }) {
  return (
    <div className="rounded-xl border border-green-500/25 bg-green-500/[0.05] p-3">
      <p className="text-xs font-semibold text-foreground mb-1">{item.title}</p>
      <p className="text-xs text-foreground/75 mb-1.5 leading-snug">{item.description}</p>
      <p className="text-[11px] text-green-300 leading-snug">
        <span className="font-semibold">Ação:</span> {item.action}
      </p>
    </div>
  );
}
