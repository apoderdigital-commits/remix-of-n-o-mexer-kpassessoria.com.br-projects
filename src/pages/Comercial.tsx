import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, TrendingUp, Users, Target, ShoppingCart, DollarSign, Wallet, Percent, Trophy, Phone, CalendarClock, AlertTriangle, Clock, Filter as FilterIcon } from "lucide-react";
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

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [k, f, f3] = await Promise.all([
        supabase.functions.invoke("kp-comercial-kpis", { body: { since, until } }),
        supabase.functions.invoke("kp-comercial-fase2", { body: { since, until } }),
        supabase.functions.invoke("kp-comercial-fase3", { body: { since, until } }),
      ]);
      if (k.error) throw k.error;
      if ((k.data as any)?.error) throw new Error((k.data as any).error);
      setKpis(k.data as Kpis);
      if ((k.data as any)?.metaError) toast.warning("Meta Ads: " + (k.data as any).metaError);
      if (f.error) throw f.error;
      if ((f.data as any)?.error) throw new Error((f.data as any).error);
      setFase2(f.data as Fase2);
      if (f3.error) throw f3.error;
      if ((f3.data as any)?.error) throw new Error((f3.data as any).error);
      setFase3(f3.data as Fase3);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchAll(); /* eslint-disable-next-line */ }, []);

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
    { icon: Users, label: "Leads Totais", value: fmtNum(kpis.leadsTotais), color: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/30" },
    { icon: Target, label: "Leads MQL", value: fmtNum(kpis.mqls), color: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/30" },
    { icon: Percent, label: "Taxa Ativação MQL", value: fmtPct(kpis.taxaAtivacaoMql), color: "from-teal-500/20 to-teal-500/5", border: "border-teal-500/30" },
    { icon: ShoppingCart, label: "Vendas", value: fmtNum(kpis.vendas), color: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30" },
    { icon: DollarSign, label: "Ticket Médio", value: fmtBRL(kpis.ticketMedio), color: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/30" },
    { icon: Wallet, label: "Faturamento", value: fmtBRL(kpis.faturamento), color: "from-yellow-500/20 to-yellow-500/5", border: "border-yellow-500/30" },
    { icon: TrendingUp, label: "Investimento Tráfego", value: fmtBRL(kpis.investimento), color: "from-fuchsia-500/20 to-fuchsia-500/5", border: "border-fuchsia-500/30" },
    { icon: Trophy, label: "CAC", value: fmtBRL(kpis.cac), color: "from-rose-500/20 to-rose-500/5", border: "border-rose-500/30" },
    { icon: TrendingUp, label: "ROAS", value: kpis.roas > 0 ? `${kpis.roas.toFixed(2)}x` : "—", color: "from-purple-500/20 to-purple-500/5", border: "border-purple-500/30" },
    { icon: Percent, label: "Win Rate", value: fmtPct(kpis.winRate), color: "from-primary/20 to-primary/5", border: "border-primary/30" },
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
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Portal
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Painel Comercial · KP</h1>
            <p className="text-sm text-muted-foreground mt-1">GoHighLevel + Meta Ads</p>
          </div>
          <Button onClick={fetchAll} disabled={loading} className="gap-2">
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
            <Button onClick={fetchAll} disabled={loading} className="ml-auto">Aplicar</Button>
          </div>
        </Card>

        <Tabs defaultValue="kpis" className="space-y-4">
          <TabsList className="bg-card/40 backdrop-blur flex-wrap h-auto">
            <TabsTrigger value="kpis">KPIs</TabsTrigger>
            <TabsTrigger value="sdrs">Reuniões / SDRs</TabsTrigger>
            <TabsTrigger value="mqls">MQLs</TabsTrigger>
            <TabsTrigger value="classes">Propostas & Vendas A/B/C</TabsTrigger>
            <TabsTrigger value="funnel">Funil por estágio</TabsTrigger>
            <TabsTrigger value="trend">Histórico</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            <TabsTrigger value="noshow">No-show por horário</TabsTrigger>
          </TabsList>

          {/* KPIs */}
          <TabsContent value="kpis">
            {kpis ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {cards.map((c) => (
                  <Card key={c.label} className={`p-4 bg-gradient-to-br ${c.color} ${c.border} border backdrop-blur`}>
                    <div className="flex items-start justify-between mb-2"><c.icon className="h-4 w-4 text-foreground/70" /></div>
                    <div className="text-xs text-muted-foreground leading-tight">{c.label}</div>
                    <div className="text-xl font-bold mt-1 tracking-tight">{c.value}</div>
                  </Card>
                ))}
              </div>
            ) : <div className="text-center py-20 text-muted-foreground">Sem dados.</div>}
          </TabsContent>

          {/* SDRs */}
          <TabsContent value="sdrs">
            <Card className="p-4 bg-card/40 backdrop-blur border-border/30">
              {fase2 && fase2.sdrs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SDR</TableHead>
                      <TableHead className="text-right">Agendados</TableHead>
                      <TableHead className="text-right">Realizados</TableHead>
                      <TableHead className="text-right">No-show</TableHead>
                      <TableHead className="text-right">Cancelados</TableHead>
                      <TableHead className="text-right">Show rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fase2.sdrs.map((s) => {
                      const sr = s.agendados > 0 ? (s.realizados / s.agendados) * 100 : 0;
                      return (
                        <TableRow key={s.user.id}>
                          <TableCell className="font-medium">{s.user.name}</TableCell>
                          <TableCell className="text-right">{s.agendados}</TableCell>
                          <TableCell className="text-right text-emerald-400">{s.realizados}</TableCell>
                          <TableCell className="text-right text-rose-400">{s.noshow}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{s.cancelados}</TableCell>
                          <TableCell className="text-right">{fmtPct(sr)}</TableCell>
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
        </Tabs>

        <p className="text-xs text-muted-foreground/60 text-center pt-4">
          Investimento via Meta Ads (act_507006368954918, Token de Will). Reuniões/MQLs/Vendas via GoHighLevel.
        </p>
      </div>
    </div>
  );
}
