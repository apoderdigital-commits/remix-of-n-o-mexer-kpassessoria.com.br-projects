import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, TrendingUp, Users, Target, ShoppingCart, DollarSign, Wallet, Percent, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}
function fmtNum(v: number) {
  return new Intl.NumberFormat("pt-BR").format(v || 0);
}
function fmtPct(v: number) {
  return `${(v || 0).toFixed(1)}%`;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

interface Kpis {
  leadsTotais: number;
  mqls: number;
  taxaAtivacaoMql: number;
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  winRate: number;
  investimento: number;
  cac: number;
  roas: number;
  metaError?: string | null;
}

export default function Comercial() {
  const { isAdmin, squadCount, loading: authLoading } = useAuth();
  const allowed = isAdmin || squadCount > 0;

  const [since, setSince] = useState(startOfMonth());
  const [until, setUntil] = useState(todayIso());
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<Kpis | null>(null);

  const fetchKpis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("kp-comercial-kpis", {
        body: { since, until },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setKpis(data as Kpis);
      if ((data as any)?.metaError) toast.warning("Meta Ads: " + (data as any).metaError);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao buscar dados: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchKpis(); /* eslint-disable-next-line */ }, []);

  const presets = [
    { label: "Hoje", apply: () => { const d = todayIso(); setSince(d); setUntil(d); } },
    { label: "Esta semana", apply: () => {
      const d = new Date();
      const day = d.getDay() || 7;
      const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
      setSince(monday.toISOString().slice(0, 10));
      setUntil(todayIso());
    }},
    { label: "Este mês", apply: () => { setSince(startOfMonth()); setUntil(todayIso()); } },
  ];

  const cards = kpis ? [
    { icon: Users, label: "Leads Totais", value: fmtNum(kpis.leadsTotais), color: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/30" },
    { icon: Target, label: "Leads MQL", value: fmtNum(kpis.mqls), color: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/30" },
    { icon: Percent, label: "Taxa de Ativação MQL", value: fmtPct(kpis.taxaAtivacaoMql), color: "from-teal-500/20 to-teal-500/5", border: "border-teal-500/30" },
    { icon: ShoppingCart, label: "Vendas", value: fmtNum(kpis.vendas), color: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30" },
    { icon: DollarSign, label: "Ticket Médio", value: fmtBRL(kpis.ticketMedio), color: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/30" },
    { icon: Wallet, label: "Faturamento", value: fmtBRL(kpis.faturamento), color: "from-yellow-500/20 to-yellow-500/5", border: "border-yellow-500/30" },
    { icon: TrendingUp, label: "Investimento Tráfego", value: fmtBRL(kpis.investimento), color: "from-fuchsia-500/20 to-fuchsia-500/5", border: "border-fuchsia-500/30" },
    { icon: Trophy, label: "CAC", value: fmtBRL(kpis.cac), color: "from-rose-500/20 to-rose-500/5", border: "border-rose-500/30" },
    { icon: TrendingUp, label: "ROAS do Funil", value: kpis.roas > 0 ? `${kpis.roas.toFixed(2)}x` : "—", color: "from-purple-500/20 to-purple-500/5", border: "border-purple-500/30" },
    { icon: Percent, label: "Win Rate", value: fmtPct(kpis.winRate), color: "from-primary/20 to-primary/5", border: "border-primary/30" },
  ] : [];

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Portal
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Painel Comercial · KP</h1>
            <p className="text-sm text-muted-foreground mt-1">Métricas comerciais da KP via GoHighLevel + Meta Ads</p>
          </div>
          <Button onClick={fetchKpis} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <Card className="p-4 bg-card/40 backdrop-blur border-border/30">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-[160px]" />
            </div>
            <div className="flex gap-1.5">
              {presets.map((p) => (
                <Button key={p.label} type="button" variant="outline" size="sm" onClick={p.apply}>{p.label}</Button>
              ))}
            </div>
            <Button onClick={fetchKpis} disabled={loading} className="ml-auto">Aplicar</Button>
          </div>
        </Card>

        {loading && !kpis ? (
          <div className="text-center py-20 text-muted-foreground">Carregando dados…</div>
        ) : kpis ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map((c) => (
              <Card key={c.label} className={`p-4 bg-gradient-to-br ${c.color} ${c.border} border backdrop-blur`}>
                <div className="flex items-start justify-between mb-2">
                  <c.icon className="h-4 w-4 text-foreground/70" />
                </div>
                <div className="text-xs text-muted-foreground leading-tight">{c.label}</div>
                <div className="text-xl font-bold mt-1 tracking-tight">{c.value}</div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">Sem dados.</div>
        )}

        <p className="text-xs text-muted-foreground/60 text-center pt-4">
          Investimento puxado da conta Meta Ads {`(act_507006368954918)`} via Token de Will.
        </p>
      </div>
    </div>
  );
}
