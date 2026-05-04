import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, ArrowLeft, Settings, Users, TrendingDown,
  Activity, AlertTriangle, BarChart3, CheckCircle2, XCircle, Play,
} from "lucide-react";
import { toast } from "sonner";
import { SquadDaily } from "@/components/squad/SquadDaily";

type Squad = { id: string; name: string; color: string | null; description: string | null };
type SquadClient = {
  id: string;
  squad_id: string;
  name: string;
  niche: string | null;
  services: string | null;
  entry_date: string | null;
  due_date: string | null;
  renewal_60d: boolean | null;
  curve_abc: string | null;
  sprint: string | null;
  prioritization: string | null;
  priority_score: number;
  bm_verified: boolean | null;
  invested_tp: string | null;
  observations: string | null;
};
type Metric = {
  id: string; squad_id: string; reference_month: string;
  active_clients: number | null; out_of_target: number | null; churn_count: number | null;
  new_clients: number | null; renewals: number | null; churn_reason: string | null;
  monthly_clients: number | null; calls_delivered_pct: number | null;
  upsell_amount: string | null; lifetime: string | null; observations: string | null;
};
type Churn = {
  id: string; squad_id: string; client_name: string;
  entry_month: string | null; churn_month: string | null;
  reason: string | null; months_active: string | null; observations: string | null;
};

const emptyClient: Partial<SquadClient> = {
  name: "", niche: "", services: "", curve_abc: "", sprint: "",
  invested_tp: "", observations: "", renewal_60d: false, bm_verified: false,
};

const PRIORITY_COLORS: Record<string, string> = {
  AA: "bg-red-500/20 text-red-300 border-red-500/40",
  AB: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  AC: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  BA: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  BB: "bg-lime-500/20 text-lime-300 border-lime-500/40",
  BC: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  CA: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  CB: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  CC: "bg-blue-500/20 text-blue-300 border-blue-500/40",
};

const CURVE_COLORS: Record<string, string> = {
  A: "bg-primary/20 text-primary border-primary/40",
  B: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
  C: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

export default function Squad() {
  const { isAdmin } = useAuth();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadId, setSquadId] = useState<string>("");
  const [clients, setClients] = useState<SquadClient[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [churns, setChurns] = useState<Churn[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<SquadClient> | null>(null);
  const [open, setOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Partial<Metric> | null>(null);
  const [openMetric, setOpenMetric] = useState(false);
  const [editingChurn, setEditingChurn] = useState<Partial<Churn> | null>(null);
  const [openChurn, setOpenChurn] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);

  useEffect(() => { void loadSquads(); }, []);
  useEffect(() => { if (squadId) void loadAll(squadId); }, [squadId]);

  async function loadSquads() {
    setLoading(true);
    const { data } = await supabase.from("squads").select("*").order("name");
    setSquads(data || []);
    if (data && data.length && !squadId) setSquadId(data[0].id);
    setLoading(false);
  }

  async function loadAll(sid: string) {
    const [c, m, ch] = await Promise.all([
      supabase.from("squad_clients").select("*").eq("squad_id", sid)
        .order("priority_score").order("name"),
      supabase.from("squad_monthly_metrics").select("*").eq("squad_id", sid)
        .order("reference_month", { ascending: false }),
      supabase.from("squad_churn").select("*").eq("squad_id", sid)
        .order("churn_month", { ascending: false }),
    ]);
    setClients((c.data as SquadClient[]) || []);
    setMetrics((m.data as Metric[]) || []);
    setChurns((ch.data as Churn[]) || []);
  }

  // ---------- CLIENTS ----------
  function openNew() { setEditing({ ...emptyClient, squad_id: squadId }); setOpen(true); }
  function openEdit(c: SquadClient) { setEditing({ ...c }); setOpen(true); }

  async function save() {
    if (!editing?.name?.trim()) return toast.error("Nome é obrigatório");
    const payload = {
      squad_id: squadId,
      name: editing.name.trim(),
      niche: editing.niche || null,
      services: editing.services || null,
      entry_date: editing.entry_date || null,
      due_date: editing.due_date || null,
      renewal_60d: !!editing.renewal_60d,
      curve_abc: editing.curve_abc?.toUpperCase() || null,
      sprint: editing.sprint?.toUpperCase() || null,
      bm_verified: !!editing.bm_verified,
      invested_tp: editing.invested_tp || null,
      observations: editing.observations || null,
    };
    const res = editing.id
      ? await supabase.from("squad_clients").update(payload).eq("id", editing.id)
      : await supabase.from("squad_clients").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo — priorização recalculada");
    setOpen(false);
    void loadAll(squadId);
  }

  async function remove(id: string) {
    if (!confirm("Remover este cliente do squad?")) return;
    const { error } = await supabase.from("squad_clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    void loadAll(squadId);
  }

  // ---------- METRICS ----------
  async function saveMetric() {
    if (!editingMetric?.reference_month) return toast.error("Mês obrigatório");
    const payload: any = {
      squad_id: squadId,
      reference_month: editingMetric.reference_month,
      active_clients: editingMetric.active_clients ?? null,
      out_of_target: editingMetric.out_of_target ?? null,
      churn_count: editingMetric.churn_count ?? null,
      new_clients: editingMetric.new_clients ?? null,
      renewals: editingMetric.renewals ?? null,
      churn_reason: editingMetric.churn_reason || null,
      monthly_clients: editingMetric.monthly_clients ?? null,
      calls_delivered_pct: editingMetric.calls_delivered_pct ?? null,
      upsell_amount: editingMetric.upsell_amount || null,
      lifetime: editingMetric.lifetime || null,
      observations: editingMetric.observations || null,
    };
    const res = editingMetric.id
      ? await supabase.from("squad_monthly_metrics").update(payload).eq("id", editingMetric.id)
      : await supabase.from("squad_monthly_metrics").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Métrica salva");
    setOpenMetric(false);
    void loadAll(squadId);
  }

  async function removeMetric(id: string) {
    if (!confirm("Remover esta métrica?")) return;
    const { error } = await supabase.from("squad_monthly_metrics").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void loadAll(squadId);
  }

  // ---------- CHURN ----------
  async function saveChurn() {
    if (!editingChurn?.client_name?.trim()) return toast.error("Cliente obrigatório");
    const payload: any = {
      squad_id: squadId,
      client_name: editingChurn.client_name.trim(),
      entry_month: editingChurn.entry_month || null,
      churn_month: editingChurn.churn_month || null,
      reason: editingChurn.reason || null,
      months_active: editingChurn.months_active || null,
      observations: editingChurn.observations || null,
    };
    const res = editingChurn.id
      ? await supabase.from("squad_churn").update(payload).eq("id", editingChurn.id)
      : await supabase.from("squad_churn").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Churn salvo");
    setOpenChurn(false);
    void loadAll(squadId);
  }

  async function removeChurn(id: string) {
    if (!confirm("Remover este registro de churn?")) return;
    const { error } = await supabase.from("squad_churn").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void loadAll(squadId);
  }

  const currentSquad = squads.find((s) => s.id === squadId);

  // Priority matrix (3x3)
  const matrix = useMemo(() => {
    const grid: Record<string, SquadClient[]> = {};
    for (const c of clients) {
      const key = c.prioritization && /^[ABC][ABC]$/.test(c.prioritization) ? c.prioritization : "—";
      (grid[key] ||= []).push(c);
    }
    return grid;
  }, [clients]);

  const stats = useMemo(() => ({
    total: clients.length,
    aa: clients.filter((c) => c.prioritization === "AA").length,
    bm: clients.filter((c) => c.bm_verified).length,
    renew: clients.filter((c) => c.renewal_60d).length,
  }), [clients]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/30 px-4 sm:px-8 h-16 flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/"><Button size="icon" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Users className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">Dash do Squad</h1>
              {currentSquad && (
                <p className="text-xs text-muted-foreground">{currentSquad.description || currentSquad.name}</p>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <Link to="/squad/admin">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="h-4 w-4" /> Gerenciar squads
            </Button>
          </Link>
        )}
      </header>

      <main className="px-4 sm:px-8 py-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={squadId} onValueChange={setSquadId}>
            <SelectTrigger className="w-72 bg-card/40 backdrop-blur-sm">
              <SelectValue placeholder="Selecione um squad" />
            </SelectTrigger>
            <SelectContent>
              {squads.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color || "#8B5CF6" }} />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          {squadId && clients.length > 0 && (
            <Button
              onClick={() => setDailyOpen(true)}
              className="gap-1.5 bg-gradient-to-r from-primary to-fuchsia-600 hover:opacity-90 shadow-lg shadow-primary/30"
            >
              <Play className="h-4 w-4" /> Começar Daily
            </Button>
          )}
        </div>

        <SquadDaily
          open={dailyOpen}
          onClose={() => setDailyOpen(false)}
          squadId={squadId}
          clients={clients}
        />

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : squads.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/40 rounded-xl">
            <p className="text-muted-foreground">Nenhum squad disponível.</p>
            {isAdmin && <Link to="/squad/admin"><Button className="mt-4">Criar squad</Button></Link>}
          </div>
        ) : (
          <Tabs defaultValue="clients" className="space-y-6">
            <TabsList className="bg-card/40 backdrop-blur-sm border border-border/30">
              <TabsTrigger value="clients" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Clientes</TabsTrigger>
              <TabsTrigger value="matrix" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Matriz</TabsTrigger>
              <TabsTrigger value="metrics" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Métricas dos Projetos</TabsTrigger>
              <TabsTrigger value="churn" className="gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Churn</TabsTrigger>
            </TabsList>

            {/* CLIENTES */}
            <TabsContent value="clients" className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total" value={stats.total} icon={Users} color="from-emerald-500 to-teal-600" />
                <StatCard label="Prioridade AA" value={stats.aa} icon={AlertTriangle} color="from-red-500 to-orange-600" />
                <StatCard label="BM Verificada" value={stats.bm} icon={CheckCircle2} color="from-green-500 to-emerald-600" />
                <StatCard label="Renovação 60d" value={stats.renew} icon={Activity} color="from-primary to-fuchsia-600" />
              </div>

              <div className="flex justify-end">
                <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> Novo cliente</Button>
              </div>

              <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-x-auto shadow-xl">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/30">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Nicho</TableHead>
                      <TableHead>Serviços</TableHead>
                      <TableHead className="text-center">ABC</TableHead>
                      <TableHead className="text-center">Sprint</TableHead>
                      <TableHead className="text-center">Prioriz.</TableHead>
                      <TableHead className="text-center">BM</TableHead>
                      <TableHead>Investido TP</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">Nenhum cliente neste squad.</TableCell></TableRow>
                    ) : clients.map((c, i) => (
                      <TableRow key={c.id} className="border-border/20">
                        <TableCell className="text-muted-foreground text-xs font-mono">{i + 1}</TableCell>
                        <TableCell className="font-semibold">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.niche}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.services}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={CURVE_COLORS[c.curve_abc || ""] || "border-border/40 text-muted-foreground"}>
                            {c.curve_abc || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={CURVE_COLORS[c.sprint || ""] || "border-border/40 text-muted-foreground"}>
                            {c.sprint || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`font-bold ${PRIORITY_COLORS[c.prioritization || ""] || "border-border/40 text-muted-foreground"}`}>
                            {c.prioritization || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {c.bm_verified
                            ? <Badge className="bg-green-500/20 text-green-300 border-green-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Sim</Badge>
                            : <Badge className="bg-red-500/20 text-red-300 border-red-500/30 gap-1"><XCircle className="h-3 w-3" /> Não</Badge>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.invested_tp}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* MATRIZ */}
            <TabsContent value="matrix">
              <Card className="bg-card/40 backdrop-blur-sm border-border/30 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" /> Matriz de Priorização
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Atualizada automaticamente a partir da Curva ABC e Sprint de cada cliente.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2">
                    <div />
                    {["A", "B", "C"].map((s) => (
                      <div key={s} className="text-center text-xs font-semibold text-muted-foreground pb-2">
                        Sprint {s}
                      </div>
                    ))}
                    {(["A", "B", "C"] as const).map((curve) => (
                      <Fragment key={`row-${curve}`}>
                        <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground pr-2">
                          ABC {curve}
                        </div>
                        {(["A", "B", "C"] as const).map((sprint) => {
                          const key = `${curve}${sprint}`;
                          const list = matrix[key] || [];
                          return (
                            <div key={key} className={`rounded-xl border p-3 min-h-[120px] ${PRIORITY_COLORS[key]} bg-opacity-10`}>
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className={`font-bold ${PRIORITY_COLORS[key]}`}>{key}</Badge>
                                <span className="text-xs text-muted-foreground">{list.length}</span>
                              </div>
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {list.map((c) => (
                                  <div key={c.id} className="text-xs truncate text-foreground/90" title={c.name}>
                                    • {c.name}
                                  </div>
                                ))}
                                {list.length === 0 && <div className="text-xs text-muted-foreground/50 italic">vazio</div>}
                              </div>
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* MÉTRICAS */}
            <TabsContent value="metrics" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => { setEditingMetric({ reference_month: `${new Date().toISOString().slice(0, 7)}-01` }); setOpenMetric(true); }} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Nova métrica mensal
                </Button>
              </div>
              <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-x-auto shadow-xl">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/30">
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-center">Ativos</TableHead>
                      <TableHead className="text-center">Fora meta</TableHead>
                      <TableHead className="text-center">Churn</TableHead>
                      <TableHead className="text-center">Entradas</TableHead>
                      <TableHead className="text-center">Renov.</TableHead>
                      <TableHead className="text-center">Mensais</TableHead>
                      <TableHead className="text-center">% Calls</TableHead>
                      <TableHead>Upsell</TableHead>
                      <TableHead>LT</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.length === 0 ? (
                      <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-12">Nenhuma métrica registrada.</TableCell></TableRow>
                    ) : metrics.map((m) => (
                      <TableRow key={m.id} className="border-border/20">
                        <TableCell className="font-semibold">{formatMonth(m.reference_month)}</TableCell>
                        <TableCell className="text-center">{m.active_clients ?? "-"}</TableCell>
                        <TableCell className="text-center">{m.out_of_target ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          {m.churn_count != null && m.churn_count > 0
                            ? <Badge className="bg-red-500/20 text-red-300 border-red-500/30">{m.churn_count}</Badge>
                            : (m.churn_count ?? "-")}
                        </TableCell>
                        <TableCell className="text-center">
                          {m.new_clients != null && m.new_clients > 0
                            ? <Badge className="bg-green-500/20 text-green-300 border-green-500/30">+{m.new_clients}</Badge>
                            : (m.new_clients ?? "-")}
                        </TableCell>
                        <TableCell className="text-center">{m.renewals ?? "-"}</TableCell>
                        <TableCell className="text-center">{m.monthly_clients ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          {m.calls_delivered_pct != null ? `${(Number(m.calls_delivered_pct) * 100).toFixed(0)}%` : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{m.upsell_amount}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{m.lifetime}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => { setEditingMetric(m); setOpenMetric(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => removeMetric(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* CHURN */}
            <TabsContent value="churn" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => { setEditingChurn({}); setOpenChurn(true); }} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Novo churn
                </Button>
              </div>
              <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-x-auto shadow-xl">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/30">
                      <TableHead>Cliente</TableHead>
                      <TableHead>Mês entrada</TableHead>
                      <TableHead>Mês churn</TableHead>
                      <TableHead>Meses vigentes</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {churns.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Nenhum churn registrado.</TableCell></TableRow>
                    ) : churns.map((c) => (
                      <TableRow key={c.id} className="border-border/20">
                        <TableCell className="font-semibold">{c.client_name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatMonth(c.entry_month)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatMonth(c.churn_month)}</TableCell>
                        <TableCell><Badge variant="outline">{c.months_active || "-"}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.reason}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => { setEditingChurn(c); setOpenChurn(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => removeChurn(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Client dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Cliente *</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Nicho</Label><Input value={editing.niche || ""} onChange={(e) => setEditing({ ...editing, niche: e.target.value })} /></div>
              <div><Label>Serviços</Label><Input placeholder="TP, CRM, COM" value={editing.services || ""} onChange={(e) => setEditing({ ...editing, services: e.target.value })} /></div>
              <div><Label>Data entrada</Label><Input type="date" value={editing.entry_date || ""} onChange={(e) => setEditing({ ...editing, entry_date: e.target.value })} /></div>
              <div><Label>Data vencimento</Label><Input type="date" value={editing.due_date || ""} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} /></div>
              <div>
                <Label>Curva ABC</Label>
                <Select value={editing.curve_abc || ""} onValueChange={(v) => setEditing({ ...editing, curve_abc: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{["A", "B", "C"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sprint</Label>
                <Select value={editing.sprint || ""} onValueChange={(v) => setEditing({ ...editing, sprint: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{["A", "B", "C"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Valor investido TP</Label><Input value={editing.invested_tp || ""} onChange={(e) => setEditing({ ...editing, invested_tp: e.target.value })} /></div>
              <div className="flex items-center gap-2 mt-6">
                <input id="bm" type="checkbox" checked={!!editing.bm_verified} onChange={(e) => setEditing({ ...editing, bm_verified: e.target.checked })} />
                <Label htmlFor="bm">BM Verificada</Label>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input id="ren" type="checkbox" checked={!!editing.renewal_60d} onChange={(e) => setEditing({ ...editing, renewal_60d: e.target.checked })} />
                <Label htmlFor="ren">Renovação 60d</Label>
              </div>
              <div className="col-span-2"><Label>Observações</Label><Textarea rows={3} value={editing.observations || ""} onChange={(e) => setEditing({ ...editing, observations: e.target.value })} /></div>
              {editing.curve_abc && editing.sprint && (
                <div className="col-span-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-2.5">
                  Priorização será definida automaticamente como{" "}
                  <Badge variant="outline" className={`font-bold ${PRIORITY_COLORS[(editing.curve_abc + editing.sprint).toUpperCase()] || ""}`}>
                    {(editing.curve_abc + editing.sprint).toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Metric dialog */}
      <Dialog open={openMetric} onOpenChange={setOpenMetric}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingMetric?.id ? "Editar métrica" : "Nova métrica mensal"}</DialogTitle></DialogHeader>
          {editingMetric && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Mês de referência *</Label><Input type="month" value={editingMetric.reference_month?.slice(0, 7) || ""} onChange={(e) => setEditingMetric({ ...editingMetric, reference_month: e.target.value ? `${e.target.value}-01` : "" })} /></div>
              <div><Label>Clientes ativos</Label><Input type="number" value={editingMetric.active_clients ?? ""} onChange={(e) => setEditingMetric({ ...editingMetric, active_clients: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Fora da meta</Label><Input type="number" value={editingMetric.out_of_target ?? ""} onChange={(e) => setEditingMetric({ ...editingMetric, out_of_target: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Churn</Label><Input type="number" value={editingMetric.churn_count ?? ""} onChange={(e) => setEditingMetric({ ...editingMetric, churn_count: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Entradas</Label><Input type="number" value={editingMetric.new_clients ?? ""} onChange={(e) => setEditingMetric({ ...editingMetric, new_clients: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Renovações</Label><Input type="number" value={editingMetric.renewals ?? ""} onChange={(e) => setEditingMetric({ ...editingMetric, renewals: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Clientes nas mensais</Label><Input type="number" value={editingMetric.monthly_clients ?? ""} onChange={(e) => setEditingMetric({ ...editingMetric, monthly_clients: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>% Calls entregues (0-1)</Label><Input type="number" step="0.01" value={editingMetric.calls_delivered_pct ?? ""} onChange={(e) => setEditingMetric({ ...editingMetric, calls_delivered_pct: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Upsell</Label><Input value={editingMetric.upsell_amount || ""} onChange={(e) => setEditingMetric({ ...editingMetric, upsell_amount: e.target.value })} /></div>
              <div><Label>Tempo de LT</Label><Input value={editingMetric.lifetime || ""} onChange={(e) => setEditingMetric({ ...editingMetric, lifetime: e.target.value })} /></div>
              <div className="col-span-2"><Label>Motivo de churn</Label><Input value={editingMetric.churn_reason || ""} onChange={(e) => setEditingMetric({ ...editingMetric, churn_reason: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={editingMetric.observations || ""} onChange={(e) => setEditingMetric({ ...editingMetric, observations: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenMetric(false)}>Cancelar</Button>
            <Button onClick={saveMetric}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Churn dialog */}
      <Dialog open={openChurn} onOpenChange={setOpenChurn}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingChurn?.id ? "Editar churn" : "Novo churn"}</DialogTitle></DialogHeader>
          {editingChurn && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Cliente *</Label><Input value={editingChurn.client_name || ""} onChange={(e) => setEditingChurn({ ...editingChurn, client_name: e.target.value })} /></div>
              <div><Label>Mês de entrada</Label><Input type="date" value={editingChurn.entry_month?.slice(0, 10) || ""} onChange={(e) => setEditingChurn({ ...editingChurn, entry_month: e.target.value })} /></div>
              <div><Label>Mês do churn</Label><Input type="date" value={editingChurn.churn_month?.slice(0, 10) || ""} onChange={(e) => setEditingChurn({ ...editingChurn, churn_month: e.target.value })} /></div>
              <div><Label>Meses vigentes</Label><Input placeholder="ex: 4 MESES" value={editingChurn.months_active || ""} onChange={(e) => setEditingChurn({ ...editingChurn, months_active: e.target.value })} /></div>
              <div><Label>Motivo</Label><Input value={editingChurn.reason || ""} onChange={(e) => setEditingChurn({ ...editingChurn, reason: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={editingChurn.observations || ""} onChange={(e) => setEditingChurn({ ...editingChurn, observations: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenChurn(false)}>Cancelar</Button>
            <Button onClick={saveChurn}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-4 shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
    </div>
  );
}

function formatMonth(d: string | null | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}
