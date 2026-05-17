import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, TrendingUp, Users, Target, ShoppingCart, DollarSign, Wallet, Percent, Trophy, Phone, CalendarClock, AlertTriangle, Clock, Filter as FilterIcon, Database, Zap, Settings, UserCog, CalendarCheck2, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
const todayIso = () => new Date().toISOString().slice(0, 10);

interface Kpis {
  leadsTotais: number; mqls: number; taxaAtivacaoMql: number; vendas: number;
  faturamento: number; ticketMedio: number; winRate: number;
  investimento: number; cac: number; roas: number; metaError?: string | null;
}
interface Sdr { user: { id: string; name: string; email?: string }; agendados: number; realizados: number; noshow: number; cancelados: number; }
interface MqlRow { id: string; nome: string; email?: string; phone?: string; dateAdded?: string; situacao: "agendado" | "realizado" | "noshow" | "sem_agendamento"; horario?: string; }
interface ClassData { propostas: number; vendas: number; faturamento: number; pipelines: string[]; }
interface Fase2 {
  sdrs: Sdr[];
  noShowByHour: Record<string, number>;
  mqlSummary: { total: number; agendados: number; naoAgendados: number; realizados: number; noshow: number };
  mqlsList: MqlRow[];
  classes: Record<"A" | "B" | "C" | "Outro", ClassData>;
}
interface PipelineFunnel { id: string; name: string; stages: { id: string; name: string; count: number; value: number }[]; won: number; lost: number; openValue: number; }
interface TrendBucket { weekStart: string; mqls: number; vendas: number; faturamento: number; investimento: number; cac: number; roas: number; }
interface FollowUps {
  mqlsSemAgendamento: { id: string; nome: string; email?: string; phone?: string; diasParado: number; dateAdded: string }[];
  propostasParadas: { id: string; nome: string; pipeline: string; valor: number; diasParado: number; updatedAt: string }[];
  opsEstagnadas: { id: string; nome: string; pipeline: string; stage: string; valor: number; diasParado: number; updatedAt: string }[];
  thresholds: { semAgendDias: number; propostaParadaDias: number; oppEstagnadaDias: number };
}
interface Fase3 {
  aggregateFunnel: { stage: string; count: number }[];
  pipelineFunnels: PipelineFunnel[];
  trend: TrendBucket[];
  followUps: FollowUps;
  metaError?: string | null;
}

type SdrGoals = Record<string, { agendados: number; realizados: number; vendas: number }>;
const GOALS_KEY = "kp_comercial_sdr_goals_v1";
const loadGoals = (): SdrGoals => { try { return JSON.parse(localStorage.getItem(GOALS_KEY) || "{}"); } catch { return {}; } };
const saveGoals = (g: SdrGoals) => localStorage.setItem(GOALS_KEY, JSON.stringify(g));

export default function Comercial() {
  const { isAdmin, squadCount, loading: authLoading } = useAuth();
  const allowed = isAdmin || squadCount > 0;

  const [since, setSince] = useState(startOfMonth());
  const [until, setUntil] = useState(todayIso());
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [fase2, setFase2] = useState<Fase2 | null>(null);
  const [fase3, setFase3] = useState<Fase3 | null>(null);
  const [goals, setGoals] = useState<SdrGoals>(loadGoals);
  const [funnelPipeline, setFunnelPipeline] = useState<string>("__all__");
  const [source, setSource] = useState<"cache" | "fresh" | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const applyPayload = (payload: any) => {
    if (!payload) return;
    if (payload.kpis) setKpis(payload.kpis);
    setFase2({
      sdrs: payload.sdrs || [],
      noShowByHour: payload.noShowByHour || {},
      mqlSummary: payload.mqlSummary || { total: 0, agendados: 0, naoAgendados: 0, realizados: 0, noshow: 0 },
      mqlsList: payload.mqlsList || [],
      classes: payload.classes || { A: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] }, B: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] }, C: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] }, Outro: { propostas: 0, vendas: 0, faturamento: 0, pipelines: [] } },
    });
    setFase3({
      aggregateFunnel: payload.aggregateFunnel || [],
      pipelineFunnels: payload.pipelineFunnels || [],
      trend: payload.trend || [],
      followUps: payload.followUps || { mqlsSemAgendamento: [], propostasParadas: [], opsEstagnadas: [], thresholds: { semAgendDias: 3, propostaParadaDias: 7, oppEstagnadaDias: 14 } },
    });
  };

  const fetchAll = async (force = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("kp-comercial-snapshot", {
        body: { mode: force ? "refresh" : "auto", since, until, maxAgeMinutes: 30 },
      });
      if (error) throw error;
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      applyPayload(resp?.data);
      setSource(resp?.source || null);
      setFetchedAt(resp?.snapshot?.fetched_at || null);
      if (resp?.data?.kpis?.metaError) toast.warning("Meta Ads: " + resp.data.kpis.metaError);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchAll(false); /* eslint-disable-next-line */ }, []);

  const updateGoal = (sdrId: string, key: "agendados" | "realizados" | "vendas", val: number) => {
    const next = { ...goals, [sdrId]: { agendados: 0, realizados: 0, vendas: 0, ...goals[sdrId], [key]: val } };
    setGoals(next); saveGoals(next);
  };

  const sdrRanking = useMemo(() => {
    if (!fase2) return [];
    return [...fase2.sdrs].map((s) => {
      const g = goals[s.user.id] || { agendados: 0, realizados: 0, vendas: 0 };
      const showRate = s.agendados > 0 ? (s.realizados / s.agendados) * 100 : 0;
      const score = (g.agendados ? (s.agendados / g.agendados) * 100 : 0)
        + (g.realizados ? (s.realizados / g.realizados) * 100 : 0);
      return { ...s, goal: g, showRate, score };
    }).sort((a, b) => (b.score - a.score) || (b.realizados - a.realizados));
  }, [fase2, goals]);

  const presets = [
    { label: "Hoje", apply: () => { const d = todayIso(); setSince(d); setUntil(d); } },
    { label: "Esta semana", apply: () => {
      const d = new Date(); const day = d.getDay() || 7;
      const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
      setSince(monday.toISOString().slice(0, 10)); setUntil(todayIso());
    }},
    { label: "Este mês", apply: () => { setSince(startOfMonth()); setUntil(todayIso()); } },
  ];

  const cards = kpis ? [
    { icon: Users,        label: "Leads Totais",        value: fmtNum(kpis.leadsTotais),     accent: "blue",     ring: "ring-blue-500/20",     iconBg: "bg-blue-500/15 text-blue-300",          glow: "from-blue-500/20" },
    { icon: Target,       label: "Leads MQL",           value: fmtNum(kpis.mqls),            accent: "cyan",     ring: "ring-cyan-500/20",     iconBg: "bg-cyan-500/15 text-cyan-300",          glow: "from-cyan-500/20" },
    { icon: Percent,      label: "Taxa Ativação MQL",   value: fmtPct(kpis.taxaAtivacaoMql), accent: "teal",     ring: "ring-teal-500/20",     iconBg: "bg-teal-500/15 text-teal-300",          glow: "from-teal-500/20" },
    { icon: ShoppingCart, label: "Vendas",              value: fmtNum(kpis.vendas),          accent: "emerald",  ring: "ring-emerald-500/20",  iconBg: "bg-emerald-500/15 text-emerald-300",    glow: "from-emerald-500/20" },
    { icon: DollarSign,   label: "Ticket Médio",        value: fmtBRL(kpis.ticketMedio),     accent: "amber",    ring: "ring-amber-500/20",    iconBg: "bg-amber-500/15 text-amber-300",        glow: "from-amber-500/20" },
    { icon: Wallet,       label: "Faturamento",         value: fmtBRL(kpis.faturamento),     accent: "yellow",   ring: "ring-yellow-500/20",   iconBg: "bg-yellow-500/15 text-yellow-300",      glow: "from-yellow-500/20" },
    { icon: TrendingUp,   label: "Investimento Tráfego",value: fmtBRL(kpis.investimento),    accent: "fuchsia",  ring: "ring-fuchsia-500/20",  iconBg: "bg-fuchsia-500/15 text-fuchsia-300",    glow: "from-fuchsia-500/20" },
    { icon: Trophy,       label: "CAC",                 value: fmtBRL(kpis.cac),             accent: "rose",     ring: "ring-rose-500/20",     iconBg: "bg-rose-500/15 text-rose-300",          glow: "from-rose-500/20" },
    { icon: TrendingUp,   label: "ROAS",                value: kpis.roas > 0 ? `${kpis.roas.toFixed(2)}x` : "—", accent: "purple", ring: "ring-purple-500/20", iconBg: "bg-purple-500/15 text-purple-300", glow: "from-purple-500/20" },
    { icon: Percent,      label: "Win Rate",            value: fmtPct(kpis.winRate),         accent: "primary",  ring: "ring-primary/20",      iconBg: "bg-primary/15 text-primary",            glow: "from-primary/20" },
  ] : [];

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!allowed) return <Navigate to="/" replace />;

  const situacaoBadge = (s: MqlRow["situacao"]) => {
    const map: Record<MqlRow["situacao"], { label: string; cls: string }> = {
      realizado: { label: "Realizado", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
      agendado: { label: "Agendado", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
      noshow: { label: "No-show", cls: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
      sem_agendamento: { label: "Sem agend.", cls: "bg-muted/40 text-muted-foreground border-border" },
    };
    return <Badge variant="outline" className={map[s].cls}>{map[s].label}</Badge>;
  };

  const hourEntries = fase2 ? Object.entries(fase2.noShowByHour).sort(([a], [b]) => a.localeCompare(b)) : [];
  const maxNoShow = Math.max(1, ...hourEntries.map(([, v]) => v));

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-[700px] rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      <div className="p-4 sm:p-6 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-7">
          {/* Hero */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <Link to="/" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Portal
              </Link>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-transparent">
                Painel Comercial
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                GoHighLevel · Meta Ads · tempo real
              </p>
            </div>
            <div className="flex items-center gap-3">
              {fetchedAt && (
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground bg-card/30 backdrop-blur-xl border border-white/5 rounded-full px-3 py-1.5">
                  {source === "cache" ? <Database className="h-3 w-3 text-cyan-300" /> : <Zap className="h-3 w-3 text-emerald-300" />}
                  <span>
                    {source === "cache" ? "cache" : "ao vivo"} · {new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
              <Button onClick={() => fetchAll(true)} disabled={loading} className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <Card className="p-5 bg-card/30 backdrop-blur-xl border border-white/5 shadow-2xl shadow-black/20 rounded-2xl">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">De</Label>
                <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="w-[160px] bg-background/40 border-white/10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Até</Label>
                <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-[160px] bg-background/40 border-white/10" />
              </div>
              <div className="flex gap-1.5">
                {presets.map((p) => (
                  <Button key={p.label} type="button" variant="outline" size="sm" onClick={p.apply} className="bg-background/30 border-white/10 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors">
                    {p.label}
                  </Button>
                ))}
              </div>
              <Button onClick={() => fetchAll(false)} disabled={loading} className="ml-auto shadow-lg shadow-primary/20">Aplicar</Button>
            </div>
          </Card>

          <Tabs defaultValue="kpis" className="space-y-5">
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="bg-card/30 backdrop-blur-xl border border-white/5 rounded-xl p-1 h-auto inline-flex gap-1 shadow-xl shadow-black/20">
                <TabsTrigger value="kpis" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">KPIs</TabsTrigger>
                <TabsTrigger value="sdrs" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">Reuniões / SDRs</TabsTrigger>
                <TabsTrigger value="mqls" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">MQLs</TabsTrigger>
                <TabsTrigger value="classes" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">Propostas A/B/C</TabsTrigger>
                <TabsTrigger value="funnel" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">Funil</TabsTrigger>
                <TabsTrigger value="trend" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">Histórico</TabsTrigger>
                <TabsTrigger value="followups" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">Follow-ups</TabsTrigger>
                <TabsTrigger value="noshow" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">No-show</TabsTrigger>
              </TabsList>
            </div>

            {/* KPIs */}
            <TabsContent value="kpis">
              {kpis ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {cards.map((c) => (
                    <Card
                      key={c.label}
                      className={`group relative overflow-hidden p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-lg shadow-black/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ring-1 ${c.ring}`}
                    >
                      <div className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${c.glow} to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />
                      <div className="relative flex items-center justify-between mb-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${c.iconBg}`}>
                          <c.icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="relative text-[11px] uppercase tracking-wider text-muted-foreground leading-tight">{c.label}</div>
                      <div className="relative text-2xl font-bold mt-1.5 tracking-tight">{c.value}</div>
                    </Card>
                  ))}
                </div>
              ) : loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Card key={i} className="p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl">
                      <Skeleton className="h-9 w-9 rounded-xl mb-3" />
                      <Skeleton className="h-3 w-24 mb-2" />
                      <Skeleton className="h-7 w-20" />
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-12 bg-card/30 backdrop-blur-xl border border-white/5 rounded-2xl text-center text-muted-foreground">
                  Sem dados no período.
                </Card>
              )}
            </TabsContent>

          {/* SDRs */}
          <TabsContent value="sdrs">
            <Card className="p-4 bg-card/40 backdrop-blur border-border/30 space-y-3">
              <div className="text-xs text-muted-foreground">
                Edite as metas (mensais) por SDR — salvas localmente no seu navegador. % é o atingimento no período filtrado.
              </div>
              {sdrRanking.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>SDR</TableHead>
                      <TableHead className="text-right">Agendados</TableHead>
                      <TableHead className="w-24 text-right">Meta ag.</TableHead>
                      <TableHead className="text-right">Realizados</TableHead>
                      <TableHead className="w-24 text-right">Meta real.</TableHead>
                      <TableHead className="text-right">No-show</TableHead>
                      <TableHead className="text-right">Show rate</TableHead>
                      <TableHead className="text-right">Atingimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sdrRanking.map((s, idx) => {
                      const atAg = s.goal.agendados ? (s.agendados / s.goal.agendados) * 100 : null;
                      const atRl = s.goal.realizados ? (s.realizados / s.goal.realizados) * 100 : null;
                      return (
                        <TableRow key={s.user.id}>
                          <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{s.user.name}</TableCell>
                          <TableCell className="text-right">{s.agendados}</TableCell>
                          <TableCell className="text-right">
                            <Input type="number" min={0} value={s.goal.agendados || ""} onChange={(e) => updateGoal(s.user.id, "agendados", Number(e.target.value) || 0)} className="h-7 w-20 text-right text-xs" />
                          </TableCell>
                          <TableCell className="text-right text-emerald-400">{s.realizados}</TableCell>
                          <TableCell className="text-right">
                            <Input type="number" min={0} value={s.goal.realizados || ""} onChange={(e) => updateGoal(s.user.id, "realizados", Number(e.target.value) || 0)} className="h-7 w-20 text-right text-xs" />
                          </TableCell>
                          <TableCell className="text-right text-rose-400">{s.noshow}</TableCell>
                          <TableCell className="text-right">{fmtPct(s.showRate)}</TableCell>
                          <TableCell className="text-right text-xs">
                            {atAg != null && <div className={atAg >= 100 ? "text-emerald-400" : "text-amber-400"}>Ag: {fmtPct(atAg)}</div>}
                            {atRl != null && <div className={atRl >= 100 ? "text-emerald-400" : "text-amber-400"}>Rl: {fmtPct(atRl)}</div>}
                            {atAg == null && atRl == null && <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : <div className="text-center py-12 text-muted-foreground text-sm">Sem reuniões no período.</div>}
            </Card>
          </TabsContent>

          {/* MQLs */}
          <TabsContent value="mqls" className="space-y-3">
            {fase2 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { l: "Total MQLs", v: fase2.mqlSummary.total },
                  { l: "Agendados", v: fase2.mqlSummary.agendados },
                  { l: "Não agendados", v: fase2.mqlSummary.naoAgendados },
                  { l: "Realizados", v: fase2.mqlSummary.realizados },
                  { l: "No-show", v: fase2.mqlSummary.noshow },
                ].map((c) => (
                  <Card key={c.l} className="p-3 bg-card/40 backdrop-blur border-border/30">
                    <div className="text-xs text-muted-foreground">{c.l}</div>
                    <div className="text-2xl font-bold mt-1">{fmtNum(c.v)}</div>
                  </Card>
                ))}
              </div>
            )}
            <Card className="p-4 bg-card/40 backdrop-blur border-border/30">
              {fase2 && fase2.mqlsList.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Reunião</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fase2.mqlsList.slice(0, 200).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</div>}
                          {m.email && <div>{m.email}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{m.dateAdded ? new Date(m.dateAdded).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell className="text-xs">
                          {m.horario ? (
                            <div className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{new Date(m.horario).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{situacaoBadge(m.situacao)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <div className="text-center py-12 text-muted-foreground text-sm">Sem MQLs no período.</div>}
              {fase2 && fase2.mqlsList.length > 200 && (
                <p className="text-xs text-muted-foreground text-center mt-3">Mostrando 200 de {fase2.mqlsList.length}.</p>
              )}
            </Card>
          </TabsContent>

          {/* Classes A/B/C */}
          <TabsContent value="classes">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {fase2 && (["A", "B", "C", "Outro"] as const).map((k) => {
                const c = fase2.classes[k];
                const colorMap: Record<string, string> = {
                  A: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
                  B: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
                  C: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
                  Outro: "from-muted/40 to-muted/10 border-border",
                };
                return (
                  <Card key={k} className={`p-4 bg-gradient-to-br ${colorMap[k]} border backdrop-blur space-y-3`}>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold">Classe {k}</div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Propostas</span><span className="font-semibold">{fmtNum(c.propostas)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Vendas</span><span className="font-semibold">{fmtNum(c.vendas)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Faturamento</span><span className="font-semibold">{fmtBRL(c.faturamento)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Conversão</span><span className="font-semibold">{c.propostas > 0 ? fmtPct((c.vendas / c.propostas) * 100) : "—"}</span></div>
                    </div>
                    <div className="text-[10px] text-muted-foreground border-t border-border/30 pt-2">
                      {c.pipelines.length > 0 ? c.pipelines.join(" · ") : "Sem pipelines mapeados"}
                    </div>
                  </Card>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground/70 mt-3">
              Classificação inferida pelo nome do pipeline (procuro "A", "B", "C"). Renomeie pipelines no GHL para algo como "Cliente A · Vendas" se quiser ajustar.
            </p>
          </TabsContent>

          {/* No-show por horário */}
          <TabsContent value="noshow">
            <Card className="p-4 bg-card/40 backdrop-blur border-border/30">
              {hourEntries.length > 0 ? (
                <div className="space-y-2">
                  {hourEntries.map(([hr, v]) => (
                    <div key={hr} className="flex items-center gap-3">
                      <div className="w-12 text-sm text-muted-foreground">{hr}</div>
                      <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden">
                        <div className="h-full bg-rose-500/60" style={{ width: `${(v / maxNoShow) * 100}%` }} />
                      </div>
                      <div className="w-10 text-right text-sm font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-12 text-muted-foreground text-sm">Nenhum no-show registrado no período.</div>}
            </Card>
          </TabsContent>

          {/* Funil por estágio */}
          <TabsContent value="funnel" className="space-y-4">
            {fase3 && (
              <>
                <Card className="p-4 bg-card/40 backdrop-blur border-border/30 space-y-3">
                  <div className="text-sm font-semibold flex items-center gap-2"><FilterIcon className="h-4 w-4" /> Funil agregado</div>
                  <div className="space-y-2">
                    {(() => {
                      const top = fase3.aggregateFunnel[0]?.count || 1;
                      return fase3.aggregateFunnel.map((f, i) => {
                        const prev = i > 0 ? fase3.aggregateFunnel[i - 1].count : null;
                        const conv = prev && prev > 0 ? (f.count / prev) * 100 : null;
                        return (
                          <div key={f.stage} className="flex items-center gap-3">
                            <div className="w-32 text-sm text-muted-foreground">{f.stage}</div>
                            <div className="flex-1 h-7 bg-muted/30 rounded overflow-hidden">
                              <div className="h-full bg-primary/60 flex items-center px-2 text-xs font-semibold text-foreground" style={{ width: `${Math.max(2, (f.count / top) * 100)}%` }}>
                                {fmtNum(f.count)}
                              </div>
                            </div>
                            <div className="w-20 text-right text-xs text-muted-foreground">
                              {conv != null ? fmtPct(conv) : "—"}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </Card>

                <Card className="p-4 bg-card/40 backdrop-blur border-border/30 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-sm font-semibold">Funil por pipeline</div>
                    <select className="bg-background border border-border/40 rounded px-2 py-1 text-xs" value={funnelPipeline} onChange={(e) => setFunnelPipeline(e.target.value)}>
                      <option value="__all__">Todos os pipelines</option>
                      {fase3.pipelineFunnels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-4">
                    {fase3.pipelineFunnels
                      .filter((p) => funnelPipeline === "__all__" || p.id === funnelPipeline)
                      .map((p) => {
                        const top = Math.max(1, ...p.stages.map((s) => s.count));
                        return (
                          <div key={p.id} className="space-y-1.5 border-t border-border/20 pt-3 first:border-0 first:pt-0">
                            <div className="flex items-center justify-between text-xs">
                              <div className="font-semibold">{p.name}</div>
                              <div className="text-muted-foreground">Won: <span className="text-emerald-400">{p.won}</span> · Lost: <span className="text-rose-400">{p.lost}</span> · Aberto: {fmtBRL(p.openValue)}</div>
                            </div>
                            {p.stages.map((s) => (
                              <div key={s.id} className="flex items-center gap-2">
                                <div className="w-40 text-xs text-muted-foreground truncate" title={s.name}>{s.name}</div>
                                <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                                  <div className="h-full bg-cyan-500/50" style={{ width: `${(s.count / top) * 100}%` }} />
                                </div>
                                <div className="w-12 text-right text-xs">{s.count}</div>
                                <div className="w-24 text-right text-xs text-muted-foreground">{fmtBRL(s.value)}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Histórico / tendência */}
          <TabsContent value="trend" className="space-y-4">
            {fase3 && fase3.trend.length > 0 ? (
              <>
                <Card className="p-4 bg-card/40 backdrop-blur border-border/30">
                  <div className="text-sm font-semibold mb-3">MQLs e Vendas por semana</div>
                  <div className="h-64">
                    <ResponsiveContainer>
                      <LineChart data={fase3.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                        <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RTooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="mqls" stroke="#06b6d4" strokeWidth={2} name="MQLs" />
                        <Line type="monotone" dataKey="vendas" stroke="#10b981" strokeWidth={2} name="Vendas" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4 bg-card/40 backdrop-blur border-border/30">
                  <div className="text-sm font-semibold mb-3">Faturamento × Investimento</div>
                  <div className="h-64">
                    <ResponsiveContainer>
                      <LineChart data={fase3.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                        <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                        <RTooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} formatter={(v: any) => fmtBRL(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="faturamento" stroke="#facc15" strokeWidth={2} name="Faturamento" />
                        <Line type="monotone" dataKey="investimento" stroke="#a855f7" strokeWidth={2} name="Investimento" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4 bg-card/40 backdrop-blur border-border/30">
                  <div className="text-sm font-semibold mb-3">CAC × ROAS</div>
                  <div className="h-64">
                    <ResponsiveContainer>
                      <LineChart data={fase3.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                        <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="cac" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                        <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}x`} />
                        <RTooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line yAxisId="cac" type="monotone" dataKey="cac" stroke="#f43f5e" strokeWidth={2} name="CAC (R$)" />
                        <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="#8b5cf6" strokeWidth={2} name="ROAS (x)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </>
            ) : <div className="text-center py-12 text-muted-foreground text-sm">Sem dados de tendência.</div>}
          </TabsContent>

          {/* Follow-ups */}
          <TabsContent value="followups" className="space-y-4">
            {fase3 && (() => {
              const fu = fase3.followUps;
              const sections: { title: string; icon: any; rows: any[]; cols: string[]; render: (r: any) => React.ReactNode[]; threshold: number }[] = [
                {
                  title: "MQLs sem agendamento",
                  icon: AlertTriangle,
                  rows: fu.mqlsSemAgendamento,
                  threshold: fu.thresholds.semAgendDias,
                  cols: ["Nome", "Contato", "Entrada", "Dias parado"],
                  render: (r) => [
                    <span className="font-medium">{r.nome}</span>,
                    <span className="text-xs text-muted-foreground">{r.phone || r.email || "—"}</span>,
                    <span className="text-xs">{new Date(r.dateAdded).toLocaleDateString("pt-BR")}</span>,
                    <Badge variant="outline" className="bg-rose-500/20 text-rose-300 border-rose-500/30">{r.diasParado}d</Badge>,
                  ],
                },
                {
                  title: "Propostas paradas",
                  icon: Clock,
                  rows: fu.propostasParadas,
                  threshold: fu.thresholds.propostaParadaDias,
                  cols: ["Oportunidade", "Pipeline", "Valor", "Dias parado"],
                  render: (r) => [
                    <span className="font-medium">{r.nome}</span>,
                    <span className="text-xs text-muted-foreground">{r.pipeline}</span>,
                    <span className="text-xs">{fmtBRL(r.valor)}</span>,
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30">{r.diasParado}d</Badge>,
                  ],
                },
                {
                  title: "Oportunidades estagnadas",
                  icon: Clock,
                  rows: fu.opsEstagnadas,
                  threshold: fu.thresholds.oppEstagnadaDias,
                  cols: ["Oportunidade", "Pipeline / Stage", "Valor", "Dias parado"],
                  render: (r) => [
                    <span className="font-medium">{r.nome}</span>,
                    <span className="text-xs text-muted-foreground">{r.pipeline} · {r.stage}</span>,
                    <span className="text-xs">{fmtBRL(r.valor)}</span>,
                    <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/30">{r.diasParado}d</Badge>,
                  ],
                },
              ];
              return sections.map((sec) => (
                <Card key={sec.title} className="p-4 bg-card/40 backdrop-blur border-border/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <sec.icon className="h-4 w-4" /> {sec.title}
                      <Badge variant="outline" className="ml-1">{sec.rows.length}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">≥ {sec.threshold} dias parado</span>
                  </div>
                  {sec.rows.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">Tudo em dia.</div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow>{sec.cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
                      <TableBody>
                        {sec.rows.map((r) => (
                          <TableRow key={r.id}>
                            {sec.render(r).map((cell, i) => <TableCell key={i}>{cell}</TableCell>)}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              ));
            })()}
          </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground/60 text-center pt-4">
            Investimento via Meta Ads (act_507006368954918, Token de Will). Reuniões/MQLs/Vendas via GoHighLevel.
          </p>
        </div>
      </div>
    </div>
  );
}
