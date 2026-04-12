import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import { Settings, RefreshCw, FileSpreadsheet, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import kpLogo from "@/assets/kp-logo.png";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { CreativeRanking } from "@/components/dashboard/CreativeRanking";
import { EvolutionChart } from "@/components/dashboard/EvolutionChart";
import { SellerRanking } from "@/components/dashboard/SellerRanking";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { ClientSelector } from "@/components/dashboard/ClientSelector";
import {
  useClients,
  useMetaCampaigns,
  useQualifiedLeads,
  useSyncMeta,
  useSyncGoogleSheet,
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
  const { sync } = useSyncMeta(activeClient);
  const { sync: syncSheet } = useSyncGoogleSheet(activeClient);
  const queryClient = useQueryClient();

  const handleFilterChange = (s: string, u: string) => {
    setSince(s);
    setUntil(u);
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
      toast.error("Erro ao sincronizar planilha. Verifique se ela está compartilhada publicamente.");
    }
    setSyncingSheet(false);
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
  const cpfApproved = useMemo(
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
    <div className="min-h-screen max-w-[1400px] mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-b-3xl border-b border-primary/20 px-5 sm:px-8 pt-6 pb-7 sm:pt-8 sm:pb-9 mb-6">
        {/* Layered gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-purple-500/10" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-card/80 backdrop-blur-sm border border-border/30 flex items-center justify-center shadow-lg shadow-primary/10">
            <img src={kpLogo} alt="KP Assessoria" className="h-9 w-9 sm:h-10 sm:h-10 rounded-lg" />
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary via-purple-400 to-primary bg-clip-text text-transparent leading-snug">
              A única análise de métricas reais que te traz previsibilidade nas decisões
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1">
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
          {isAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSync}
                disabled={!activeClient || syncing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                Sync Meta
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncSheet}
                disabled={!activeClient || syncingSheet}
                className="gap-2"
              >
                <FileSpreadsheet className={`h-4 w-4 ${syncingSheet ? "animate-spin" : ""}`} />
                Sync Planilha
              </Button>
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

      {!activeClient ? (
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground text-lg">
            Selecione um cliente para visualizar o dashboard
          </p>
        </div>
      ) : (
        <>
          <StatsCards
            totalLeads={totalLeads}
            totalSpent={totalSpent}
            cpfApproved={cpfApproved}
            salesConsortium={salesConsortium}
            salesFinancing={salesFinancing}
            salesLegacy={salesLegacy}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CreativeRanking
              title="🏆 Criativos por CPF Aprovado"
              data={cpfRanking}
              color="hsl(263, 50%, 68%)"
            />
            <CreativeRanking
              title="🤝 Criativos por Venda Consórcio"
              data={consortiumRanking}
              color="hsl(210, 70%, 58%)"
            />
            <CreativeRanking
              title="💳 Criativos por Venda Financiamento"
              data={financingRanking}
              color="hsl(35, 80%, 55%)"
            />
          </div>

          <EvolutionChart data={evolutionData} />

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
        </>
      )}
      </div>
    </div>
  );
}
