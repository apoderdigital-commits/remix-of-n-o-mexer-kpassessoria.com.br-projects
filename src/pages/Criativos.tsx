import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import { Settings, RefreshCw, FileSpreadsheet, LogOut, ArrowLeft, MessageCircle, ArrowRight, Activity, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import kpLogo from "@/assets/kp-logo.png";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { CreativeRanking } from "@/components/dashboard/CreativeRanking";
import { EvolutionChart } from "@/components/dashboard/EvolutionChart";
import { SellerRanking } from "@/components/dashboard/SellerRanking";
import { GoalsFunnel } from "@/components/dashboard/GoalsFunnel";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { ClientSelector } from "@/components/dashboard/ClientSelector";
import {
  useClients,
  useMetaCampaigns,
  useQualifiedLeads,
  useSyncMeta,
  useSyncGoogleSheet,
  useGhlPipeline,
} from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Index() {
  const { isAdmin, clientId: authClientId, signOut, accessibleClientIds } = useAuth();
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [since, setSince] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [until, setUntil] = useState(format(new Date(), "yyyy-MM-dd"));
  const [syncing, setSyncing] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [syncingGhl, setSyncingGhl] = useState(false);

  const rankingRefs = {
    cpf: useRef<HTMLDivElement>(null),
    consortium: useRef<HTMLDivElement>(null),
    financing: useRef<HTMLDivElement>(null),
  };

  const handleScrollToRanking = (target: "cpf" | "consortium" | "financing") => {
    const el = rankingRefs[target].current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("ranking-highlight");
    // force reflow to restart animation
    void el.offsetWidth;
    el.classList.add("ranking-highlight");
    window.setTimeout(() => el.classList.remove("ranking-highlight"), 1700);
  };

  // Determine active client
  const activeClient = isAdmin ? selectedClient : (selectedClient || accessibleClientIds[0] || authClientId);

  useEffect(() => {
    if (!isAdmin && !selectedClient) {
      const firstClient = accessibleClientIds[0] || authClientId;
      if (firstClient) setSelectedClient(firstClient);
    }
  }, [isAdmin, authClientId, accessibleClientIds]);

  const { data: allClients } = useClients();
  // Filter clients by access
  const clients = isAdmin ? allClients : allClients?.filter((c: any) => accessibleClientIds.includes(c.id));
  const { data: campaigns } = useMetaCampaigns(activeClient, since, until);
  const { data: leads } = useQualifiedLeads(activeClient, since, until);
  const { data: ghlData, isLoading: ghlLoading } = useGhlPipeline(activeClient, since, until);
  const { sync } = useSyncMeta(activeClient);
  const { sync: syncSheet } = useSyncGoogleSheet(activeClient);
  const queryClient = useQueryClient();

  const handleFilterChange = (s: string, u: string) => {
    setSince(s);
    setUntil(u);
  };

  const handleSyncAll = async () => {
    if (!activeClient) return;
    setSyncing(true);
    setSyncingSheet(true);
    setSyncingGhl(true);
    try {
      const results = await Promise.allSettled([
        sync(since, until),
        syncSheet(since, until),
        queryClient.invalidateQueries({ queryKey: ["ghl_pipeline", activeClient] }),
      ]);
      queryClient.invalidateQueries({ queryKey: ["meta_campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["qualified_leads"] });
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length === 0) {
        toast.success("Todos os dados sincronizados!");
      } else if (failures.length < results.length) {
        toast.warning("Sincronização parcial — algumas fontes falharam. Verifique as configurações do cliente.");
      } else {
        toast.error("Erro ao sincronizar. Verifique as configurações do cliente.");
      }
    } catch {
      toast.error("Erro ao sincronizar");
    }
    setSyncing(false);
    setSyncingSheet(false);
    setSyncingGhl(false);
  };

  const handleSync = async () => {
    if (!activeClient) return;
    setSyncing(true);
    try {
      await sync(since, until);
      queryClient.invalidateQueries({ queryKey: ["meta_campaigns"] });
      toast.success("Dados da Meta sincronizados!");
    } catch {
      toast.error("Erro ao sincronizar dados da Meta");
    }
    setSyncing(false);
  };

  const handleSyncSheet = async () => {
    if (!activeClient) return;
    setSyncingSheet(true);
    try {
      await syncSheet(since, until);
      queryClient.invalidateQueries({ queryKey: ["qualified_leads"] });
      toast.success("Leads qualificados sincronizados da planilha!");
    } catch {
      toast.error("Erro ao sincronizar planilha.");
    }
    setSyncingSheet(false);
  };

  const handleSyncGhl = async () => {
    if (!activeClient) return;
    setSyncingGhl(true);
    try {
      queryClient.invalidateQueries({ queryKey: ["ghl_pipeline", activeClient] });
      toast.success("Dados do GHL sincronizados!");
    } catch {
      toast.error("Erro ao sincronizar GHL");
    }
    setSyncingGhl(false);
  };

  // Compute stats
  const totalLeads = useMemo(
    () => (campaigns || []).reduce((sum, c) => sum + c.leads_total, 0),
    [campaigns]
  );
  const totalSpent = useMemo(
    () => (campaigns || []).reduce((sum, c) => sum + Number(c.amount_spent), 0),
    [campaigns]
  );
  const planilhaCpfApproved = useMemo(
    () => (leads || []).filter((l) => l.status === "cpf_approved").length,
    [leads]
  );
  const salesConsortium = useMemo(
    () => (leads || []).filter((l) => l.status === "sale_consortium").length,
    [leads]
  );
  const salesFinancing = useMemo(
    () => (leads || []).filter((l) => l.status === "sale_financing").length,
    [leads]
  );
  const salesLegacy = useMemo(
    () => (leads || []).filter((l) => l.status === "sale").length,
    [leads]
  );
  const uniqueCreativesCpf = useMemo(
    () => new Set((leads || []).filter((l) => l.status === "cpf_approved").map((l) => l.creative_name)).size,
    [leads]
  );
  const uniqueCreativesSales = useMemo(
    () => new Set((leads || []).filter((l) => l.status === "sale_financing" || l.status === "sale_consortium").map((l) => l.creative_name)).size,
    [leads]
  );

  // Creative rankings
  const buildRanking = (statuses: string[]) => {
    const filtered = (leads || []).filter((l) => statuses.includes(l.status));
    const map = new Map<string, number>();
    filtered.forEach((l) => map.set(l.creative_name, (map.get(l.creative_name) || 0) + 1));
    const total = filtered.length;
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  };

  const cpfRanking = useMemo(() => buildRanking(["cpf_approved"]), [leads]);
  const consortiumRanking = useMemo(() => buildRanking(["sale_consortium"]), [leads]);
  const financingRanking = useMemo(() => buildRanking(["sale_financing"]), [leads]);

  // Seller rankings
  const buildSellerRanking = (statuses: string[]) => {
    const filtered = (leads || []).filter((l) => statuses.includes(l.status) && l.seller_name);
    const map = new Map<string, number>();
    filtered.forEach((l) => map.set(l.seller_name!, (map.get(l.seller_name!) || 0) + 1));
    const total = filtered.length;
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  };

  const sellerCpfRanking = useMemo(() => buildSellerRanking(["cpf_approved"]), [leads]);
  const sellerConsortiumRanking = useMemo(() => buildSellerRanking(["sale_consortium"]), [leads]);
  const sellerFinancingRanking = useMemo(() => buildSellerRanking(["sale_financing"]), [leads]);

  const evolutionData = useMemo(() => {
    const dateMap = new Map<string, { leads: number; cpf: number; sales: number }>();
    (campaigns || []).forEach((c) => {
      const entry = dateMap.get(c.date) || { leads: 0, cpf: 0, sales: 0 };
      entry.leads += c.leads_total;
      dateMap.set(c.date, entry);
    });
    (leads || []).forEach((l) => {
      const entry = dateMap.get(l.lead_date) || { leads: 0, cpf: 0, sales: 0 };
      if (l.status === "cpf_approved") entry.cpf += 1;
      else if (l.status === "sale_consortium" || l.status === "sale_financing" || l.status === "sale") entry.sales += 1;
      dateMap.set(l.lead_date, entry);
    });
    return Array.from(dateMap.entries())
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [campaigns, leads]);

  return (
    <div className="min-h-screen max-w-[1680px] mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-b-[2rem] px-5 sm:px-10 pt-10 pb-10 sm:pt-14 sm:pb-12 mb-6 border-b border-border/40">
        {/* Layered backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(263,55%,18%/0.55)] via-[hsl(255,40%,10%/0.4)] to-background" />
        <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-[hsl(263,70%,55%/0.18)] blur-3xl" />
        <div className="absolute -top-20 right-0 w-[24rem] h-[24rem] rounded-full bg-[hsl(290,65%,55%/0.12)] blur-3xl" />
        <div className="absolute bottom-0 right-0 w-1/2 h-full bg-gradient-to-l from-[hsl(210,70%,55%/0.08)] to-transparent" />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          {/* Logo with glow */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-2xl" />
            <div className="relative p-[2px] rounded-2xl bg-gradient-to-br from-primary/60 via-primary/20 to-transparent">
              <img
                src={kpLogo}
                alt="KP Assessoria"
                className="relative h-16 w-16 rounded-2xl bg-background/80 backdrop-blur"
              />
            </div>
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-primary mb-3 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              KP Assessoria · Performance Dashboard
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-[2rem] font-bold leading-[1.15] tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                A única análise de{" "}
              </span>
              <span className="bg-gradient-to-r from-primary via-[hsl(280,75%,70%)] to-[hsl(220,80%,70%)] bg-clip-text text-transparent">
                métricas reais
              </span>
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {" "}que te traz previsibilidade nas decisões
              </span>
            </h1>
            <p className="text-sm sm:text-[15px] text-muted-foreground mt-3 max-w-2xl">
              Dashboard de performance de criativos e leads qualificados
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to="/">
            <Button size="sm" variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Portal
            </Button>
          </Link>
          {(isAdmin || (clients && clients.length > 1)) && (
            <ClientSelector
              clients={clients || []}
              selectedId={selectedClient}
              onSelect={setSelectedClient}
            />
          )}
          <DateFilter onFilterChange={handleFilterChange} />
          <Button
            size="sm"
            onClick={handleSyncAll}
            disabled={!activeClient || syncing || syncingSheet || syncingGhl}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${(syncing || syncingSheet || syncingGhl) ? "animate-spin" : ""}`} />
            Sincronizar Tudo
          </Button>
          {isAdmin && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    Sync Específico <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2 bg-card border-border/50" align="end">
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSync}
                      disabled={!activeClient || syncing}
                      className="justify-start gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                      Meta Ads
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSyncSheet}
                      disabled={!activeClient || syncingSheet}
                      className="justify-start gap-2"
                    >
                      <FileSpreadsheet className={`h-4 w-4 ${syncingSheet ? "animate-spin" : ""}`} />
                      Planilha
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSyncGhl}
                      disabled={!activeClient || syncingGhl}
                      className="justify-start gap-2"
                    >
                      <Activity className={`h-4 w-4 ${syncingGhl ? "animate-spin" : ""}`} />
                      GHL Pipeline
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Link to="/clients">
                <Button size="sm" variant="ghost" className="gap-2">
                  <Settings className="h-4 w-4" /> Clientes
                </Button>
              </Link>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>

      {/* WhatsApp info banner */}
      <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-muted-foreground">
        <ArrowRight className="h-5 w-5 shrink-0 text-amber-400" />
        <p className="text-primary-foreground">
          Ao clicar no <MessageCircle className="inline h-4 w-4 text-green-500 mx-0.5 -mt-0.5" /> ao lado do criativo, o link será enviado diretamente para o seu WhatsApp.
        </p>
      </div>

      {!activeClient ? (
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground text-lg">
            Selecione um cliente para visualizar o dashboard
          </p>
        </div>
      ) : (
        <>
          {ghlData && ghlData.mapping_complete === false && ghlData.missing_metrics?.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
              <span className="text-amber-400 font-medium">⚠ Mapeamento GHL incompleto</span>
              <span className="text-muted-foreground">
                Configure as etapas em <strong>Clientes → Editar</strong> para:{" "}
                {ghlData.missing_metrics.join(", ")}
                {!ghlData.has_manual_mapping && " (usando detecção automática por nome)"}
              </span>
            </div>
          )}
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
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div ref={rankingRefs.cpf} className="rounded-xl">
              <CreativeRanking
                title="🏆 Criativos por CPF Aprovado"
                data={cpfRanking}
                color="hsl(263, 50%, 68%)"
                category="cpf"
                clientId={activeClient}
                since={since}
                until={until}
              />
            </div>
            <div ref={rankingRefs.consortium} className="rounded-xl">
              <CreativeRanking
                title="🤝 Criativos por Venda Consórcio"
                data={consortiumRanking}
                color="hsl(210, 70%, 58%)"
                category="consortium"
                clientId={activeClient}
                since={since}
                until={until}
              />
            </div>
            <div ref={rankingRefs.financing} className="rounded-xl">
              <CreativeRanking
                title="💳 Criativos por Venda Financiamento"
                data={financingRanking}
                color="hsl(35, 80%, 55%)"
                category="financing"
                clientId={activeClient}
                since={since}
                until={until}
              />
            </div>
          </div>

          <GoalsFunnel
            totalLeads={totalLeads}
            ghlSimulacoes={ghlData?.simulacoes ?? 0}
            ghlCpfApproved={ghlData?.cpf_aprovado ?? 0}
            planilhaCpfApproved={planilhaCpfApproved}
            salesFinancing={salesFinancing + salesLegacy}
            onScrollTo={(t) => handleScrollToRanking(t)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SellerRanking
              title="CPFs Aprovados por Vendedor"
              data={sellerCpfRanking}
              color="hsl(142, 60%, 45%)"
              icon="✅"
            />
            <SellerRanking
              title="Vendas Consórcio por Vendedor"
              data={sellerConsortiumRanking}
              color="hsl(210, 70%, 58%)"
              icon="🤝"
            />
            <SellerRanking
              title="Vendas Financiamento por Vendedor"
              data={sellerFinancingRanking}
              color="hsl(35, 80%, 55%)"
              icon="💳"
            />
          </div>

          <EvolutionChart data={evolutionData} simulacoesTotal={ghlData?.simulacoes} />
        </>
      )}
      </div>
    </div>
  );
}
