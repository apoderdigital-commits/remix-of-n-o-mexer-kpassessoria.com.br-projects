import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import { Settings, RefreshCw, FileSpreadsheet, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import kpLogo from "@/assets/kp-logo.png";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { CreativeRanking } from "@/components/dashboard/CreativeRanking";
import { EvolutionChart } from "@/components/dashboard/EvolutionChart";
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
  const { isAdmin, clientId: authClientId, signOut } = useAuth();
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [since, setSince] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [until, setUntil] = useState(format(new Date(), "yyyy-MM-dd"));
  const [syncing, setSyncing] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);

  // If client user, auto-select their client
  const activeClient = isAdmin ? selectedClient : authClientId;

  useEffect(() => {
    if (!isAdmin && authClientId) {
      setSelectedClient(authClientId);
    }
  }, [isAdmin, authClientId]);

  const { data: clients } = useClients();
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
  const sales = useMemo(
    () => (leads || []).filter((l) => l.status === "sale").length,
    [leads]
  );

  // Creative rankings
  const buildRanking = (status: "cpf_approved" | "sale") => {
    const filtered = (leads || []).filter((l) => l.status === status);
    const map = new Map<string, number>();
    filtered.forEach((l) => map.set(l.creative_name, (map.get(l.creative_name) || 0) + 1));
    const total = filtered.length;
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  };

  const cpfRanking = useMemo(() => buildRanking("cpf_approved"), [leads]);
  const salesRanking = useMemo(() => buildRanking("sale"), [leads]);

  // Evolution chart data
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
      else entry.sales += 1;
      dateMap.set(l.lead_date, entry);
    });
    return Array.from(dateMap.entries())
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [campaigns, leads]);

  return (
    <div className="min-h-screen max-w-[1400px] mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-b-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-primary/20 px-6 py-8 mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        <div className="relative flex flex-col md:flex-row items-center gap-6">
          <img src={kpLogo} alt="KP Assessoria" className="h-16 w-16 rounded-xl" />
          <div className="text-center md:text-left flex-1">
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              A única análise de métricas reais que te traz previsibilidade nas decisões
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
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
          {isAdmin && (
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
            sales={sales}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CreativeRanking
              title="🏆 Criativos por CPF Aprovado"
              data={cpfRanking}
              color="hsl(263, 50%, 68%)"
            />
            <CreativeRanking
              title="💰 Criativos por Venda"
              data={salesRanking}
              color="hsl(263, 70%, 58%)"
            />
          </div>

          <EvolutionChart data={evolutionData} />
        </>
      )}
      </div>
    </div>
  );
}
