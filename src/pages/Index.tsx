import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import { Settings, RefreshCw, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
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
} from "@/hooks/useDashboardData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Index() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [since, setSince] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [until, setUntil] = useState(format(new Date(), "yyyy-MM-dd"));
  const [syncing, setSyncing] = useState(false);

  const { data: clients } = useClients();
  const { data: campaigns } = useMetaCampaigns(selectedClient, since, until);
  const { data: leads } = useQualifiedLeads(selectedClient, since, until);
  const { sync } = useSyncMeta(selectedClient);
  const queryClient = useQueryClient();

  const handleFilterChange = (s: string, u: string) => {
    setSince(s);
    setUntil(u);
  };

  const handleSync = async () => {
    if (!selectedClient) return;
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
    <div className="min-h-screen p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Criativos</h1>
          <p className="text-sm text-muted-foreground">
            Performance de criativos e leads qualificados
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ClientSelector
            clients={clients || []}
            selectedId={selectedClient}
            onSelect={setSelectedClient}
          />
          <DateFilter onFilterChange={handleFilterChange} />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={!selectedClient || syncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync Meta
          </Button>
          <Link to="/clients">
            <Button size="sm" variant="ghost" className="gap-2">
              <Settings className="h-4 w-4" /> Clientes
            </Button>
          </Link>
        </div>
      </div>

      {!selectedClient ? (
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
              color="hsl(142, 71%, 45%)"
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
  );
}
