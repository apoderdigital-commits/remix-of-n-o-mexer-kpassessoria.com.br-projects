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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
type ApptCategory = "MQL" | "A" | "B" | "C" | "Outro";
interface ApptEntry { contactId: string | null; nome: string; email?: string; phone?: string; startTime?: string; category: ApptCategory; sdrName?: string }
interface Sdr {
  user: { id: string; name: string; email?: string };
  agendados: number; realizados: number; noshow: number; cancelados: number;
  vendas?: Record<"A"|"B"|"C"|"Outro", number>;
  lists?: { agendado: ApptEntry[]; realizado: ApptEntry[]; noshow: ApptEntry[]; cancelado: ApptEntry[] };
}
interface MqlRow { id: string; nome: string; email?: string; phone?: string; dateAdded?: string; situacao: "agendado" | "realizado" | "noshow" | "sem_agendamento"; horario?: string; sdrName?: string | null; categoria?: ApptCategory; }
interface ClassData { leads: number; propostas: number; vendas: number; faturamento: number; pipelines: string[]; }
interface CloserEntry {
  contactId?: string | null; oppId?: string; nome: string; email?: string; phone?: string;
  startTime?: string; valor?: number; pipeline?: string | null;
}
type CloserBucket = "realizados" | "vendas" | "propostasAbertas" | "propostasPerdidas";
interface Closer {
  user: { id: string; name: string; email?: string };
  lists: Record<CloserBucket, Record<"A"|"B"|"C"|"Outro", CloserEntry[]>>;
}
interface Fase2 {
  sdrs: Sdr[];
  closers: Closer[];
  noShowByHour: Record<string, number>;
  agendadosByHour: Record<string, number>;
  mqlSummary: { total: number; agendados: number; naoAgendados: number; realizados: number; noshow: number };
  mqlsList: MqlRow[];
  nonMqlsList: MqlRow[];
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

interface GhlUser { id: string; name: string; email?: string }
interface UserRoleRow { ghl_user_id: string; name: string | null; email: string | null; role: "sdr" | "closer" | "both" | "none"; active: boolean }

interface SdrGoal { agendados: number; realizados: number; vendas: number }
type SdrGoals = Record<string, SdrGoal>;

export default function Comercial() {
  const { isAdmin, squadCount, loading: authLoading } = useAuth();
  const allowed = isAdmin || squadCount > 0;

  const [since, setSince] = useState(startOfMonth());
  const [until, setUntil] = useState(todayIso());
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [fase2, setFase2] = useState<Fase2 | null>(null);
  const [fase3, setFase3] = useState<Fase3 | null>(null);
  const [goals, setGoals] = useState<SdrGoals>({});
  const [drillDown, setDrillDown] = useState<{ sdrName: string; tipo: "agendado" | "realizado" | "noshow"; items: ApptEntry[]; agendados: number; realizados: number; noshow: number } | null>(null);
  const [funnelPipeline, setFunnelPipeline] = useState<string>("__all__");
  const [source, setSource] = useState<"cache" | "fresh" | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [ghlUsers, setGhlUsers] = useState<GhlUser[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, UserRoleRow>>({});
  const [pipelinesList, setPipelinesList] = useState<{ id: string; name: string; stages?: { id: string; name: string }[] }[]>([]);
  const [pipelineCfg, setPipelineCfg] = useState<Record<string, any>>({});
  const [dataSources, setDataSources] = useState<any>(null);
  const [dsCounts, setDsCounts] = useState<any>(null);
  const [ghlCalendars, setGhlCalendars] = useState<{ ghl_calendar_id: string; name: string; enabled: boolean }[]>([]);
  const [syncingCalendars, setSyncingCalendars] = useState(false);
  const [apptDebug, setApptDebug] = useState<any>(null);

  const [mqlListOpen, setMqlListOpen] = useState<null | "mql" | "nonmql">(null);
  const [closerDrill, setCloserDrill] = useState<null | { closerName: string; bucket: CloserBucket; classe: "A"|"B"|"C"|"Outro"|"Total"; items: CloserEntry[] }>(null);
  const [semAgendOpen, setSemAgendOpen] = useState(false);
  const [mqlFilterOpen, setMqlFilterOpen] = useState<null | { title: string; rows: MqlRow[] }>(null);


  const applyPayload = (payload: any) => {
    if (!payload) return;
    if (payload.kpis) setKpis(payload.kpis);
    if (payload.users) setGhlUsers(payload.users);
    if (payload.pipelines) setPipelinesList(payload.pipelines);
    if (payload.dataSources) {
      setDataSources(payload.dataSources);
      setDsCounts({ sheet: payload.dataSources.sheetCounts, ghl: payload.dataSources.ghlCounts, sheetError: payload.dataSources.sheetError });
    }
    setFase2({
      sdrs: payload.sdrs || [],
      closers: payload.closers || [],
      noShowByHour: payload.noShowByHour || {},
      agendadosByHour: payload.agendadosByHour || {},
      mqlSummary: payload.mqlSummary || { total: 0, agendados: 0, naoAgendados: 0, realizados: 0, noshow: 0 },
      mqlsList: payload.mqlsList || [],
      nonMqlsList: payload.nonMqlsList || [],
      classes: payload.classes || { A: { leads: 0, propostas: 0, vendas: 0, faturamento: 0, pipelines: [] }, B: { leads: 0, propostas: 0, vendas: 0, faturamento: 0, pipelines: [] }, C: { leads: 0, propostas: 0, vendas: 0, faturamento: 0, pipelines: [] }, Outro: { leads: 0, propostas: 0, vendas: 0, faturamento: 0, pipelines: [] } },
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

  const fetchRoles = async () => {
    const [rolesRes, goalsRes, pipeRes, dsRes] = await Promise.all([
      supabase.from("kp_comercial_user_roles").select("*"),
      supabase.from("kp_comercial_sdr_goals").select("*"),
      supabase.from("kp_comercial_pipeline_config").select("*"),
      (supabase.from as any)("kp_comercial_data_sources").select("*").eq("id", true).maybeSingle(),
    ]);
    if (rolesRes.data) {
      const map: Record<string, UserRoleRow> = {};
      for (const r of rolesRes.data as any[]) map[r.ghl_user_id] = r;
      setUserRoles(map);
    }
    if (goalsRes.data) {
      const map: SdrGoals = {};
      for (const g of goalsRes.data as any[]) {
        map[g.ghl_user_id] = { agendados: g.agendados || 0, realizados: g.realizados || 0, vendas: g.vendas || 0 };
      }
      setGoals(map);
    }
    if (pipeRes.data) {
      const map: Record<string, any> = {};
      for (const r of pipeRes.data as any[]) map[r.pipeline_id] = r;
      setPipelineCfg(map);
    }
    if (dsRes?.data) setDataSources(dsRes.data);
  };

  const setUserRole = async (u: GhlUser, role: UserRoleRow["role"]) => {
    const payload = { ghl_user_id: u.id, name: u.name, email: u.email || null, role, active: true };
    const { error } = await supabase.from("kp_comercial_user_roles").upsert(payload, { onConflict: "ghl_user_id" });
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    setUserRoles((p) => ({ ...p, [u.id]: { ...payload, name: u.name, email: u.email || null } as UserRoleRow }));
    toast.success(`${u.name}: ${role.toUpperCase()}`);
  };

  const setPipelineClasse = async (pipeline: { id: string; name: string }, classe: string | null) => {
    const payload: any = { pipeline_id: pipeline.id, pipeline_name: pipeline.name, classe };
    const { error } = await supabase.from("kp_comercial_pipeline_config").upsert(payload, { onConflict: "pipeline_id" });
    if (error) { toast.error("Erro: " + error.message); return; }
    setPipelineCfg((p) => ({ ...p, [pipeline.id]: { ...p[pipeline.id], classe } }));
    toast.success(`${pipeline.name}: ${classe || "—"}`);
  };

  const setPipelineKind = async (pipeline: { id: string; name: string }, kind: string | null) => {
    const payload: any = { pipeline_id: pipeline.id, pipeline_name: pipeline.name, kind };
    const { error } = await supabase.from("kp_comercial_pipeline_config").upsert(payload, { onConflict: "pipeline_id" });
    if (error) { toast.error("Erro: " + error.message); return; }
    setPipelineCfg((p) => ({ ...p, [pipeline.id]: { ...p[pipeline.id], kind } }));
    toast.success(`${pipeline.name}: ${kind || "—"}`);
  };

  type StageKey = "stages_reuniao_marcada"|"stages_comparecida"|"stages_proposta_enviada"|"stages_proposta_perdida"|"stages_vendida"|"stages_noshow";
  const toggleStageMapping = async (pipeline: { id: string; name: string }, key: StageKey, stageId: string) => {
    const current: string[] = pipelineCfg[pipeline.id]?.[key] || [];
    const next = current.includes(stageId) ? current.filter((x) => x !== stageId) : [...current, stageId];
    const payload: any = { pipeline_id: pipeline.id, pipeline_name: pipeline.name, [key]: next };
    const { error } = await supabase.from("kp_comercial_pipeline_config").upsert(payload, { onConflict: "pipeline_id" });
    if (error) { toast.error("Erro: " + error.message); return; }
    setPipelineCfg((p) => ({ ...p, [pipeline.id]: { ...p[pipeline.id], [key]: next } }));
  };

  const updateDataSource = async (patch: Record<string, any>) => {
    const next = { ...(dataSources || {}), ...patch };
    setDataSources(next);
    const { error } = await (supabase.from as any)("kp_comercial_data_sources").upsert({ id: true, ...patch }, { onConflict: "id" });
    if (error) { toast.error("Erro ao salvar fonte: " + error.message); return; }
    toast.success("Fonte atualizada — clique em Atualizar para recalcular");
  };

  useEffect(() => { void fetchAll(false); void fetchRoles(); /* eslint-disable-next-line */ }, []);

  const updateGoalLocal = (sdrId: string, key: keyof SdrGoal, val: number) => {
    setGoals((g) => ({ ...g, [sdrId]: { agendados: 0, realizados: 0, vendas: 0, ...g[sdrId], [key]: val } }));
  };


  const persistGoal = async (sdrId: string) => {
    const g = goals[sdrId] || { agendados: 0, realizados: 0, vendas: 0 };
    const { error } = await supabase.from("kp_comercial_sdr_goals").upsert(
      { ghl_user_id: sdrId, agendados: g.agendados || 0, realizados: g.realizados || 0, vendas: g.vendas || 0 },
      { onConflict: "ghl_user_id" }
    );
    if (error) toast.error("Erro ao salvar meta: " + error.message);
    else toast.success("Meta salva");
  };

  const sdrRanking = useMemo(() => {
    if (!fase2) return [];
    const allowedRoles = new Set(["sdr", "both"]);
    const haveRoles = Object.keys(userRoles).length > 0;
    return [...fase2.sdrs]
      .filter((s) => {
        const r = userRoles[s.user.id]?.role;
        if (!haveRoles) return true; // sem config, mostra todos
        return r ? allowedRoles.has(r) : false; // com config, exige role
      })
      .map((s) => {
      const g = goals[s.user.id] || { agendados: 0, realizados: 0, vendas: 0 };
      const showRate = s.agendados > 0 ? (s.realizados / s.agendados) * 100 : 0;
      const score = (g.agendados ? (s.agendados / g.agendados) * 100 : 0)
        + (g.realizados ? (s.realizados / g.realizados) * 100 : 0);
      return { ...s, goal: g, showRate, score };
    }).sort((a, b) => (b.score - a.score) || (b.realizados - a.realizados));
  }, [fase2, goals, userRoles]);

  const presets = [
    { label: "Hoje", apply: () => { const d = todayIso(); setSince(d); setUntil(d); } },
    { label: "Esta semana", apply: () => {
      const d = new Date(); const day = d.getDay() || 7;
      const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
      setSince(monday.toISOString().slice(0, 10)); setUntil(todayIso());
    }},
    { label: "Este mês", apply: () => { setSince(startOfMonth()); setUntil(todayIso()); } },
  ];

  // Funil principal: Leads → MQLs → Reuniões → Comparecidas → Vendas (taxa ativação = MQLs/Leads exibida no estágio MQL)
  const funnelStages = kpis && fase2 ? (() => {
    const leads = kpis.leadsTotais;
    const mqls = kpis.mqls;
    const marc = fase2.mqlSummary.agendados;
    const comp = fase2.mqlSummary.realizados;
    const vend = kpis.vendas;
    const pct = (n: number, base: number) => (base > 0 ? (n / base) * 100 : 0);
    return [
      { icon: Users,          label: "Leads Totais",       count: leads, pctTotal: 100,                    pctPrev: null,                       grad: "from-blue-500/80 to-blue-600/40",     iconBg: "bg-blue-500/20 text-blue-200" },
      { icon: Target,         label: "MQLs",               count: mqls,  pctTotal: pct(mqls, leads),       pctPrev: pct(mqls, leads),           grad: "from-cyan-500/80 to-cyan-600/40",     iconBg: "bg-cyan-500/20 text-cyan-200" },
      { icon: Percent,        label: "Taxa Ativação MQL",  count: null,  pctTotal: kpis.taxaAtivacaoMql,   pctPrev: null, isRate: true,         grad: "from-teal-500/80 to-teal-600/40",     iconBg: "bg-teal-500/20 text-teal-200" },
      { icon: CalendarClock,  label: "Reuniões Marcadas",  count: marc,  pctTotal: pct(marc, leads),       pctPrev: pct(marc, mqls),            grad: "from-violet-500/80 to-violet-600/40", iconBg: "bg-violet-500/20 text-violet-200" },
      { icon: CalendarCheck2, label: "Comparecidas",       count: comp,  pctTotal: pct(comp, leads),       pctPrev: pct(comp, marc),            grad: "from-fuchsia-500/80 to-fuchsia-600/40", iconBg: "bg-fuchsia-500/20 text-fuchsia-200" },
      { icon: CheckCircle2,   label: "Vendas",             count: vend,  pctTotal: pct(vend, leads),       pctPrev: pct(vend, comp),            grad: "from-emerald-500/80 to-emerald-600/40", iconBg: "bg-emerald-500/20 text-emerald-200" },
    ];
  })() : [];

  const cards = kpis ? [
    { icon: DollarSign,   label: "Ticket Médio",        value: fmtBRL(kpis.ticketMedio),     ring: "ring-amber-500/20",    iconBg: "bg-amber-500/15 text-amber-300",        glow: "from-amber-500/20" },
    { icon: Wallet,       label: "Faturamento",         value: fmtBRL(kpis.faturamento),     ring: "ring-yellow-500/20",   iconBg: "bg-yellow-500/15 text-yellow-300",      glow: "from-yellow-500/20" },
    { icon: TrendingUp,   label: "Investimento Tráfego",value: fmtBRL(kpis.investimento),    ring: "ring-fuchsia-500/20",  iconBg: "bg-fuchsia-500/15 text-fuchsia-300",    glow: "from-fuchsia-500/20" },
    { icon: Trophy,       label: "CAC",                 value: fmtBRL(kpis.cac),             ring: "ring-rose-500/20",     iconBg: "bg-rose-500/15 text-rose-300",          glow: "from-rose-500/20" },
    { icon: TrendingUp,   label: "ROAS",                value: kpis.roas > 0 ? `${kpis.roas.toFixed(2)}x` : "—", ring: "ring-purple-500/20", iconBg: "bg-purple-500/15 text-purple-300", glow: "from-purple-500/20" },
    { icon: Percent,      label: "Win Rate",            value: fmtPct(kpis.winRate),         ring: "ring-primary/20",      iconBg: "bg-primary/15 text-primary",            glow: "from-primary/20" },
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
                
                <TabsTrigger value="closers" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">Closers</TabsTrigger>
                <TabsTrigger value="noshow" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all">No-show</TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="config" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 transition-all gap-1.5">
                    <Settings className="h-3.5 w-3.5" /> Config
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* KPIs */}
            <TabsContent value="kpis" className="space-y-5">
              {kpis && fase2 ? (
                <>
                  {/* Funil principal */}
                  <Card className="relative overflow-hidden p-6 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-black/20">
                    <div className="pointer-events-none absolute -top-20 right-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
                    <div className="relative flex items-center justify-between mb-5">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Funil de conversão</div>
                        <div className="text-lg font-semibold mt-0.5">Do lead até a venda</div>
                      </div>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] gap-1">
                        {dataSources ? `leads via ${dataSources.leads_source === "sheet" ? "planilha" : "GHL"} · MQLs via ${dataSources.mqls_source === "sheet" ? "planilha" : "GHL"}` : "tempo real"}
                      </Badge>
                    </div>
                    <div className="relative space-y-2 flex flex-col items-center">
                      {funnelStages.map((s, i) => {
                        const width = Math.max(34, 100 - i * 13);
                        return (
                          <div key={s.label} className="flex items-center gap-3 w-full">
                            <div className="w-44 shrink-0 flex items-center gap-2.5">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                                <s.icon className="h-4 w-4" />
                              </div>
                              <div className="text-xs font-medium text-foreground/90 leading-tight">{s.label}</div>
                            </div>
                            <div className="flex-1 flex justify-center">
                              <div
                                className={`h-12 rounded-xl bg-gradient-to-r ${s.grad} shadow-lg flex items-center justify-between px-5 transition-all duration-700 ease-out`}
                                style={{ width: `${width}%` }}
                              >
                                <div className="text-lg font-bold text-white drop-shadow-sm tracking-tight">
                                  {s.isRate ? "—" : fmtNum(s.count || 0)}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-white/95">
                                  {s.isRate ? (
                                    <span className="bg-black/25 rounded-full px-2.5 py-0.5 backdrop-blur-sm font-bold text-sm">
                                      {fmtPct(s.pctTotal)}
                                    </span>
                                  ) : (
                                    <>
                                      <span className="bg-black/25 rounded-full px-2 py-0.5 backdrop-blur-sm font-semibold">
                                        {fmtPct(s.pctTotal)} do topo
                                      </span>
                                      {s.pctPrev != null && i > 0 && (
                                        <span className="hidden md:inline bg-white/20 rounded-full px-2 py-0.5 backdrop-blur-sm">
                                          ↓ {fmtPct(s.pctPrev)}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Indicadores financeiros (quadrados) */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                </>
              ) : loading ? (
                <div className="space-y-5">
                  <Skeleton className="h-96 w-full rounded-2xl" />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} className="p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl">
                        <Skeleton className="h-9 w-9 rounded-xl mb-3" />
                        <Skeleton className="h-3 w-24 mb-2" />
                        <Skeleton className="h-7 w-20" />
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Card className="p-12 bg-card/30 backdrop-blur-xl border border-white/5 rounded-2xl text-center text-muted-foreground">
                  Sem dados no período.
                </Card>
              )}
            </TabsContent>

          {/* SDRs */}
          <TabsContent value="sdrs" className="space-y-4">
            {/* Resumo MQL + botões de lista (migrados da aba MQLs) */}
            {fase2 && (
              <Card className="p-4 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-cyan-300" /> Visão geral de leads no período
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 bg-cyan-500/10 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20"
                      onClick={() => setMqlListOpen("mql")}>
                      Ver lista de MQLs ({fmtNum(fase2.mqlSummary.total)})
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 bg-muted/20 border-white/10 text-muted-foreground hover:bg-white/5"
                      onClick={() => setMqlListOpen("nonmql")}>
                      Ver lista de não-MQLs ({fmtNum(fase2.nonMqlsList.length)})
                    </Button>
                    {fase3 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 bg-rose-500/10 border-rose-500/30 text-rose-200 hover:bg-rose-500/20"
                        onClick={() => setSemAgendOpen(true)}>
                        <AlertTriangle className="h-3 w-3" /> MQLs sem agendamento ({fmtNum(fase3.followUps.mqlsSemAgendamento.length)})
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { l: "Total MQLs", v: fase2.mqlSummary.total, c: "text-cyan-200", filter: (m: MqlRow) => true, title: "Todos os MQLs" },
                    { l: "Agendados", v: fase2.mqlSummary.agendados, c: "text-blue-200", filter: (m: MqlRow) => m.situacao !== "sem_agendamento", title: "MQLs agendados" },
                    { l: "Não agendados", v: fase2.mqlSummary.naoAgendados, c: "text-muted-foreground", filter: (m: MqlRow) => m.situacao === "sem_agendamento", title: "MQLs não agendados" },
                    { l: "Realizados", v: fase2.mqlSummary.realizados, c: "text-emerald-200", filter: (m: MqlRow) => m.situacao === "realizado", title: "MQLs realizados" },
                    { l: "No-show", v: fase2.mqlSummary.noshow, c: "text-rose-200", filter: (m: MqlRow) => m.situacao === "noshow", title: "MQLs no-show" },
                  ].map((c) => (
                    <button
                      key={c.l}
                      type="button"
                      onClick={() => setMqlFilterOpen({ title: c.title, rows: fase2.mqlsList.filter(c.filter) })}
                      className="text-left rounded-xl bg-background/40 border border-white/5 px-3 py-2.5 hover:bg-background/60 hover:border-primary/30 transition-colors"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.l}</div>
                      <div className={`text-xl font-bold mt-0.5 ${c.c}`}>{fmtNum(c.v)}</div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-4 bg-card/40 backdrop-blur border-border/30 space-y-3">
              <div className="text-xs text-muted-foreground">
                Edite as metas (mensais) por SDR — salvas no banco. % é o atingimento no período filtrado. Clique nos números para ver os leads.
              </div>
              {sdrRanking.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>SDR</TableHead>
                      <TableHead className="text-right">Agendados</TableHead>
                      <TableHead className="w-28 text-right">Meta ag.</TableHead>
                      <TableHead className="text-right">Realizados</TableHead>
                      <TableHead className="w-28 text-right">Meta real.</TableHead>
                      <TableHead className="text-right">No-show</TableHead>
                      <TableHead className="text-right">Show rate</TableHead>
                      <TableHead className="text-right">Atingimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sdrRanking.map((s, idx) => {
                      const atAg = s.goal.agendados ? (s.agendados / s.goal.agendados) * 100 : null;
                      const atRl = s.goal.realizados ? (s.realizados / s.goal.realizados) * 100 : null;
                      const openDrill = (tipo: "agendado" | "realizado" | "noshow") => {
                        const items = s.lists?.[tipo] || [];
                        if (!items.length) { toast.info("Sem registros"); return; }
                        setDrillDown({ sdrName: s.user.name, tipo, items, agendados: s.agendados, realizados: s.realizados, noshow: s.noshow });
                      };
                      const cellBtn = "underline-offset-2 hover:underline cursor-pointer";
                      return (
                        <TableRow key={s.user.id}>
                          <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{s.user.name}</TableCell>
                          <TableCell className="text-right">
                            <button type="button" className={cellBtn} onClick={() => openDrill("agendado")}>{s.agendados}</button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number" min={0}
                              value={s.goal.agendados || ""}
                              onChange={(e) => updateGoalLocal(s.user.id, "agendados", Number(e.target.value) || 0)}
                              onBlur={() => persistGoal(s.user.id)}
                              className="h-7 w-20 text-right text-xs"
                            />
                          </TableCell>
                          <TableCell className="text-right text-emerald-400">
                            <button type="button" className={cellBtn} onClick={() => openDrill("realizado")}>{s.realizados}</button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number" min={0}
                              value={s.goal.realizados || ""}
                              onChange={(e) => updateGoalLocal(s.user.id, "realizados", Number(e.target.value) || 0)}
                              onBlur={() => persistGoal(s.user.id)}
                              className="h-7 w-20 text-right text-xs"
                            />
                          </TableCell>
                          <TableCell className="text-right text-rose-400">
                            <button type="button" className={cellBtn} onClick={() => openDrill("noshow")}>{s.noshow}</button>
                          </TableCell>
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

            {/* Breakdown por classe (A / B / C) por SDR */}
            {fase2 && sdrRanking.length > 0 && (() => {
              const colorMap: Record<string, { bar: string; chip: string; text: string }> = {
                A: { bar: "from-emerald-500/30 to-emerald-500/5", chip: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40", text: "text-emerald-200" },
                B: { bar: "from-amber-500/30 to-amber-500/5",   chip: "bg-amber-500/20 text-amber-200 border-amber-500/40",     text: "text-amber-200" },
                C: { bar: "from-blue-500/30 to-blue-500/5",     chip: "bg-blue-500/20 text-blue-200 border-blue-500/40",        text: "text-blue-200" },
              };
              const openClassDrill = (sdr: typeof sdrRanking[number], cls: "A"|"B"|"C", bucket: "agendado"|"realizado"|"noshow") => {
                const items = (sdr.lists?.[bucket] || []).filter(x => x.category === cls);
                if (!items.length) { toast.info("Sem registros"); return; }
                setDrillDown({ sdrName: `${sdr.user.name} · Lead ${cls}`, tipo: bucket, items, agendados: sdr.agendados, realizados: sdr.realizados, noshow: sdr.noshow });
              };
              return (
                <Card className="p-4 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl space-y-4">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-300" /> Conversão por classe de lead — por SDR
                  </div>

                  {/* Totais por classe no período */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(["A","B","C"] as const).map((k) => (
                      <div key={k} className={`rounded-xl bg-gradient-to-br ${colorMap[k].bar} border border-white/5 px-4 py-2.5 flex items-center justify-between`}>
                        <Badge variant="outline" className={colorMap[k].chip}>Total Leads {k}</Badge>
                        <div className={`text-2xl font-bold ${colorMap[k].text}`}>{fmtNum(fase2.classes[k].leads)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Tabela por SDR */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SDR</TableHead>
                          {(["A","B","C"] as const).map((k) => (
                            <TableHead key={k} colSpan={4} className={`text-center ${colorMap[k].text}`}>Lead {k}</TableHead>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableHead />
                          {(["A","B","C"] as const).flatMap((k) => [
                            <TableHead key={`${k}-h-l`} className="text-right text-[10px] uppercase">Leads</TableHead>,
                            <TableHead key={`${k}-h-a`} className="text-right text-[10px] uppercase">Agend.</TableHead>,
                            <TableHead key={`${k}-h-c`} className="text-right text-[10px] uppercase">Comp.</TableHead>,
                            <TableHead key={`${k}-h-v`} className="text-right text-[10px] uppercase">Vend.</TableHead>,
                          ])}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sdrRanking.map((s) => (
                          <TableRow key={s.user.id}>
                            <TableCell className="font-medium">{s.user.name}</TableCell>
                            {(["A","B","C"] as const).map((k) => {
                              const ag = s.lists?.agendado.filter(x => x.category === k).length || 0;
                              const co = s.lists?.realizado.filter(x => x.category === k).length || 0;
                              const ve = s.vendas?.[k] || 0;
                              const leads = ag; // contatos únicos atendidos pelo SDR nessa classe = nº de agendamentos
                              const cls = colorMap[k];
                              const btn = "hover:underline cursor-pointer";
                              return [
                                <TableCell key={`${k}-l`} className={`text-right text-xs ${cls.text}`}>{fmtNum(leads)}</TableCell>,
                                <TableCell key={`${k}-a`} className={`text-right text-xs ${cls.text} ${btn}`} onClick={() => openClassDrill(s, k, "agendado")}>{fmtNum(ag)}</TableCell>,
                                <TableCell key={`${k}-c`} className={`text-right text-xs ${cls.text} ${btn}`} onClick={() => openClassDrill(s, k, "realizado")}>{fmtNum(co)}</TableCell>,
                                <TableCell key={`${k}-v`} className={`text-right text-xs ${cls.text}`}>{fmtNum(ve)}</TableCell>,
                              ];
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              );
            })()}
          </TabsContent>


          {/* Classes A/B/C */}
          <TabsContent value="closers" className="space-y-4">
            {fase2 && (() => {
              const allowedRoles = new Set(["closer", "both"]);
              const closerList = fase2.closers.filter((c) => {
                const r = userRoles[c.user.id]?.role;
                return !r || allowedRoles.has(r); // sem config aparecem todos
              });
              const onlyClosers = fase2.closers.filter((c) => allowedRoles.has(userRoles[c.user.id]?.role || ""));
              const list = onlyClosers.length > 0 ? onlyClosers : closerList;

              if (list.length === 0) {
                return (
                  <Card className="p-10 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl text-center text-sm text-muted-foreground">
                    Nenhum closer com reuniões/vendas no período. {isAdmin && "Configure os closers na aba Config."}
                  </Card>
                );
              }

              const classKeys = ["A", "B", "C"] as const;
              const openDrill = (closerName: string, bucket: CloserBucket, classe: "A"|"B"|"C"|"Outro"|"Total", items: CloserEntry[]) => {
                if (!items.length) { toast.info("Sem registros"); return; }
                setCloserDrill({ closerName, bucket, classe, items });
              };
              const sumLists = (lists: CloserEntry[][]) => lists.reduce((a, b) => a.concat(b), []);

              return list.map((c) => {
                const L = c.lists;
                const totals = {
                  realizados: sumLists([L.realizados.A, L.realizados.B, L.realizados.C, L.realizados.Outro]),
                  vendas: sumLists([L.vendas.A, L.vendas.B, L.vendas.C, L.vendas.Outro]),
                  propostasAbertas: sumLists([L.propostasAbertas.A, L.propostasAbertas.B, L.propostasAbertas.C, L.propostasAbertas.Outro]),
                  propostasPerdidas: sumLists([L.propostasPerdidas.A, L.propostasPerdidas.B, L.propostasPerdidas.C, L.propostasPerdidas.Outro]),
                };
                const fat = (items: CloserEntry[]) => items.reduce((s, x) => s + (x.valor || 0), 0);
                const cellNum = "text-right text-xs font-semibold cursor-pointer hover:underline";
                const colorMap: Record<string, string> = {
                  A: "text-emerald-300", B: "text-amber-300", C: "text-blue-300", Total: "text-foreground",
                };

                const rows = [
                  {
                    label: "Reuniões realizadas",
                    bucket: "realizados" as CloserBucket,
                    fmt: (i: CloserEntry[]) => fmtNum(i.length),
                    cellClass: cellNum,
                  },
                  {
                    label: "Vendas",
                    bucket: "vendas" as CloserBucket,
                    fmt: (i: CloserEntry[]) => fmtNum(i.length),
                    cellClass: cellNum,
                  },
                  {
                    label: "Faturamento",
                    bucket: "vendas" as CloserBucket,
                    fmt: (i: CloserEntry[]) => fmtBRL(fat(i)),
                    cellClass: "text-right text-xs font-semibold",
                  },
                  {
                    label: "Ticket médio",
                    bucket: "vendas" as CloserBucket,
                    fmt: (i: CloserEntry[]) => i.length > 0 ? fmtBRL(fat(i) / i.length) : "—",
                    cellClass: "text-right text-xs",
                  },
                  {
                    label: "Taxa de conversão",
                    bucket: "vendas" as CloserBucket,
                    fmt: (vendas: CloserEntry[], realiz?: CloserEntry[]) => realiz && realiz.length > 0 ? fmtPct((vendas.length / realiz.length) * 100) : "—",
                    cellClass: "text-right text-xs",
                    needsRealiz: true as const,
                  },
                ];

                return (
                  <Card key={c.user.id} className="p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl shadow-black/20">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-500/15 text-emerald-300">
                          <Trophy className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-base font-semibold">{c.user.name}</div>
                          <div className="text-[11px] text-muted-foreground">Closer</div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          type="button" variant="outline" size="sm"
                          className="h-8 text-xs gap-1.5 bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/20"
                          onClick={() => openDrill(c.user.name, "propostasAbertas", "Total", totals.propostasAbertas)}
                        >
                          Propostas em aberto <Badge variant="outline" className="bg-amber-500/20 text-amber-200 border-amber-500/40 ml-1">{totals.propostasAbertas.length}</Badge>
                        </Button>
                        <Button
                          type="button" variant="outline" size="sm"
                          className="h-8 text-xs gap-1.5 bg-rose-500/10 border-rose-500/30 text-rose-200 hover:bg-rose-500/20"
                          onClick={() => openDrill(c.user.name, "propostasPerdidas", "Total", totals.propostasPerdidas)}
                        >
                          Propostas perdidas <Badge variant="outline" className="bg-rose-500/20 text-rose-200 border-rose-500/40 ml-1">{totals.propostasPerdidas.length}</Badge>
                        </Button>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48">Métrica</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right text-emerald-300">Lead A</TableHead>
                          <TableHead className="text-right text-amber-300">Lead B</TableHead>
                          <TableHead className="text-right text-blue-300">Lead C</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => {
                          const totalItems = totals[row.bucket];
                          const realizTotal = totals.realizados;
                          return (
                            <TableRow key={row.label}>
                              <TableCell className="text-xs text-muted-foreground">{row.label}</TableCell>
                              <TableCell
                                className={`${row.cellClass} ${colorMap.Total}`}
                                onClick={() => row.cellClass.includes("cursor-pointer") && openDrill(c.user.name, row.bucket, "Total", totalItems)}
                              >
                                {row.needsRealiz ? row.fmt(totalItems, realizTotal) : row.fmt(totalItems)}
                              </TableCell>
                              {classKeys.map((k) => {
                                const items = L[row.bucket][k];
                                const realizK = L.realizados[k];
                                return (
                                  <TableCell
                                    key={k}
                                    className={`${row.cellClass} ${colorMap[k]}`}
                                    onClick={() => row.cellClass.includes("cursor-pointer") && openDrill(c.user.name, row.bucket, k, items)}
                                  >
                                    {row.needsRealiz ? row.fmt(items, realizK) : row.fmt(items)}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                );
              });
            })()}

            {/* Configuração de pipelines → classe (admin) */}
            {isAdmin && (
              <Card className="p-4 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Settings className="h-4 w-4 text-primary" />
                  <div className="text-sm font-semibold">Configurar pipelines por classe (A/B/C)</div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Defina a classe de cada pipeline do GHL. Usada para segmentar as métricas dos closers.
                </p>
                {pipelinesList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">Atualize para carregar pipelines.</div>
                ) : (
                  <div className="space-y-1.5">
                    {pipelinesList.map((p) => {
                      const cur = pipelineCfg[p.id]?.classe || "";
                      const opts: { v: string | null; l: string; cls: string }[] = [
                        { v: null,    l: "Auto",  cls: "bg-muted/30 text-muted-foreground hover:bg-muted/50" },
                        { v: "A",     l: "A",     cls: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
                        { v: "B",     l: "B",     cls: "bg-amber-500/20 text-amber-200 border-amber-500/40" },
                        { v: "C",     l: "C",     cls: "bg-blue-500/20 text-blue-200 border-blue-500/40" },
                        { v: "Outro", l: "Outro", cls: "bg-muted/40 text-muted-foreground" },
                      ];
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
                          <div className="text-xs font-medium truncate flex-1">{p.name}</div>
                          <div className="flex gap-1">
                            {opts.map((o) => (
                              <Button
                                key={o.l}
                                variant="outline" size="sm"
                                onClick={() => setPipelineClasse(p, o.v)}
                                className={`h-6 px-2 text-[10px] border ${(cur || null) === o.v ? o.cls + " font-semibold ring-1 ring-primary/40" : "bg-background/30 border-white/10 text-muted-foreground hover:bg-white/5"}`}
                              >
                                {o.l}
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </TabsContent>

          {/* No-show por horário */}
          <TabsContent value="noshow">
            <Card className="p-4 bg-card/40 backdrop-blur border-border/30">
              {fase2 && (() => {
                const hours = Array.from(new Set([
                  ...Object.keys(fase2.agendadosByHour || {}),
                  ...Object.keys(fase2.noShowByHour || {}),
                ])).sort();
                if (hours.length === 0) return <div className="text-center py-12 text-muted-foreground text-sm">Sem reuniões no período.</div>;
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Horário</TableHead>
                        <TableHead className="text-right">Agendados</TableHead>
                        <TableHead className="text-right">Não compareceram</TableHead>
                        <TableHead className="text-right">% No-show</TableHead>
                        <TableHead>Distribuição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hours.map((hr) => {
                        const ag = fase2.agendadosByHour?.[hr] || 0;
                        const ns = fase2.noShowByHour?.[hr] || 0;
                        const pct = ag > 0 ? (ns / ag) * 100 : 0;
                        return (
                          <TableRow key={hr}>
                            <TableCell className="font-medium">{hr}</TableCell>
                            <TableCell className="text-right">{fmtNum(ag)}</TableCell>
                            <TableCell className="text-right text-rose-300">{fmtNum(ns)}</TableCell>
                            <TableCell className="text-right font-semibold">{fmtPct(pct)}</TableCell>
                            <TableCell>
                              <div className="h-3 bg-muted/30 rounded overflow-hidden">
                                <div className="h-full bg-rose-500/60" style={{ width: `${pct}%` }} />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </Card>
          </TabsContent>

          {/* Configurações de SDRs / Closers */}
          {isAdmin && (
            <TabsContent value="config" className="space-y-4">
              <Card className="p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-black/20">
                <div className="flex items-center gap-2 mb-1">
                  <UserCog className="h-4 w-4 text-primary" />
                  <div className="text-sm font-semibold">Funções da equipe comercial</div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Defina quem é <span className="text-cyan-300">SDR</span> (pré-vendas / agendamento) e quem é <span className="text-emerald-300">Closer</span> (fecha venda). Usuários sem função não entram nos rankings.
                </p>
                {ghlUsers.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted-foreground">
                    Nenhum usuário sincronizado ainda. Clique em <span className="text-foreground font-medium">Atualizar</span> para buscar do GoHighLevel.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead className="text-center w-[360px]">Função</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ghlUsers.map((u) => {
                        const current = userRoles[u.id]?.role || "none";
                        const opts: { v: UserRoleRow["role"]; l: string; cls: string }[] = [
                          { v: "none",   l: "—",      cls: "bg-muted/30 text-muted-foreground hover:bg-muted/50" },
                          { v: "sdr",    l: "SDR",    cls: "bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 border-cyan-500/40" },
                          { v: "closer", l: "Closer", cls: "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border-emerald-500/40" },
                          { v: "both",   l: "Ambos",  cls: "bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 border-violet-500/40" },
                        ];
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{u.email || "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1.5 justify-center flex-wrap">
                                {opts.map((o) => (
                                  <Button
                                    key={o.v}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setUserRole(u, o.v)}
                                    className={`h-7 px-3 text-[11px] border transition-all ${current === o.v ? o.cls + " ring-2 ring-offset-1 ring-offset-background ring-primary/40 font-semibold" : "bg-background/30 border-white/10 text-muted-foreground hover:bg-white/5"}`}
                                  >
                                    {o.l}
                                  </Button>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Card>
              <div className="text-[11px] text-muted-foreground/70 px-1">
                Resumo: <span className="text-cyan-300 font-semibold">{Object.values(userRoles).filter(r => r.role === "sdr" || r.role === "both").length}</span> SDRs ·{" "}
                <span className="text-emerald-300 font-semibold">{Object.values(userRoles).filter(r => r.role === "closer" || r.role === "both").length}</span> Closers
              </div>

              {/* ============ FONTES DE DADOS ============ */}
              <Card className="p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="h-4 w-4 text-cyan-300" />
                  <div className="text-sm font-semibold">Fontes de dados por métrica</div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Escolha de onde puxar cada número. Investimento é sempre Meta Ads · Taxa de Ativação é calculada (MQLs ÷ Leads).
                </p>
                {dataSources && (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Métrica</TableHead>
                          <TableHead className="text-center">Fonte</TableHead>
                          <TableHead className="text-right text-[10px] uppercase text-muted-foreground">via Planilha</TableHead>
                          <TableHead className="text-right text-[10px] uppercase text-muted-foreground">via GHL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {([
                          { key: "leads_source", label: "Leads totais", c: "leads" },
                          { key: "mqls_source", label: "MQLs", c: "mqls" },
                          { key: "comparecidas_source", label: "Comparecidas", c: null },
                          { key: "vendas_source", label: "Vendas", c: null },
                        ] as const).map((row) => {
                          const cur = dataSources[row.key];
                          return (
                            <TableRow key={row.key}>
                              <TableCell className="font-medium text-xs">{row.label}</TableCell>
                              <TableCell>
                                <div className="flex gap-1.5 justify-center">
                                  {(["sheet","ghl"] as const).map((opt) => (
                                    <Button key={opt} variant="outline" size="sm"
                                      onClick={() => updateDataSource({ [row.key]: opt })}
                                      className={`h-7 px-3 text-[11px] ${cur === opt ? "bg-primary/20 text-primary border-primary/40 ring-1 ring-primary/40 font-semibold" : "bg-background/30 border-white/10 text-muted-foreground"}`}>
                                      {opt === "sheet" ? "Planilha" : "GHL"}
                                    </Button>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {row.c && dsCounts?.sheet ? fmtNum(dsCounts.sheet[row.c] || 0) : "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {row.c && dsCounts?.ghl ? fmtNum(dsCounts.ghl[row.c] || 0) : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/5">
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Sheet ID</Label>
                        <Input value={dataSources.sheet_id || ""} onChange={(e) => setDataSources({ ...dataSources, sheet_id: e.target.value })} onBlur={() => updateDataSource({ sheet_id: dataSources.sheet_id })} className="h-8 text-xs bg-background/40 border-white/10" />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Aba</Label>
                        <Input value={dataSources.sheet_tab || ""} onChange={(e) => setDataSources({ ...dataSources, sheet_tab: e.target.value })} onBlur={() => updateDataSource({ sheet_tab: dataSources.sheet_tab })} className="h-8 text-xs bg-background/40 border-white/10" />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Coluna MQL</Label>
                        <Input value={dataSources.sheet_mql_column || ""} onChange={(e) => setDataSources({ ...dataSources, sheet_mql_column: e.target.value })} onBlur={() => updateDataSource({ sheet_mql_column: dataSources.sheet_mql_column })} className="h-8 text-xs bg-background/40 border-white/10" />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Valor = MQL</Label>
                        <Input value={dataSources.sheet_mql_value || ""} onChange={(e) => setDataSources({ ...dataSources, sheet_mql_value: e.target.value })} onBlur={() => updateDataSource({ sheet_mql_value: dataSources.sheet_mql_value })} className="h-8 text-xs bg-background/40 border-white/10" />
                      </div>
                    </div>
                    {dsCounts?.sheetError && <div className="mt-2 text-[11px] text-rose-300">Erro na planilha: {dsCounts.sheetError}</div>}
                  </>
                )}
              </Card>

              {/* ============ MAPEAMENTO DE STAGES POR PIPELINE ============ */}
              <Card className="p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Settings className="h-4 w-4 text-primary" />
                  <div className="text-sm font-semibold">Mapeamento de etapas (stages) por pipeline</div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Para cada pipeline do GHL, marque quais etapas representam Reunião marcada, Comparecida, Proposta enviada, Proposta perdida, Vendida e No-show. Isso é o que define "proposta perdida" no painel dos Closers.
                </p>
                {pipelinesList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">Clique em Atualizar para carregar os pipelines.</div>
                ) : (
                  <div className="space-y-4">
                    {pipelinesList.map((p) => {
                      const cfg = pipelineCfg[p.id] || {};
                      const stages = p.stages || [];
                      if (!stages.length) return null;
                      const metrics: { key: "stages_reuniao_marcada"|"stages_comparecida"|"stages_proposta_enviada"|"stages_proposta_perdida"|"stages_vendida"|"stages_noshow"; label: string; color: string }[] = [
                        { key: "stages_reuniao_marcada", label: "Reunião marcada", color: "bg-blue-500/20 text-blue-200 border-blue-500/40" },
                        { key: "stages_comparecida", label: "Comparecida", color: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40" },
                        { key: "stages_proposta_enviada", label: "Proposta enviada", color: "bg-amber-500/20 text-amber-200 border-amber-500/40" },
                        { key: "stages_proposta_perdida", label: "Proposta perdida", color: "bg-rose-500/20 text-rose-200 border-rose-500/40" },
                        { key: "stages_vendida", label: "Vendida", color: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
                        { key: "stages_noshow", label: "No-show", color: "bg-zinc-500/20 text-zinc-200 border-zinc-500/40" },
                      ];
                      return (
                        <div key={p.id} className="rounded-xl border border-white/5 bg-background/20 p-3 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="text-sm font-semibold">{p.name}</div>
                            <div className="text-[10px] text-muted-foreground">{stages.length} stages</div>
                          </div>
                          {metrics.map((m) => {
                            const sel: string[] = cfg[m.key] || [];
                            return (
                              <div key={m.key} className="space-y-1">
                                <div className="flex items-baseline justify-between">
                                  <Badge variant="outline" className={`${m.color} text-[10px]`}>{m.label}</Badge>
                                  <span className="text-[10px] text-muted-foreground">{sel.length} marc.</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {stages.map((s) => {
                                    const on = sel.includes(s.id);
                                    return (
                                      <button key={s.id} type="button" onClick={() => toggleStageMapping(p, m.key, s.id)}
                                        className={`text-[10px] px-2 py-0.5 rounded border transition ${on ? m.color + " font-semibold" : "bg-background/40 border-white/10 text-muted-foreground hover:text-foreground"}`}>
                                        {s.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>
          )}

          </Tabs>

          <p className="text-xs text-muted-foreground/60 text-center pt-4">
            Investimento via Meta Ads (act_507006368954918, Token de Will). Reuniões/MQLs/Vendas via GoHighLevel.
          </p>
        </div>
      </div>

      {/* Drill-down: leads do SDR por categoria */}
      <Dialog open={!!drillDown} onOpenChange={(o) => !o && setDrillDown(null)}>
        <DialogContent className="max-w-3xl bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="capitalize">{drillDown?.tipo === "noshow" ? "No-show" : drillDown?.tipo + "s"}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-primary">{drillDown?.sdrName}</span>
              <Badge variant="outline" className="ml-2">{drillDown?.items.length || 0}</Badge>
            </DialogTitle>
          </DialogHeader>
          {drillDown && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 -mt-1">
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-blue-300/80">Agendados</div>
                <div className="text-base font-bold text-blue-200">{fmtNum(drillDown.agendados)}</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">Realizados</div>
                <div className="text-base font-bold text-emerald-200">{fmtNum(drillDown.realizados)}</div>
              </div>
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-rose-300/80">No-show</div>
                <div className="text-base font-bold text-rose-200">{fmtNum(drillDown.noshow)}</div>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-primary/80">Taxa ativação</div>
                <div className="text-base font-bold text-primary">{drillDown.agendados > 0 ? fmtPct((drillDown.realizados / drillDown.agendados) * 100) : "—"}</div>
              </div>
            </div>
          )}
          {drillDown && (() => {
            const groups: { key: ApptCategory; label: string; cls: string }[] = [
              { key: "MQL",   label: "MQLs",     cls: "border-cyan-500/40 text-cyan-200 bg-cyan-500/10" },
              { key: "A",     label: "Lead A",   cls: "border-emerald-500/40 text-emerald-200 bg-emerald-500/10" },
              { key: "B",     label: "Lead B",   cls: "border-amber-500/40 text-amber-200 bg-amber-500/10" },
              { key: "C",     label: "Lead C",   cls: "border-blue-500/40 text-blue-200 bg-blue-500/10" },
              { key: "Outro", label: "Outros",   cls: "border-muted text-muted-foreground bg-muted/20" },
            ];
            const grouped: Record<ApptCategory, ApptEntry[]> = { MQL: [], A: [], B: [], C: [], Outro: [] };
            for (const it of drillDown.items) grouped[it.category].push(it);
            const visible = groups.filter(g => grouped[g.key].length > 0);
            if (visible.length === 0) return <div className="text-center text-sm text-muted-foreground py-8">Sem registros.</div>;
            return (
              <Tabs defaultValue={visible[0].key} className="mt-2">
                <TabsList className="bg-background/40 border border-white/5 inline-flex gap-1 h-auto p-1 flex-wrap">
                  {visible.map((g) => (
                    <TabsTrigger key={g.key} value={g.key} className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      {g.label} <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${g.cls}`}>{grouped[g.key].length}</Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
                {visible.map((g) => (
                  <TabsContent key={g.key} value={g.key} className="mt-3 max-h-[55vh] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead>Horário</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grouped[g.key].map((it, i) => (
                          <TableRow key={(it.contactId || "") + i}>
                            <TableCell className="font-medium">{it.nome}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {it.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{it.phone}</div>}
                              {it.email && <div>{it.email}</div>}
                              {!it.phone && !it.email && "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {it.startTime ? new Date(it.startTime).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                ))}
              </Tabs>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Lista de MQLs / não-MQLs */}
      <Dialog open={!!mqlListOpen} onOpenChange={(o) => !o && setMqlListOpen(null)}>
        <DialogContent className="max-w-4xl bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mqlListOpen === "mql" ? "Lista de MQLs" : "Leads (não-MQL)"}
              <Badge variant="outline" className="ml-2">
                {fase2 ? (mqlListOpen === "mql" ? fase2.mqlsList.length : fase2.nonMqlsList.length) : 0}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {fase2 && (() => {
            const rows = (mqlListOpen === "mql" ? fase2.mqlsList : fase2.nonMqlsList).slice(0, 300);
            if (rows.length === 0) return <div className="text-center py-8 text-sm text-muted-foreground">Nenhum lead no período.</div>;
            return (
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Reunião</TableHead>
                      <TableHead>SDR</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</div>}
                          {m.email && <div>{m.email}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{m.dateAdded ? new Date(m.dateAdded).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell className="text-xs">
                          {m.horario ? new Date(m.horario).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-cyan-300">{m.sdrName || "—"}</TableCell>
                        <TableCell>{situacaoBadge(m.situacao)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Lista filtrada (clique nos cards de MQL) */}
      <Dialog open={!!mqlFilterOpen} onOpenChange={(o) => !o && setMqlFilterOpen(null)}>
        <DialogContent className="max-w-4xl bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mqlFilterOpen?.title}
              <Badge variant="outline" className="ml-2">{mqlFilterOpen?.rows.length || 0}</Badge>
            </DialogTitle>
          </DialogHeader>
          {mqlFilterOpen && mqlFilterOpen.rows.length > 0 ? (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Reunião</TableHead>
                    <TableHead>SDR</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mqlFilterOpen.rows.slice(0, 500).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</div>}
                        {m.email && <div>{m.email}</div>}
                      </TableCell>
                      <TableCell className="text-xs">{m.dateAdded ? new Date(m.dateAdded).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-xs">
                        {m.horario ? new Date(m.horario).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-cyan-300">{m.sdrName || "—"}</TableCell>
                      <TableCell>{situacaoBadge(m.situacao)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">Sem registros.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drill-down: closer */}
      <Dialog open={!!closerDrill} onOpenChange={(o) => !o && setCloserDrill(null)}>
        <DialogContent className="max-w-3xl bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span className="text-primary">{closerDrill?.closerName}</span>
              <span className="text-muted-foreground">·</span>
              <span>
                {closerDrill?.bucket === "realizados" && "Reuniões realizadas"}
                {closerDrill?.bucket === "vendas" && "Vendas"}
                {closerDrill?.bucket === "propostasAbertas" && "Propostas em aberto"}
                {closerDrill?.bucket === "propostasPerdidas" && "Propostas perdidas"}
              </span>
              {closerDrill?.classe !== "Total" && (
                <Badge variant="outline" className="ml-1">Lead {closerDrill?.classe}</Badge>
              )}
              <Badge variant="outline" className="ml-1">{closerDrill?.items.length || 0}</Badge>
            </DialogTitle>
          </DialogHeader>
          {closerDrill && closerDrill.items.length > 0 ? (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    {(closerDrill.bucket === "vendas" || closerDrill.bucket.includes("propostas")) && <TableHead className="text-right">Valor</TableHead>}
                    {closerDrill.bucket === "realizados" && <TableHead>Horário</TableHead>}
                    {closerDrill.bucket.includes("propostas") && <TableHead>Pipeline</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closerDrill.items.map((it, i) => (
                    <TableRow key={(it.contactId || it.oppId || "") + i}>
                      <TableCell className="font-medium">{it.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {it.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{it.phone}</div>}
                        {it.email && <div>{it.email}</div>}
                        {!it.phone && !it.email && "—"}
                      </TableCell>
                      {(closerDrill.bucket === "vendas" || closerDrill.bucket.includes("propostas")) && (
                        <TableCell className="text-right text-xs">{fmtBRL(it.valor || 0)}</TableCell>
                      )}
                      {closerDrill.bucket === "realizados" && (
                        <TableCell className="text-xs">
                          {it.startTime ? new Date(it.startTime).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                        </TableCell>
                      )}
                      {closerDrill.bucket.includes("propostas") && (
                        <TableCell className="text-xs text-muted-foreground">{it.pipeline || "—"}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">Sem registros.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* MQLs sem agendamento */}
      <Dialog open={semAgendOpen} onOpenChange={setSemAgendOpen}>
        <DialogContent className="max-w-3xl bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" /> MQLs sem agendamento
              <Badge variant="outline" className="ml-2">{fase3?.followUps.mqlsSemAgendamento.length || 0}</Badge>
            </DialogTitle>
          </DialogHeader>
          {fase3 && fase3.followUps.mqlsSemAgendamento.length > 0 ? (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead className="text-right">Dias parado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fase3.followUps.mqlsSemAgendamento.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.phone || r.email || "—"}</TableCell>
                      <TableCell className="text-xs">{new Date(r.dateAdded).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-rose-500/20 text-rose-300 border-rose-500/30">{r.diasParado}d</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">Tudo em dia.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
