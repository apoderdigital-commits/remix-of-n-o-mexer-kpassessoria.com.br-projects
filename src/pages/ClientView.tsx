/**
 * /view?lid=<ghl_location_id>
 * Página pública (sem login) embutida via iframe no GoHighLevel.
 * Renderiza o dashboard completo de criativos para o cliente
 * identificado pelo location ID da subconta GHL.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { format, subDays } from "date-fns";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import kpLogo from "@/assets/kp-logo.png";

import { StatsCards } from "@/components/dashboard/StatsCards";
import { CreativeRanking } from "@/components/dashboard/CreativeRanking";
import { EvolutionChart } from "@/components/dashboard/EvolutionChart";
import { SellerRanking } from "@/components/dashboard/SellerRanking";
import { GoalsFunnel } from "@/components/dashboard/GoalsFunnel";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { ExecutiveSummary } from "@/components/dashboard/ExecutiveSummary";
import { MonthlyTrend } from "@/components/dashboard/MonthlyTrend";
import { CostBanner } from "@/components/dashboard/CostBanner";
import { ThemeToggle } from "@/components/ThemeToggle";

import {
  useMetaCampaigns,
  useQualifiedLeads,
  useSyncMeta,
  useSyncGoogleSheet,
  useGhlPipeline,
  usePreviousPeriodData,
  useMonthlyTrend,
} from "@/hooks/useDashboardData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── busca cliente pelo ghl_location_id ───────────────────────────────────────
async function fetchClientByLocationId(lid: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, google_sheet_id, ticket_medio, meta_account_id")
    .eq("ghl_location_id", lid)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; name: string; google_sheet_id: string | null; ticket_medio: number | null; meta_account_id: string | null };
}

// ── componente principal ──────────────────────────────────────────────────────
export default function ClientView() {
  const [params] = useSearchParams();
  const locationId = params.get("lid");

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [loadingClient, setLoadingClient] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [since, setSince] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [until, setUntil] = useState(format(new Date(), "yyyy-MM-dd"));
  const [syncing, setSyncing] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [syncingGhl, setSyncingGhl] = useState(false);

  const funnelRef = useRef<HTMLDivElement>(null);
  const creativesRef = useRef<HTMLDivElement>(null);
  const sellersRef = useRef<HTMLDivElement>(null);
  const rankingRefs = {
    cpf: useRef<HTMLDivElement>(null),
    consortium: useRef<HTMLDivElement>(null),
    financing: useRef<HTMLDivElement>(null),
  };

  const queryClient = useQueryClient();

  // busca o cliente pelo location ID
  useEffect(() => {
    if (!locationId) { setLoadingClient(false); setNotFound(true); return; }
    fetchClientByLocationId(locationId).then((c) => {
      if (!c) { setNotFound(true); } else { setClientId(c.id); setClientName(c.name); }
      setLoadingClient(false);
    });
  }, [locationId]);

  // ── hooks de dados (mesmos do Criativos) ─────────────────────────────────
  const { data: campaigns } = useMetaCampaigns(clientId, since, until);
  const { data: leads } = useQualifiedLeads(clientId, since, until);
  const { data: ghlData, isLoading: ghlLoading } = useGhlPipeline(clientId, since, until);
  const { data: previousPeriod } = usePreviousPeriodData(clientId, since, until);
  const { data: monthlyTrend } = useMonthlyTrend(clientId, 6);
  const { sync } = useSyncMeta(clientId);
  const { sync: syncSheet } = useSyncGoogleSheet(clientId);

  // ── sincronização ─────────────────────────────────────────────────────────
  const handleSyncAll = async () => {
    if (!clientId) return;
    setSyncing(true); setSyncingSheet(true); setSyncingGhl(true);
    try {
      await Promise.allSettled([
        sync(since, until).catch(() => null),
        syncSheet(since, until).catch(() => null),
        queryClient.invalidateQueries({ queryKey: ["ghl_pipeline", clientId] }),
      ]);
      queryClient.invalidateQueries({ queryKey: ["meta_campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["qualified_leads"] });
      toast.success("Dados sincronizados!");
    } catch { toast.error("Erro ao sincronizar"); }
    setSyncing(false); setSyncingSheet(false); setSyncingGhl(false);
  };

  // ── cálculos (idênticos ao Criativos) ────────────────────────────────────
  const totalLeads = useMemo(() => (campaigns || []).reduce((s, c) => s + c.leads_total, 0), [campaigns]);
  const totalSpent = useMemo(() => (campaigns || []).reduce((s, c) => s + Number(c.amount_spent), 0), [campaigns]);
  const planilhaCpfApproved = useMemo(() => (leads || []).filter((l) => l.status === "cpf_approved").length, [leads]);
  const salesConsortium = useMemo(() => (leads || []).filter((l) => l.status === "sale_consortium").length, [leads]);
  const salesFinancing = useMemo(() => (leads || []).filter((l) => l.status === "sale_financing").length, [leads]);
  const salesLegacy = useMemo(() => (leads || []).filter((l) => l.status === "sale").length, [leads]);
  const uniqueCreativesCpf = useMemo(() => new Set((leads || []).filter((l) => l.status === "cpf_approved").map((l) => l.creative_name)).size, [leads]);
  const uniqueCreativesSales = useMemo(() => new Set((leads || []).filter((l) => l.status === "sale_financing" || l.status === "sale_consortium").map((l) => l.creative_name)).size, [leads]);

  const buildRanking = (statuses: string[]) => {
    const filtered = (leads || []).filter((l) => statuses.includes(l.status));
    const map = new Map<string, number>();
    filtered.forEach((l) => map.set(l.creative_name, (map.get(l.creative_name) || 0) + 1));
    const total = filtered.length;
    return Array.from(map.entries()).map(([name, count]) => ({ name, count, percentage: total > 0 ? (count / total) * 100 : 0 })).sort((a, b) => b.count - a.count);
  };
  const cpfRanking = useMemo(() => buildRanking(["cpf_approved"]), [leads]);
  const consortiumRanking = useMemo(() => buildRanking(["sale_consortium"]), [leads]);
  const financingRanking = useMemo(() => buildRanking(["sale_financing"]), [leads]);

  const buildSellerRanking = (statuses: string[]) => {
    const filtered = (leads || []).filter((l) => statuses.includes(l.status) && l.seller_name);
    const map = new Map<string, number>();
    filtered.forEach((l) => map.set(l.seller_name!, (map.get(l.seller_name!) || 0) + 1));
    const total = filtered.length;
    return Array.from(map.entries()).map(([name, count]) => ({ name, count, percentage: total > 0 ? (count / total) * 100 : 0 })).sort((a, b) => b.count - a.count);
  };
  const sellerCpfRanking = useMemo(() => buildSellerRanking(["cpf_approved"]), [leads]);
  const sellerConsortiumRanking = useMemo(() => buildSellerRanking(["sale_consortium"]), [leads]);
  const sellerFinancingRanking = useMemo(() => buildSellerRanking(["sale_financing"]), [leads]);

  const evolutionData = useMemo(() => {
    const dateMap = new Map<string, { leads: number; cpf: number; sales: number; spent: number }>();
    (campaigns || []).forEach((c) => {
      const e = dateMap.get(c.date) || { leads: 0, cpf: 0, sales: 0, spent: 0 };
      e.leads += c.leads_total; e.spent += Number(c.amount_spent) || 0;
      dateMap.set(c.date, e);
    });
    (leads || []).forEach((l) => {
      const e = dateMap.get(l.lead_date) || { leads: 0, cpf: 0, sales: 0, spent: 0 };
      if (l.status === "cpf_approved") e.cpf += 1;
      else if (["sale_consortium", "sale_financing", "sale"].includes(l.status)) e.sales += 1;
      dateMap.set(l.lead_date, e);
    });
    return Array.from(dateMap.entries()).map(([date, vals]) => ({ date, ...vals })).sort((a, b) => a.date.localeCompare(b.date));
  }, [campaigns, leads]);

  const buildComparison = (key: "spent" | "leads" | "cpf") => {
    if (!evolutionData.length) return { today: 0, yesterday: 0, avg7d: 0 };
    const byDate = new Map(evolutionData.map((d) => [d.date, d]));
    const latestDate = new Date(evolutionData[evolutionData.length - 1].date + "T00:00:00");
    const isoAt = (n: number) => { const d = new Date(latestDate); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    const val = (n: number) => Number((byDate.get(isoAt(n)) as any)?.[key]) || 0;
    const fmtFull = (n: number) => { const d = new Date(latestDate); d.setDate(d.getDate() - n); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
    const fmtShort = (n: number) => { const d = new Date(latestDate); d.setDate(d.getDate() - n); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`; };
    let sum7 = 0; for (let i = 1; i <= 7; i++) sum7 += val(i);
    return { today: val(0), yesterday: val(1), avg7d: sum7 / 7, todayDate: fmtFull(0), yesterdayDate: fmtFull(1), rangeStart: fmtShort(7), rangeEnd: fmtShort(1) };
  };
  const comparisons = useMemo(() => ({ spent: buildComparison("spent"), leads: buildComparison("leads"), cpf: buildComparison("cpf") }), [evolutionData]);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const handleJumpTo = (t: "funnel" | "creatives" | "sellers") => {
    if (t === "funnel") scrollTo(funnelRef);
    else if (t === "creatives") scrollTo(creativesRef);
    else scrollTo(sellersRef);
  };
  const handleScrollToRanking = (t: "cpf" | "consortium" | "financing") => {
    const el = rankingRefs[t].current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("ranking-highlight"); void el.offsetWidth; el.classList.add("ranking-highlight");
    window.setTimeout(() => el.classList.remove("ranking-highlight"), 1700);
  };

  // ── estados de carregamento/erro ──────────────────────────────────────────
  if (loadingClient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src={kpLogo} alt="KP" className="h-10 w-10 rounded-xl" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando dados…</p>
        </div>
      </div>
    );
  }

  if (notFound || !clientId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Nenhum cliente vinculado a esta subconta.</p>
        </div>
      </div>
    );
  }

  // ── render completo (mesmo layout do Criativos, sem navbar/auth) ──────────
  return (
    <div className="min-h-screen max-w-[1680px] mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-b-[2rem] px-5 sm:px-10 pt-10 pb-10 sm:pt-14 sm:pb-12 mb-6 border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(263,55%,18%/0.55)] via-[hsl(255,40%,10%/0.4)] to-background" />
        <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-[hsl(263,70%,55%/0.18)] blur-3xl" />
        <div className="absolute -top-20 right-0 w-[24rem] h-[24rem] rounded-full bg-[hsl(290,65%,55%/0.12)] blur-3xl" />
        <div className="absolute bottom-0 right-0 w-1/2 h-full bg-gradient-to-l from-[hsl(210,70%,55%/0.08)] to-transparent" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <ThemeToggle className="absolute top-4 right-4 z-20" />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-2xl" />
            <div className="relative p-[2px] rounded-2xl bg-gradient-to-br from-primary/60 via-primary/20 to-transparent">
              <img src={kpLogo} alt="KP Assessoria" className="relative h-16 w-16 rounded-2xl bg-background/80 backdrop-blur" />
            </div>
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-primary mb-3 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              KP Assessoria · Performance Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-[2rem] font-bold leading-[1.15] tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">A única análise de </span>
              <span className="bg-gradient-to-r from-primary via-[hsl(280,75%,70%)] to-[hsl(220,80%,70%)] bg-clip-text text-transparent">métricas reais</span>
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"> que te traz previsibilidade nas decisões</span>
            </h1>
            <p className="text-sm sm:text-[15px] text-muted-foreground mt-3 max-w-2xl">
              Dashboard de performance de criativos e leads qualificados · <span className="text-primary font-medium">{clientName}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 space-y-6">
        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3">
          <DateFilter onFilterChange={(s, u) => { setSince(s); setUntil(u); }} />
          <Button size="sm" onClick={handleSyncAll} disabled={syncing || syncingSheet || syncingGhl} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${(syncing || syncingSheet || syncingGhl) ? "animate-spin" : ""}`} />
            Sincronizar Tudo
          </Button>
        </div>

        {/* Dashboard completo */}
        {ghlData && ghlData.mapping_complete === false && ghlData.missing_metrics?.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
            <span className="text-amber-400 font-medium">⚠ Mapeamento CRM incompleto</span>
            <span className="text-muted-foreground">Configure as etapas em Clientes → Editar para: {ghlData.missing_metrics.join(", ")}</span>
          </div>
        )}

        <AlertBanner
          totalLeads={totalLeads}
          simulacoes={ghlData?.simulacoes ?? 0}
          cpfAprovado={ghlData?.cpf_aprovado ?? planilhaCpfApproved}
          vendasFinanciamento={(ghlData?.vendas_financiamento ?? 0) || (salesFinancing + salesLegacy)}
          onScrollToFunnel={() => scrollTo(funnelRef)}
        />

        <ExecutiveSummary
          totalLeads={totalLeads}
          totalSpent={totalSpent}
          cpl={totalLeads > 0 ? totalSpent / totalLeads : 0}
          simulacoes={ghlData?.simulacoes ?? 0}
          cpfAprovado={ghlData?.cpf_aprovado ?? planilhaCpfApproved}
          vendasFinanciamento={(ghlData?.vendas_financiamento ?? 0) || (salesFinancing + salesLegacy)}
          vendasConsorcio={(ghlData?.vendas_consorcio ?? 0) || salesConsortium}
          previous={previousPeriod ? {
            totalLeads: previousPeriod.totalLeads,
            totalSpent: previousPeriod.totalSpent,
            cpl: previousPeriod.cpl,
            simulacoes: previousPeriod.simulacoes,
            cpfAprovado: previousPeriod.ghlCpfAprovado || previousPeriod.cpfApproved,
            vendasFinanciamento: previousPeriod.ghlVendasFinanciamento || previousPeriod.salesFinancing,
            vendasConsorcio: previousPeriod.ghlVendasConsorcio || previousPeriod.salesConsortium,
          } : null}
          leadsByDate={(leads || []).map((l) => ({ creative_name: l.creative_name, lead_date: l.lead_date, status: l.status }))}
          onJumpTo={handleJumpTo}
        />

        <StatsCards
          totalLeads={totalLeads}
          totalSpent={totalSpent}
          salesConsortium={salesConsortium}
          salesFinancing={salesFinancing}
          uniqueCreativesCpf={uniqueCreativesCpf}
          uniqueCreativesSales={uniqueCreativesSales}
          planilhaCpfApproved={planilhaCpfApproved}
          ghlData={ghlData}
          ghlLoading={ghlLoading}
          onScrollTo={handleScrollToRanking}
          comparisons={comparisons}
          previousPeriod={previousPeriod ? {
            totalLeads: previousPeriod.totalLeads,
            totalSpent: previousPeriod.totalSpent,
            cpl: previousPeriod.cpl,
            simulacoes: previousPeriod.simulacoes,
            cpfAprovado: previousPeriod.ghlCpfAprovado || previousPeriod.cpfApproved,
            vendasFinanciamento: previousPeriod.ghlVendasFinanciamento || previousPeriod.salesFinancing,
            vendasConsorcio: previousPeriod.ghlVendasConsorcio || previousPeriod.salesConsortium,
          } : null}
        />

        <CostBanner
          totalSpent={totalSpent}
          vendasFinanciamento={ghlData?.vendas_financiamento ?? (salesFinancing + salesLegacy)}
          cpfAprovado={ghlData?.cpf_aprovado ?? planilhaCpfApproved}
        />

        <div ref={creativesRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div ref={rankingRefs.cpf} className="rounded-xl">
            <CreativeRanking title="🏆 Criativos por Lead Qualificado" data={cpfRanking} color="hsl(263, 50%, 68%)" category="cpf" clientId={clientId} since={since} until={until} />
          </div>
          <div ref={rankingRefs.consortium} className="rounded-xl">
            <CreativeRanking title="🤝 Criativos por Venda Consórcio" data={consortiumRanking} color="hsl(210, 70%, 58%)" category="consortium" clientId={clientId} since={since} until={until} />
          </div>
          <div ref={rankingRefs.financing} className="rounded-xl">
            <CreativeRanking title="💳 Criativos por Venda Total" data={financingRanking} color="hsl(35, 80%, 55%)" category="financing" clientId={clientId} since={since} until={until} />
          </div>
        </div>

        <div ref={funnelRef}>
          <GoalsFunnel
            totalLeads={totalLeads}
            ghlSimulacoes={ghlData?.simulacoes ?? 0}
            ghlCpfApproved={ghlData?.cpf_aprovado ?? 0}
            planilhaCpfApproved={planilhaCpfApproved}
            salesFinancing={salesFinancing + salesLegacy}
            planilhaSalesFinancing={salesFinancing + salesLegacy}
            ghlSalesFinancing={ghlData?.vendas_financiamento ?? 0}
            onScrollTo={handleScrollToRanking}
          />
        </div>

        {monthlyTrend && monthlyTrend.length > 0 && <MonthlyTrend data={monthlyTrend} />}

        <div ref={sellersRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SellerRanking title="Leads Qualificados por Vendedor" data={sellerCpfRanking} color="hsl(142, 60%, 45%)" icon="✅" />
          <SellerRanking title="Vendas Consórcio por Vendedor" data={sellerConsortiumRanking} color="hsl(210, 70%, 58%)" icon="🤝" />
          <SellerRanking title="Vendas Totais por Vendedor" data={sellerFinancingRanking} color="hsl(35, 80%, 55%)" icon="💳" />
        </div>

        <EvolutionChart data={evolutionData} simulacoesTotal={ghlData?.simulacoes} />
      </div>
    </div>
  );
}
