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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, ArrowLeft, Settings, Users, TrendingDown,
  Activity, AlertTriangle, BarChart3, CheckCircle2, XCircle, Play, FileText,
  Smile, CalendarDays, Star, AlertCircle, NotebookPen, ClipboardList,
  Target, DollarSign, ShoppingCart, Gauge, MessageSquare, Search, Store, TrendingUp,
  ChevronDown, ChevronRight, FolderOpen, Folder,
} from "lucide-react";
import { toast } from "sonner";
import { SquadDaily } from "@/components/squad/SquadDaily";
import { SquadDailyReport } from "@/components/squad/SquadDailyReport";
import { SquadNotesReport } from "@/components/squad/SquadNotesReport";
import { MonthlyMeetingDialog } from "@/components/squad/MonthlyMeetingDialog";
import { SquadConsolidated } from "@/components/squad/SquadConsolidated";
import { ActionVerificationDialog } from "@/components/ActionVerificationDialog";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, Cell,
} from "recharts";

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
  contract_value: number | null;
  sales_goal: number | null;
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
  contract_value: number | null;
};
type Nps = {
  id: string; squad_id: string; period: string;
  total_clients: number | null; responses: number | null;
  detractors: number | null; neutrals: number | null; promoters: number | null;
  nps_score: number | null; avg_engagement: number | null; observations: string | null;
};
type Engagement = {
  id: string; squad_id: string; reference_month: string;
  client_name: string; contact: string | null;
  curve_abc: string | null; sprint: string | null;
  engagement_score: number | null; nps_individual: number | null; observation: string | null;
  meta_status: string | null;
  meta_vendas: number | null; meta_vendas_trafego: number | null; meta_vendas_loja: number | null; meta_faturamento: number | null;
  vendas: number | null; vendas_trafego: number | null; vendas_loja: number | null;
  vendas_por_canais: string | null; vendas_perc_canais: string | null;
  faturamento: number | null; faturamento_por_canais: string | null; faturamento_perc_canais: string | null;
};
type Agenda = {
  id: string; squad_id: string; reference_month: string;
  category: string | null; client_name: string; responsible: string | null;
  meeting_date: string | null; meeting_time: string | null; done: boolean;
  observations: string | null; not_done_reason: string | null;
};

const emptyClient: Partial<SquadClient> = {
  name: "", niche: "", services: "", curve_abc: "", sprint: "",
  invested_tp: "", contract_value: null, sales_goal: null, observations: "", renewal_60d: false, bm_verified: false,
};

// Calcula totais, porcentagens e faturamento por canal a partir das vendas de cada canal
function computeChannels(trafego: number | null | undefined, loja: number | null | undefined, faturamento: number | null | undefined) {
  const t = Number(trafego) || 0;
  const l = Number(loja) || 0;
  const total = t + l;
  const fat = Number(faturamento) || 0;
  const fmtMoney = (v: number) =>
    "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (total <= 0) {
    return {
      vendasTotal: total,
      vendasPorCanais: "",
      vendasPerc: "",
      fatTrafego: 0,
      fatLoja: 0,
      fatPorCanais: "",
      fatPerc: "",
    };
  }
  const pTraf = (t / total) * 100;
  const pLoja = (l / total) * 100;
  const fatTraf = fat * (t / total);
  const fatLoja = fat * (l / total);
  const pf = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return {
    vendasTotal: total,
    vendasPorCanais: `Tráfego ${t}, Loja ${l}`,
    vendasPerc: `Tráfego ${pf(pTraf)}%, Loja ${pf(pLoja)}%`,
    fatTrafego: fatTraf,
    fatLoja: fatLoja,
    fatPorCanais: `Tráfego ${fmtMoney(fatTraf)}, Loja ${fmtMoney(fatLoja)}`,
    fatPerc: `Tráfego ${pf(pTraf)}%, Loja ${pf(pLoja)}%`,
  };
}

// Formata valores monetários em BRL (uso geral)
const fmtBRL = (v: number | null | undefined) =>
  "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Estatísticas de NPS a partir de uma lista de engajamentos (nps_individual)
function buildNpsStats(list: Engagement[]) {
  const scores = list.map((e) => e.nps_individual).filter((v): v is number => v != null);
  const total = scores.length;
  const buckets = Array.from({ length: 11 }, (_, i) => ({ score: i, count: 0 }));
  scores.forEach((s) => { if (s >= 0 && s <= 10) buckets[Math.round(s)].count++; });
  const above8 = scores.filter((s) => s > 8).length;
  const tens = scores.filter((s) => s === 10).length;
  const below7 = scores.filter((s) => s < 7).length;
  const middle = total - above8 - below7;
  const npsScore = total > 0 ? Math.round(((above8 - below7) / total) * 100) : 0;
  const avg = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;
  return {
    total, buckets,
    pctAbove8: total > 0 ? Math.round((above8 / total) * 100) : 0,
    pctTen: total > 0 ? Math.round((tens / total) * 100) : 0,
    pctBelow7: total > 0 ? Math.round((below7 / total) * 100) : 0,
    above8, tens, below7, middle, npsScore, avg,
  };
}

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

const SERVICE_OPTIONS = [
  { code: "TP", label: "Tráfego Pago" },
  { code: "CRM", label: "CRM" },
  { code: "COM", label: "Acomp. Comercial" },
] as const;

const SERVICE_COLORS: Record<string, string> = {
  TP: "bg-primary/20 text-primary border-primary/40",
  CRM: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
  COM: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

function parseServices(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;/|]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SERVICE_OPTIONS.some((o) => o.code === s));
}

function parseMoney(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s || s === "-") return null;
  const m = s.match(/([\d.,]+)\s*(K|MIL)?/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (isNaN(n)) return null;
  if (m[2]) n *= 1000;
  return n;
}

function formatBRL(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── NPS accordion: mês → sprint → clientes ──────────────────────────────────
type ComputeChannelsFn = (
  trafego: number | null | undefined,
  loja: number | null | undefined,
  faturamento: number | null | undefined
) => {
  vendasTotal: number;
  vendasPorCanais: string;
  vendasPerc: string;
  fatTrafego: number;
  fatLoja: number;
  fatPorCanais: string;
  fatPerc: string;
};

type NpsAccordionProps = {
  sortedMonths: string[];
  byMonthMap: Map<string, Engagement[]>;
  sprintOrder: string[];
  formatMonth: (s: string) => string;
  CURVE_COLORS: Record<string, string>;
  computeChannels: ComputeChannelsFn;
  fmtBRL: (v: number | null | undefined) => string;
};

function NpsClientRow({ e, CURVE_COLORS, computeChannels, fmtBRL }: {
  e: Engagement;
  CURVE_COLORS: Record<string, string>;
  computeChannels: ComputeChannelsFn;
  fmtBRL: NpsAccordionProps["fmtBRL"];
}) {
  const [open, setOpen] = useState(false);
  const ch = computeChannels(e.vendas_trafego, e.vendas_loja, e.faturamento);
  const nps = e.nps_individual;
  const npsTone = nps == null ? "text-muted-foreground" : nps > 8 ? "text-emerald-400" : nps < 7 ? "text-red-400" : "text-amber-400";
  const engStars = e.engagement_score ?? null;

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 overflow-hidden">
      {/* Row header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        }
        <span className="flex-1 text-sm font-medium leading-tight truncate">{e.client_name}</span>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-[10px] ${CURVE_COLORS[e.curve_abc || ""] || "border-border/40 text-muted-foreground"}`}>{e.curve_abc || "-"}</Badge>
          <span className={`text-sm font-bold w-7 text-right ${npsTone}`}>{nps != null ? nps : "—"}</span>
          <span className="inline-flex gap-0.5">
            {engStars != null ? Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-3 w-3 ${i < engStars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"}`} />
            )) : <span className="text-[10px] text-muted-foreground">—</span>}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border/20 px-3 pb-3 pt-2.5 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            {/* Vendas */}
            <div className="rounded-md border border-border/30 bg-background/30 p-2 space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Vendas</p>
              <p className="font-bold text-foreground">{ch.vendasTotal || 0}</p>
              <div className="text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span className="flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5 text-sky-400" />Tráfego</span><span>{Number(e.vendas_trafego) || 0}</span></div>
                <div className="flex justify-between"><span className="flex items-center gap-1"><Store className="h-2.5 w-2.5 text-fuchsia-400" />Loja</span><span>{Number(e.vendas_loja) || 0}</span></div>
              </div>
            </div>
            {/* Faturamento */}
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-emerald-300/80 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Faturamento</p>
              <p className="font-bold text-emerald-300">{fmtBRL(e.faturamento)}</p>
              <div className="text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span className="flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5 text-sky-400" />Tráfego</span><span>{fmtBRL(ch.fatTrafego)}</span></div>
                <div className="flex justify-between"><span className="flex items-center gap-1"><Store className="h-2.5 w-2.5 text-fuchsia-400" />Loja</span><span>{fmtBRL(ch.fatLoja)}</span></div>
              </div>
            </div>
          </div>
          {e.meta_status && (
            <Badge variant="outline" className={e.meta_status.toLowerCase().includes("dentro") ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40" : "bg-red-500/10 text-red-300 border-red-500/40"}>
              <Target className="h-3 w-3 mr-1" />{e.meta_status}
            </Badge>
          )}
          {e.observation && (
            <p className="text-muted-foreground border-t border-border/20 pt-2 leading-relaxed">{e.observation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function NpsMonthAccordion({ sortedMonths, byMonthMap, sprintOrder, formatMonth, CURVE_COLORS, computeChannels, fmtBRL }: NpsAccordionProps) {
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set(sortedMonths.slice(0, 1)));

  const toggleMonth = (m: string) => setOpenMonths((prev) => {
    const next = new Set(prev);
    next.has(m) ? next.delete(m) : next.add(m);
    return next;
  });

  return (
    <div className="space-y-2">
      {sortedMonths.map((mk) => {
        const list = byMonthMap.get(mk)!;
        const isOpen = openMonths.has(mk);
        const label = mk === "sem-mes" ? "Sem mês" : formatMonth(`${mk}-01`);

        // Estatísticas rápidas do mês
        const scores = list.map((e) => e.nps_individual).filter((v): v is number => v != null);
        const avg = scores.length ? (scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(1) : null;

        // Agrupa por sprint
        const groups = new Map<string, Engagement[]>();
        list.forEach((e) => {
          const s = (e.sprint || "").toUpperCase() || "—";
          if (!groups.has(s)) groups.set(s, []);
          groups.get(s)!.push(e);
        });
        const orderedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
          const ia = sprintOrder.indexOf(a); const ib = sprintOrder.indexOf(b);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });

        return (
          <div key={mk} className="rounded-xl border border-border/30 overflow-hidden">
            {/* Cabeçalho do mês */}
            <button
              type="button"
              onClick={() => toggleMonth(mk)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-card/60 hover:bg-card/80 transition-colors text-left"
            >
              {isOpen
                ? <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                : <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
              }
              <span className="flex-1 font-semibold capitalize text-sm">{label}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{list.length} cliente{list.length !== 1 ? "s" : ""}</span>
                {avg && <Badge variant="outline" className="text-[10px] border-border/40">NPS {avg}</Badge>}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              </div>
            </button>

            {/* Conteúdo expandido */}
            {isOpen && (
              <div className="px-3 pb-3 pt-2 space-y-3 bg-background/20">
                {orderedGroups.map(([sprint, slist]) => (
                  <div key={sprint}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className={`text-[10px] ${CURVE_COLORS[sprint] || "border-border/40 text-muted-foreground"}`}>
                        Sprint {sprint}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{slist.length} cliente{slist.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="space-y-1.5">
                      {slist.map((e) => (
                        <NpsClientRow key={e.id} e={e} CURVE_COLORS={CURVE_COLORS} computeChannels={computeChannels} fmtBRL={fmtBRL} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

export default function Squad() {
  const { isAdmin } = useAuth();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadId, setSquadId] = useState<string>("");
  const [clients, setClients] = useState<SquadClient[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [churns, setChurns] = useState<Churn[]>([]);
  const [nps, setNps] = useState<Nps[]>([]);
  const [engagement, setEngagement] = useState<Engagement[]>([]);
  const [agenda, setAgenda] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<SquadClient> | null>(null);
  const [open, setOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Partial<Metric> | null>(null);
  const [openMetric, setOpenMetric] = useState(false);
  const [editingChurn, setEditingChurn] = useState<Partial<Churn> | null>(null);
  const [openChurn, setOpenChurn] = useState(false);
  const [pendingClientDelete, setPendingClientDelete] = useState<string | null>(null);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<SquadClient | null>(null);
  const [editingNps, setEditingNps] = useState<Partial<Nps> | null>(null);
  const [openNps, setOpenNps] = useState(false);
  const [editingEng, setEditingEng] = useState<Partial<Engagement> | null>(null);
  const [openEng, setOpenEng] = useState(false);
  const [engMonth, setEngMonth] = useState<string>("all");
  const [npsMonth, setNpsMonth] = useState<string>("all");
  const [npsListDialog, setNpsListDialog] = useState<"responded" | "missed" | null>(null);
  const [npsSearch, setNpsSearch] = useState("");
  const [engShowTrash, setEngShowTrash] = useState(false);
  const [engTrash, setEngTrash] = useState<Engagement[]>([]);
  const [purgeMonth, setPurgeMonth] = useState<string | null>(null); // YYYY-MM-DD
  const [editingAg, setEditingAg] = useState<Partial<Agenda> | null>(null);
  const [openAg, setOpenAg] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [consolidatedOpen, setConsolidatedOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [clientSearch, setClientSearch] = useState("");
  const [sortKey, setSortKey] = useState<"none" | "name" | "prioritization" | "invested" | "meta">("none");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [reportOpen, setReportOpen] = useState(false);
  const [notesReportOpen, setNotesReportOpen] = useState(false);
  const [resumeSession, setResumeSession] = useState<{ id: string; started_at: string } | null>(null);
  const [newMonthOpen, setNewMonthOpen] = useState(false);
  const [newMonthValue, setNewMonthValue] = useState<string>(() => new Date().toISOString().slice(0, 7));

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
    const [c, m, ch, n, e, a, et] = await Promise.all([
      supabase.from("squad_clients").select("*").eq("squad_id", sid)
        .order("priority_score").order("name"),
      supabase.from("squad_monthly_metrics").select("*").eq("squad_id", sid)
        .order("reference_month", { ascending: false }),
      supabase.from("squad_churn").select("*").eq("squad_id", sid)
        .order("churn_month", { ascending: false }),
      (supabase as any).from("squad_nps").select("*").eq("squad_id", sid)
        .order("period", { ascending: false }),
      (supabase as any).from("squad_engagement").select("*").eq("squad_id", sid)
        .is("deleted_at", null)
        .order("reference_month", { ascending: false }).order("client_name"),
      (supabase as any).from("squad_agenda").select("*").eq("squad_id", sid)
        .order("meeting_date", { ascending: true }),
      (supabase as any).from("squad_engagement").select("*").eq("squad_id", sid)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ]);
    setClients((c.data as unknown as SquadClient[]) || []);
    setMetrics((m.data as Metric[]) || []);
    setChurns((ch.data as Churn[]) || []);
    setNps((n.data as Nps[]) || []);
    setEngagement((e.data as Engagement[]) || []);
    setEngTrash((et?.data as Engagement[]) || []);
    setAgenda((a.data as Agenda[]) || []);
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
      contract_value: editing.contract_value ?? null,
      observations: editing.observations || null,
    };
    let clientId = editing.id;
    if (editing.id) {
      const res = await supabase.from("squad_clients").update(payload).eq("id", editing.id);
      if (res.error) return toast.error(res.error.message);
    } else {
      const res = await supabase.from("squad_clients").insert(payload).select("id").single();
      if (res.error) return toast.error(res.error.message);
      clientId = (res.data as any)?.id;
    }
    // Meta de venda — coluna opcional; se a migração ainda não rodou, avisa sem quebrar o save
    if (clientId) {
      const metaRes = await (supabase as any)
        .from("squad_clients")
        .update({ sales_goal: editing.sales_goal ?? null })
        .eq("id", clientId);
      if (metaRes.error && /sales_goal/.test(metaRes.error.message || "")) {
        toast("Cliente salvo. A Meta de Venda precisa da migração (peça ao Lovable).");
      }
    }
    toast.success("Salvo — priorização recalculada");
    setOpen(false);
    void loadAll(squadId);
  }

  function remove(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setConfirmDeleteClient(c);
  }

  function performClientDelete() {
    const c = confirmDeleteClient;
    if (!c) return;
    setConfirmDeleteClient(null);

    const entryYM = c.entry_date ? c.entry_date.slice(0, 7) : "";
    const todayYM = new Date().toISOString().slice(0, 7);
    const entryMonth = entryYM ? `${entryYM}-01` : null;
    const churnMonth = `${todayYM}-01`;

    setPendingClientDelete(c.id);
    setEditingChurn({
      client_name: c.name,
      entry_month: entryMonth,
      churn_month: churnMonth,
      reason: "",
      observations: "",
      contract_value: c.contract_value ?? null,
    });
    setOpenChurn(true);
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
    const months = monthsBetween(editingChurn.entry_month, editingChurn.churn_month);
    const payload: any = {
      squad_id: squadId,
      client_name: editingChurn.client_name.trim(),
      entry_month: editingChurn.entry_month || null,
      churn_month: editingChurn.churn_month || null,
      reason: editingChurn.reason || null,
      months_active: months != null ? `${months} ${months === 1 ? "MÊS" : "MESES"}` : null,
      observations: editingChurn.observations || null,
      contract_value: editingChurn.contract_value ?? null,
    };
    const res = editingChurn.id
      ? await supabase.from("squad_churn").update(payload).eq("id", editingChurn.id)
      : await supabase.from("squad_churn").insert(payload);
    if (res.error) return toast.error(res.error.message);

    if (pendingClientDelete) {
      const { error: delErr } = await supabase.from("squad_clients").delete().eq("id", pendingClientDelete);
      if (delErr) toast.error(`Churn salvo, mas falhou ao remover cliente: ${delErr.message}`);
      setPendingClientDelete(null);
    }

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

  // ---------- NPS ----------
  async function saveNps() {
    if (!editingNps?.period) return toast.error("Período obrigatório");
    const det = Number(editingNps.detractors || 0);
    const neu = Number(editingNps.neutrals || 0);
    const pro = Number(editingNps.promoters || 0);
    const resp = det + neu + pro;
    const score = resp > 0 ? ((pro - det) / resp) * 100 : null;
    const payload: any = {
      squad_id: squadId,
      period: editingNps.period,
      total_clients: editingNps.total_clients ?? null,
      responses: resp || (editingNps.responses ?? null),
      detractors: det, neutrals: neu, promoters: pro,
      nps_score: score,
      avg_engagement: editingNps.avg_engagement ?? null,
      observations: editingNps.observations || null,
    };
    const res = editingNps.id
      ? await (supabase as any).from("squad_nps").update(payload).eq("id", editingNps.id)
      : await (supabase as any).from("squad_nps").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("NPS salvo");
    setOpenNps(false);
    void loadAll(squadId);
  }
  async function removeNps(id: string) {
    if (!confirm("Remover este NPS?")) return;
    await (supabase as any).from("squad_nps").delete().eq("id", id);
    void loadAll(squadId);
  }

  // ---------- ENGAGEMENT ----------
  async function saveEng() {
    if (!editingEng?.client_name?.trim()) return toast.error("Cliente obrigatório");
    if (!editingEng?.reference_month) return toast.error("Mês obrigatório");
    const curve = editingEng.curve_abc?.toUpperCase() || null;
    const sprint = editingEng.sprint?.toUpperCase() || null;
    const ch = computeChannels(editingEng.vendas_trafego, editingEng.vendas_loja, editingEng.faturamento);
    const payload: any = {
      squad_id: squadId,
      reference_month: editingEng.reference_month,
      client_name: editingEng.client_name.trim(),
      contact: editingEng.contact || null,
      curve_abc: curve,
      sprint: sprint,
      engagement_score: editingEng.engagement_score ?? null,
      nps_individual: editingEng.nps_individual ?? null,
      observation: editingEng.observation || null,
      meta_status: editingEng.meta_status || null,
      vendas_trafego: editingEng.vendas_trafego ?? null,
      vendas_loja: editingEng.vendas_loja ?? null,
      vendas: ch.vendasTotal || null,
      vendas_por_canais: ch.vendasPorCanais || null,
      vendas_perc_canais: ch.vendasPerc || null,
      faturamento: editingEng.faturamento ?? null,
      faturamento_por_canais: ch.fatPorCanais || null,
      faturamento_perc_canais: ch.fatPerc || null,
    };
    const res = editingEng.id
      ? await (supabase as any).from("squad_engagement").update(payload).eq("id", editingEng.id)
      : await (supabase as any).from("squad_engagement").insert(payload).select("id").single();
    if (res.error) return toast.error(res.error.message);
    // Metas de venda (colunas opcionais) — save resiliente: se a migração não rodou, avisa sem quebrar
    const engSavedId = editingEng.id || (res.data as any)?.id;
    const metaTraf = editingEng.meta_vendas_trafego;
    const metaLoja = editingEng.meta_vendas_loja;
    const metaTotal = (metaTraf != null || metaLoja != null) ? (Number(metaTraf) || 0) + (Number(metaLoja) || 0) : null;
    const hasMeta = metaTraf != null || metaLoja != null || editingEng.meta_faturamento != null;
    if (engSavedId && hasMeta) {
      const metaRes = await (supabase as any).from("squad_engagement").update({
        meta_vendas: metaTotal,
        meta_vendas_trafego: metaTraf ?? null,
        meta_vendas_loja: metaLoja ?? null,
        meta_faturamento: editingEng.meta_faturamento ?? null,
      }).eq("id", engSavedId);
      if (metaRes.error && /meta_(vendas|faturamento)/.test(metaRes.error.message || "")) {
        toast("Salvo. As metas (por canal/faturamento) precisam da migração (peça ao Lovable).");
      }
    }

    // Sync ABC/Sprint back to squad_clients (single source of truth per client)
    const matchClient = clients.find((c) => c.name.trim().toLowerCase() === payload.client_name.toLowerCase());
    if (matchClient && (curve || sprint)) {
      const updates: any = {};
      if (curve && curve !== matchClient.curve_abc) updates.curve_abc = curve;
      if (sprint && sprint !== matchClient.sprint) updates.sprint = sprint;
      if (Object.keys(updates).length) {
        await supabase.from("squad_clients").update(updates).eq("id", matchClient.id);
      }
    }

    toast.success("Engajamento salvo");
    setOpenEng(false);
    void loadAll(squadId);
  }
  async function removeEng(id: string) {
    if (!confirm("Mover este registro para a lixeira?")) return;
    await (supabase as any).from("squad_engagement")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
    void loadAll(squadId);
  }
  async function restoreEng(id: string) {
    await (supabase as any).from("squad_engagement")
      .update({ deleted_at: null }).eq("id", id);
    toast.success("Restaurado");
    void loadAll(squadId);
  }
  async function createMonthFromClients(month: string) {
    // month = "YYYY-MM"
    const ref = `${month}-01`;
    if (!clients.length) return toast.error("Cadastre clientes primeiro");
    // Skip clients already in the month
    const { data: existing } = await (supabase as any).from("squad_engagement")
      .select("client_name").eq("squad_id", squadId).eq("reference_month", ref).is("deleted_at", null);
    const have = new Set((existing || []).map((r: any) => String(r.client_name).trim().toLowerCase()));
    const rows = clients
      .filter((c) => !have.has(c.name.trim().toLowerCase()))
      .map((c) => ({
        squad_id: squadId,
        reference_month: ref,
        client_name: c.name,
        curve_abc: c.curve_abc || null,
        sprint: c.sprint || null,
        engagement_score: null,
        nps_individual: null,
        observation: null,
      }));
    if (!rows.length) {
      toast.info("Todos os clientes já têm registro neste mês");
    } else {
      const { error } = await (supabase as any).from("squad_engagement").insert(rows);
      if (error) return toast.error(error.message);
      toast.success(`${rows.length} cliente(s) carregado(s) em ${month}`);
    }
    setNewMonthOpen(false);
    setEngMonth(month);
    void loadAll(squadId);
  }
  async function trashMonth(month: string) {
    // month = "YYYY-MM"
    const ref = `${month}-01`;
    if (!confirm(`Mover TODOS os registros de ${month} para a lixeira?`)) return;
    const { error } = await (supabase as any).from("squad_engagement")
      .update({ deleted_at: new Date().toISOString() })
      .eq("squad_id", squadId).eq("reference_month", ref).is("deleted_at", null);
    if (error) return toast.error(error.message);
    toast.success("Mês movido para a lixeira");
    void loadAll(squadId);
  }
  async function restoreMonth(month: string) {
    const ref = `${month}-01`;
    await (supabase as any).from("squad_engagement")
      .update({ deleted_at: null })
      .eq("squad_id", squadId).eq("reference_month", ref).not("deleted_at", "is", null);
    toast.success("Mês restaurado");
    void loadAll(squadId);
  }

  // ---------- AGENDA ----------
  async function saveAg() {
    if (!editingAg?.client_name?.trim()) return toast.error("Cliente obrigatório");
    if (!editingAg?.reference_month) return toast.error("Mês obrigatório");
    const payload: any = {
      squad_id: squadId,
      reference_month: editingAg.reference_month,
      category: editingAg.category || null,
      client_name: editingAg.client_name.trim(),
      responsible: editingAg.responsible || null,
      meeting_date: editingAg.meeting_date || null,
      meeting_time: editingAg.meeting_time || null,
      done: !!editingAg.done,
      not_done_reason: editingAg.not_done_reason || null,
      observations: editingAg.observations || null,
    };
    const res = editingAg.id
      ? await (supabase as any).from("squad_agenda").update(payload).eq("id", editingAg.id)
      : await (supabase as any).from("squad_agenda").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Agenda salva");
    setOpenAg(false);
    void loadAll(squadId);
  }
  async function removeAg(id: string) {
    if (!confirm("Remover este compromisso?")) return;
    await (supabase as any).from("squad_agenda").delete().eq("id", id);
    void loadAll(squadId);
  }
  async function toggleAgDone(a: Agenda) {
    await (supabase as any).from("squad_agenda").update({ done: !a.done }).eq("id", a.id);
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

  // Filtro de prioridade + busca + ordenação na aba de Clientes
  const visibleClients = useMemo(() => {
    let list = priorityFilter === "all" ? clients : clients.filter((c) => c.prioritization === priorityFilter);
    const q = clientSearch.trim().toLowerCase();
    if (q) list = list.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.niche || "").toLowerCase().includes(q));
    if (sortKey !== "none") {
      const dir = sortDir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        if (sortKey === "name") {
          return (a.name || "").localeCompare(b.name || "") * dir;
        }
        if (sortKey === "prioritization") return (a.priority_score - b.priority_score) * dir;
        if (sortKey === "invested") return ((parseMoney(a.invested_tp) || 0) - (parseMoney(b.invested_tp) || 0)) * dir;
        if (sortKey === "meta") return ((Number(a.sales_goal) || 0) - (Number(b.sales_goal) || 0)) * dir;
        return 0;
      });
    }
    return list;
  }, [clients, priorityFilter, clientSearch, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sortArrow = (key: typeof sortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");


  // NPS ativos + média de engajamento — mês selecionável pelo usuário
  const engMonths = useMemo(() => {
    const set = new Set(engagement.map((e) => (e.reference_month || "").slice(0, 7)).filter(Boolean));
    return Array.from(set).sort((a, b) => b.localeCompare(a)); // mais recente primeiro
  }, [engagement]);
  const [highlightMonth, setHighlightMonth] = useState<string>("");
  useEffect(() => {
    if (engMonths.length && !engMonths.includes(highlightMonth)) {
      setHighlightMonth(engMonths[0]);
    }
  }, [engMonths, highlightMonth]);
  const engHighlights = useMemo(() => {
    const rows = engagement.filter((e) => (e.reference_month || "").slice(0, 7) === highlightMonth);
    const npsCount = rows.filter((e) => e.nps_individual != null).length;
    const scores = rows.map((e) => e.engagement_score).filter((v): v is number => v != null);
    const avgEng = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    return { latest: highlightMonth, npsCount, avgEng };
  }, [engagement, highlightMonth]);
  // Resumo financeiro do squad
  const financeSummary = useMemo(() => {
    const investido = clients.reduce((s, c) => s + (parseMoney(c.invested_tp) || 0), 0);
    const contratos = clients.reduce((s, c) => s + (Number(c.contract_value) || 0), 0);
    const meta = clients.reduce((s, c) => s + (Number(c.sales_goal) || 0), 0);
    const rows = engagement.filter((e) => (e.reference_month || "").slice(0, 7) === highlightMonth);
    const faturamento = rows.reduce((s, e) => s + (Number(e.faturamento) || 0), 0);
    return { investido, contratos, meta, faturamento };
  }, [clients, engagement, highlightMonth]);

  // Cohort do NPS (base D+30): no mês selecionado, quem é elegível, quem respondeu, % resposta e nota média.
  const npsCohort = useMemo(() => {
    if (npsMonth === "all") return null;
    const M = npsMonth;
    const ymf = (d: string | null | undefined) => (d || "").slice(0, 7);
    const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
    const clientsWithEntry = clients.filter((c) => !!c.entry_date).length;
    // Elegíveis = ativos que entraram antes do mês analisado (≥30 dias)
    const eligible = clients.filter((c) => c.entry_date && ymf(c.entry_date) < M);
    const monthRows = engagement.filter((e) => ymf(e.reference_month) === M && e.nps_individual != null);
    const npsByName = new Map<string, number>();
    monthRows.forEach((e) => npsByName.set(norm(e.client_name), e.nps_individual as number));
    const responded = eligible.filter((c) => npsByName.has(norm(c.name)));
    const missed = eligible.filter((c) => !npsByName.has(norm(c.name)));
    const notes = responded.map((c) => npsByName.get(norm(c.name))!).filter((n) => n != null);
    const avgNps = notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : 0;
    const responseRate = eligible.length ? (responded.length / eligible.length) * 100 : 0;
    // Ativos totais do mês = entraram até o mês analisado (elegíveis + novos do mês)
    const totalActive = clients.filter((c) => c.entry_date && ymf(c.entry_date) <= M);
    return {
      M, eligible, responded, missed, avgNps, responseRate, npsByName,
      totalAtivos: totalActive.length, novosNoMes: totalActive.length - eligible.length,
      missingEntry: clientsWithEntry === 0,
    };
  }, [npsMonth, clients, engagement]);

  // Cohort das Métricas dos Projetos (base D+30) no mês selecionado (highlightMonth)
  const metricsCohort = useMemo(() => {
    const M = highlightMonth;
    if (!M) return null;
    const ymf = (d: string | null | undefined) => (d || "").slice(0, 7);
    const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
    const clientsWithEntry = clients.filter((c) => !!c.entry_date).length;
    const eligible = clients.filter((c) => c.entry_date && ymf(c.entry_date) < M);
    const rowByName = new Map<string, Engagement>();
    engagement.filter((e) => ymf(e.reference_month) === M).forEach((e) => rowByName.set(norm(e.client_name), e));
    const eligRows = eligible.map((c) => rowByName.get(norm(c.name))).filter(Boolean) as Engagement[];
    const engScores = eligRows.map((r) => r.engagement_score).filter((v): v is number => v != null);
    const avgEng = engScores.length ? engScores.reduce((s, v) => s + v, 0) / engScores.length : 0;
    const vendido = eligRows.reduce((s, r) => s + (Number(r.faturamento) || 0), 0);
    const withSecondary = eligRows.filter((r) => (Number(r.vendas_loja) || 0) > 0).length;
    const secondaryPct = eligible.length ? (withSecondary / eligible.length) * 100 : 0;
    return { M, eligibleCount: eligible.length, evaluated: engScores.length, avgEng, vendido, secondaryPct, withSecondary, missingEntry: clientsWithEntry === 0 };
  }, [highlightMonth, clients, engagement]);

  // Evolução mensal do squad (engajamento, NPS médio e faturamento)
  const squadMonthly = useMemo(() => {
    const byMonth = new Map<string, { eng: number[]; nps: number[]; fat: number }>();
    engagement.forEach((e) => {
      const k = (e.reference_month || "").slice(0, 7);
      if (!k) return;
      if (!byMonth.has(k)) byMonth.set(k, { eng: [], nps: [], fat: 0 });
      const m = byMonth.get(k)!;
      if (e.engagement_score != null) m.eng.push(e.engagement_score);
      if (e.nps_individual != null) m.nps.push(e.nps_individual);
      m.fat += Number(e.faturamento) || 0;
    });
    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, m]) => ({
        mes: formatMonth(`${k}-01`),
        engajamento: Number(avg(m.eng).toFixed(1)),
        notaNps: Number(avg(m.nps).toFixed(1)),
        faturamento: Math.round(m.fat),
      }));
  }, [engagement]);

  // Tendência: mês selecionado vs mês anterior (engMonths está do mais recente p/ o mais antigo)
  const engTrend = useMemo(() => {
    const idx = engMonths.indexOf(highlightMonth);
    const prevMonth = idx >= 0 && idx < engMonths.length - 1 ? engMonths[idx + 1] : null;
    if (!prevMonth) return null;
    const calc = (month: string) => {
      const rows = engagement.filter((e) => (e.reference_month || "").slice(0, 7) === month);
      const nps = rows.filter((e) => e.nps_individual != null).length;
      const scores = rows.map((e) => e.engagement_score).filter((v): v is number => v != null);
      const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
      return { nps, avg };
    };
    const cur = calc(highlightMonth);
    const prev = calc(prevMonth);
    return {
      npsDelta: cur.nps - prev.nps,
      avgDelta: Number((cur.avg - prev.avg).toFixed(1)),
    };
  }, [engagement, engMonths, highlightMonth]);

  const serviceCounts = useMemo(() => {
    const counts = { TP: 0, CRM: 0, COM: 0 };
    for (const c of clients) {
      for (const s of parseServices(c.services)) {
        if (s in counts) counts[s as keyof typeof counts]++;
      }
    }
    return counts;
  }, [clients]);

  // Funil: clientes com 1, 2, 3 serviços + nomes/serviços por bucket
  const serviceFunnel = useMemo(() => {
    const buckets: Record<1 | 2 | 3, { clients: { name: string; services: string[] }[] }> = {
      1: { clients: [] }, 2: { clients: [] }, 3: { clients: [] },
    };
    let withAny = 0;
    for (const c of clients) {
      const svcs = parseServices(c.services);
      const n = svcs.length;
      if (n >= 1) withAny++;
      const k = (n === 1 ? 1 : n === 2 ? 2 : n >= 3 ? 3 : 0) as 0 | 1 | 2 | 3;
      if (k) buckets[k].clients.push({ name: c.name || "(sem nome)", services: svcs });
    }
    const base = withAny || 1;
    return ([1, 2, 3] as const).map((k) => {
      const list = buckets[k].clients;
      const svcCounts = { TP: 0, CRM: 0, COM: 0 } as Record<string, number>;
      list.forEach((c) => c.services.forEach((s) => { svcCounts[s] = (svcCounts[s] || 0) + 1; }));
      return {
        bucket: k,
        label: `${k} serviço${k > 1 ? "s" : ""}`,
        count: list.length,
        pct: Math.round((list.length / base) * 100),
        clients: list,
        svcCounts,
      };
    });
  }, [clients]);

  // NPS distribuição a partir do engajamento (nps_individual)
  // Categorias (regra do squad): acima de 8, igual a 10, abaixo de 7
  const npsMonthly = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    engagement.forEach((e) => {
      if (e.nps_individual == null || !e.reference_month) return;
      const k = e.reference_month.slice(0, 7);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(e.nps_individual);
    });
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, arr]) => {
        const t = arr.length;
        const ab8 = arr.filter((s) => s > 8).length;
        const bl7 = arr.filter((s) => s < 7).length;
        return {
          mes: formatMonth(`${k}-01`),
          mediaNota: Number((arr.reduce((s, n) => s + n, 0) / t).toFixed(1)),
          pctAcima8: Math.round((ab8 / t) * 100),
          nps: Math.round(((ab8 - bl7) / t) * 100),
        };
      });
  }, [engagement]);

  const incompleteClients = useMemo(() => {
    return clients
      .map((c) => {
        const missing: string[] = [];
        if (!c.name?.trim()) missing.push("nome");
        if (parseMoney(c.invested_tp) == null) missing.push("valor TP");
        if (parseServices(c.services).length === 0) missing.push("serviços");
        if (!c.curve_abc) missing.push("Curva ABC");
        if (!c.sprint) missing.push("Sprint");
        return { client: c, missing };
      })
      .filter((x) => x.missing.length > 0);
  }, [clients]);

  // Engajamento mais recente por cliente (nome) → saúde + painel de detalhes
  const engByClient = useMemo(() => {
    const map = new Map<string, Engagement>();
    [...engagement]
      .sort((a, b) => (a.reference_month || "").localeCompare(b.reference_month || ""))
      .forEach((e) => {
        const k = (e.client_name || "").trim().toLowerCase();
        if (k) map.set(k, e); // o mais recente prevalece
      });
    return map;
  }, [engagement]);

  // Saúde do cliente: combina sinais de risco (verde/amarelo/vermelho)
  const healthOf = (c: SquadClient): "green" | "yellow" | "red" => {
    let issues = 0;
    if (!c.bm_verified) issues++;
    if (c.due_date) {
      const days = (new Date(c.due_date + "T12:00:00Z").getTime() - Date.now()) / 86400000;
      if (days >= 0 && days <= 30 && !c.renewal_60d) issues++;
    }
    const eng = engByClient.get((c.name || "").trim().toLowerCase());
    if (eng?.engagement_score != null && eng.engagement_score < 3) issues++;
    if (eng?.nps_individual != null && eng.nps_individual <= 6) issues++;
    return issues >= 2 ? "red" : issues === 1 ? "yellow" : "green";
  };

  // Contratos vencendo em até 30 dias (sem renovação marcada)
  const upcomingDue = useMemo(() => {
    return clients
      .map((c) => {
        if (!c.due_date) return null;
        const days = Math.round((new Date(c.due_date + "T12:00:00Z").getTime() - Date.now()) / 86400000);
        if (days < 0 || days > 30) return null;
        return { client: c, days };
      })
      .filter((x): x is { client: SquadClient; days: number } => x != null)
      .sort((a, b) => a.days - b.days);
  }, [clients]);

  const [detailClient, setDetailClient] = useState<SquadClient | null>(null);

  const [showIncomplete, setShowIncomplete] = useState(false);


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
          {squadId && (
            <Button
              variant="outline"
              onClick={() => setReportOpen(true)}
              className="gap-1.5"
            >
              <FileText className="h-4 w-4" /> Relatório das Dailys
            </Button>
          )}
          {squadId && (
            <Button
              variant="outline"
              onClick={() => setNotesReportOpen(true)}
              className="gap-1.5"
            >
              <NotebookPen className="h-4 w-4" /> Relatório de Anotações
            </Button>
          )}
          {squadId && clients.length > 0 && (
            <Button
              onClick={() => setConsolidatedOpen(true)}
              className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 shadow-lg shadow-emerald-500/30"
            >
              <ClipboardList className="h-4 w-4" /> Começar Consolidado
            </Button>
          )}
          {squadId && clients.length > 0 && (
            <Button
              onClick={() => setDailyOpen(true)}
              className="gap-1.5 bg-gradient-to-r from-primary to-fuchsia-600 hover:opacity-90 shadow-lg shadow-primary/30"
            >
              <Play className="h-4 w-4" /> Começar Daily
            </Button>
          )}
        </div>

        <SquadConsolidated
          open={consolidatedOpen}
          onClose={() => setConsolidatedOpen(false)}
          squadId={squadId}
          clients={clients}
        />

        <SquadDaily
          open={dailyOpen}
          onClose={() => { setDailyOpen(false); setResumeSession(null); }}
          squadId={squadId}
          clients={clients}
          resumeSession={resumeSession}
        />
        <SquadDailyReport
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          squadId={squadId}
          onResume={(s) => {
            setReportOpen(false);
            setResumeSession({ id: s.id, started_at: s.started_at });
            setDailyOpen(true);
          }}
        />
        <SquadNotesReport
          open={notesReportOpen}
          onClose={() => setNotesReportOpen(false)}
          squadId={squadId}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
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
              <TabsTrigger value="nps" className="gap-1.5"><Smile className="h-3.5 w-3.5" /> % de NPS</TabsTrigger>
              <TabsTrigger value="engagement" className="gap-1.5"><Star className="h-3.5 w-3.5" /> Engajamento</TabsTrigger>
              <TabsTrigger value="agenda" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Agenda das Mensais</TabsTrigger>
            </TabsList>

            {/* CLIENTES */}
            <TabsContent value="clients" className="space-y-4">
              {incompleteClients.length > 0 && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 shadow-lg shadow-red-500/10 alert-blink">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-300 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-red-200">
                        {incompleteClients.length} cliente{incompleteClients.length > 1 ? "s" : ""} com informações faltando
                      </p>
                      <p className="text-xs text-red-200/70 mt-0.5">
                        Campos essenciais: nome, valor TP, serviços, Curva ABC e Sprint.
                      </p>
                      {showIncomplete && (
                        <ul className="mt-3 space-y-1 max-h-44 overflow-y-auto text-xs">
                          {incompleteClients.map(({ client, missing }) => (
                            <li key={client.id} className="flex items-center justify-between gap-3 bg-background/30 rounded-lg px-2.5 py-1.5">
                              <button onClick={() => openEdit(client)} className="font-semibold text-foreground hover:text-primary truncate text-left">
                                {client.name || "(sem nome)"}
                              </button>
                              <span className="text-red-300/80 shrink-0">faltando: {missing.join(", ")}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="border-red-500/40 hover:bg-red-500/10" onClick={() => setShowIncomplete((v) => !v)}>
                      {showIncomplete ? "Ocultar" : "Ver lista"}
                    </Button>
                  </div>
                </div>
              )}

              {upcomingDue.length > 0 && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-amber-200">
                        {upcomingDue.length} contrato{upcomingDue.length > 1 ? "s" : ""} vencendo em até 30 dias
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {upcomingDue.map(({ client, days }) => (
                          <button
                            key={client.id}
                            onClick={() => openEdit(client)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/20 transition-colors"
                          >
                            {client.name}
                            <span className="text-amber-300/70">· {days === 0 ? "hoje" : `${days}d`}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Smile className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">NPS / Engajamento do mês:</span>
                <Select value={highlightMonth} onValueChange={setHighlightMonth}>
                  <SelectTrigger className="w-[180px] h-8 bg-card/40 border-border/40 text-xs">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {engMonths.length === 0 ? (
                      <SelectItem value="none" disabled>Sem dados de engajamento</SelectItem>
                    ) : engMonths.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">{formatMonth(`${m}-01`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total" value={stats.total} icon={Users} color="from-emerald-500 to-teal-600" />
                <StatCard label="Prioridade AA" value={stats.aa} icon={AlertTriangle} color="from-red-500 to-orange-600" />
                <StatCard label="BM Verificada" value={stats.bm} icon={CheckCircle2} color="from-green-500 to-emerald-600" />
                <StatCard label="Renovação 60d" value={stats.renew} icon={Activity} color="from-primary to-fuchsia-600" />
                <StatCard label="NPS ativos" value={`${engHighlights.npsCount}/${stats.total}`} icon={Smile} color="from-sky-500 to-blue-600" sub={engHighlights.latest ? formatMonth(`${engHighlights.latest}-01`) : "sem dados"} delta={engTrend?.npsDelta ?? null} />
                <StatCard label="Média Engajamento" value={engHighlights.avgEng ? engHighlights.avgEng.toFixed(1) : "—"} icon={Star} color="from-amber-500 to-yellow-600" sub={engHighlights.latest ? formatMonth(`${engHighlights.latest}-01`) : "sem dados"} delta={engTrend?.avgDelta ?? null} />
              </div>

              {/* Resumo financeiro do squad */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Investido TP", value: financeSummary.investido, cls: "text-emerald-300", sub: "/ mês" },
                  { label: "Contratos", value: financeSummary.contratos, cls: "text-sky-300", sub: "/ mês" },
                  { label: "Meta de Vendas", value: financeSummary.meta, cls: "text-amber-300", sub: "/ mês" },
                  { label: "Faturamento", value: financeSummary.faturamento, cls: "text-fuchsia-300", sub: engHighlights.latest ? formatMonth(`${engHighlights.latest}-01`) : "" },
                ].map((f) => (
                  <div key={f.label} className="rounded-2xl border border-border/30 bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm p-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
                    <p className={`text-xl font-bold mt-1 ${f.cls}`}>{formatBRL(f.value)}</p>
                    {f.sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5 capitalize">{f.sub}</p>}
                  </div>
                ))}
              </div>

              {squadMonthly.length > 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-4">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-sky-400" /> Engajamento & NPS médio (0–10)
                    </p>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={squadMonthly}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="engajamento" name="Engajamento" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="notaNps" name="NPS médio" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-4">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-fuchsia-400" /> Faturamento por mês
                    </p>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={squadMonthly}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                            formatter={(v: any) => [formatBRL(Number(v)), "Faturamento"]}
                          />
                          <Bar dataKey="faturamento" name="Faturamento" fill="#d946ef" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">Prioridade:</span>
                  {["all", "AA", "AB", "AC", "BA", "BB", "BC", "CA", "CB", "CC"].map((p) => {
                    const active = priorityFilter === p;
                    const count = p === "all" ? clients.length : clients.filter((c) => c.prioritization === p).length;
                    return (
                      <button
                        key={p}
                        onClick={() => setPriorityFilter(p)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                          active
                            ? "border-primary/50 bg-primary/20 text-primary"
                            : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/30"
                        }`}
                      >
                        {p === "all" ? "Todos" : p}
                        <span className="ml-1 opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Buscar cliente..."
                      className="pl-9 w-full sm:w-56 bg-card/40 border-border/40"
                    />
                  </div>
                  <Button onClick={openNew} className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Novo cliente</Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-x-auto shadow-xl">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/30">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>
                        <button onClick={() => toggleSort("name")} className="inline-flex items-center hover:text-foreground transition-colors">Cliente{sortArrow("name")}</button>
                      </TableHead>
                      <TableHead>Serviços</TableHead>
                      <TableHead className="text-center">ABC</TableHead>
                      <TableHead className="text-center">Sprint</TableHead>
                      <TableHead className="text-center">
                        <button onClick={() => toggleSort("prioritization")} className="inline-flex items-center hover:text-foreground transition-colors">Prioriz.{sortArrow("prioritization")}</button>
                      </TableHead>
                      <TableHead className="text-center">BM</TableHead>
                      <TableHead>
                        <button onClick={() => toggleSort("invested")} className="inline-flex items-center hover:text-foreground transition-colors">Investido TP{sortArrow("invested")}</button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => toggleSort("meta")} className="inline-flex items-center hover:text-foreground transition-colors">Meta Venda{sortArrow("meta")}</button>
                      </TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleClients.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                        {clients.length === 0 ? "Nenhum cliente neste squad." : "Nenhum cliente nessa prioridade."}
                      </TableCell></TableRow>
                    ) : visibleClients.map((c, i) => {
                      const h = healthOf(c);
                      return (
                      <TableRow key={c.id} className="border-border/20 hover:bg-muted/20 transition-colors">
                        <TableCell className="text-muted-foreground text-xs font-mono">{i + 1}</TableCell>
                        <TableCell>
                          <button onClick={() => setDetailClient(c)} className="flex items-center gap-2.5 text-left group/cli">
                            <div className="relative shrink-0">
                              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-fuchsia-500/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                                {(c.name || "?").trim().charAt(0).toUpperCase()}
                              </div>
                              <span
                                title={h === "red" ? "Atenção" : h === "yellow" ? "Observar" : "Saudável"}
                                className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                                  h === "red" ? "bg-red-500" : h === "yellow" ? "bg-amber-400" : "bg-emerald-500"
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold leading-tight truncate group-hover/cli:text-primary transition-colors">{c.name}</p>
                              {c.niche && <p className="text-[11px] text-muted-foreground truncate">{c.niche}</p>}
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {parseServices(c.services).length === 0 ? (
                              <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40 text-[10px]">faltando</Badge>
                            ) : parseServices(c.services).map((s) => (
                              <Badge key={s} variant="outline" className={`${SERVICE_COLORS[s]} text-[10px] font-semibold`}>{s}</Badge>
                            ))}
                          </div>
                        </TableCell>
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
                        <TableCell className="text-xs font-semibold">
                          {parseMoney(c.invested_tp) == null
                            ? <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40 text-[10px]">faltando</Badge>
                            : <span className="text-emerald-300">{formatBRL(parseMoney(c.invested_tp))}</span>}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {c.sales_goal != null
                            ? <span className="text-amber-300">{formatBRL(c.sales_goal)}</span>
                            : <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/40">definir</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
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
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-primary/80">Tráfego Pago (TP)</p>
                      <p className="text-2xl font-bold mt-1 text-primary">{serviceCounts.TP}</p>
                    </div>
                    <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-fuchsia-300/80">CRM</p>
                      <p className="text-2xl font-bold mt-1 text-fuchsia-300">{serviceCounts.CRM}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-emerald-300/80">Acomp. Comercial (COM)</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-300">{serviceCounts.COM}</p>
                    </div>
                  </div>
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

                  <div className="rounded-2xl border border-border/30 bg-background/30 p-5">
                    <div className="mb-4">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" /> Funil de serviços contratados
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Distribuição dos clientes por quantidade de serviços (1 → 3).
                      </p>
                    </div>
                    <ServiceFunnel data={serviceFunnel} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* MÉTRICAS */}
            <TabsContent value="metrics" className="space-y-4">
              {/* Fechamento operacional (base D+30) */}
              {metricsCohort && (metricsCohort.missingEntry ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  ⚠️ Para o fechamento (engajamento, vendas — base de clientes ativos há +30 dias), preencha a <strong>Data de entrada</strong> dos clientes na aba <strong>Clientes</strong>.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-end gap-2">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Mês do fechamento:</span>
                    <Select value={highlightMonth} onValueChange={setHighlightMonth}>
                      <SelectTrigger className="w-[180px] h-8 bg-card/40 border-border/40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {engMonths.length === 0 ? <SelectItem value="none" disabled>Sem dados</SelectItem> : engMonths.map((m) => (
                          <SelectItem key={m} value={m} className="capitalize">{formatMonth(`${m}-01`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Engajamento médio (CRM)</p>
                      <p className="text-2xl font-bold mt-1 text-sky-300">{metricsCohort.avgEng ? metricsCohort.avgEng.toFixed(1) : "—"}<span className="text-sm text-muted-foreground"> / 5</span></p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{metricsCohort.evaluated} de {metricsCohort.eligibleCount} elegíveis avaliados (D+30)</p>
                    </div>
                    <div className={`rounded-2xl border p-4 ${metricsCohort.vendido >= 10000 ? "border-emerald-500/40 bg-emerald-500/10" : metricsCohort.vendido >= 5000 ? "border-amber-500/40 bg-amber-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendido no mês</p>
                      <p className={`text-2xl font-bold mt-1 ${metricsCohort.vendido >= 10000 ? "text-emerald-300" : metricsCohort.vendido >= 5000 ? "text-amber-300" : "text-red-300"}`}>{formatBRL(metricsCohort.vendido)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">meta ≥ R$ 10k · mín R$ 5k</p>
                    </div>
                    <div className={`rounded-2xl border p-4 ${metricsCohort.secondaryPct >= 20 ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Produto secundário</p>
                      <p className={`text-2xl font-bold mt-1 ${metricsCohort.secondaryPct >= 20 ? "text-emerald-300" : "text-amber-300"}`}>{metricsCohort.secondaryPct.toFixed(0)}%</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{metricsCohort.withSecondary} clientes · meta ≥ 20%</p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-border/40 bg-card/20 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">CPL / CPMQL médios</p>
                      <p className="text-sm font-semibold mt-1 text-muted-foreground">Vem da dash de Criativos</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">CPL ≤ R$ 8 · CPMQL ≤ R$ 45 — precisa linkar Meta/GHL ao squad</p>
                    </div>
                  </div>
                </>
              ))}

              <MetricsOverview metrics={metrics} />
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
              <ChurnPanel
                churns={churns}
                clients={clients}
                activeClientsCount={clients.length}
                onNew={() => { setEditingChurn({ churn_month: `${new Date().toISOString().slice(0, 7)}-01` }); setPendingClientDelete(null); setOpenChurn(true); }}
                onEdit={(c) => { setEditingChurn(c); setPendingClientDelete(null); setOpenChurn(true); }}
                onRemove={removeChurn}
              />
            </TabsContent>

            {/* NPS — dashboard por cliente, filtrável por mês */}
            <TabsContent value="nps" className="space-y-4">
              {(() => {
                const months = Array.from(new Set(engagement.map((e) => (e.reference_month || "").slice(0, 7)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
                const byMonth = npsMonth === "all" ? engagement : engagement.filter((e) => (e.reference_month || "").slice(0, 7) === npsMonth);
                const q = npsSearch.trim().toLowerCase();
                const filtered = q ? byMonth.filter((e) => (e.client_name || "").toLowerCase().includes(q)) : byMonth;
                const stats = buildNpsStats(filtered);
                const dist = { ...stats, monthly: npsMonthly };

                // Agrupa por sprint (A, B, C, depois sem sprint)
                const sprintOrder = ["A", "B", "C"];
                const groups = new Map<string, Engagement[]>();
                filtered.forEach((e) => {
                  const s = (e.sprint || "").toUpperCase() || "—";
                  if (!groups.has(s)) groups.set(s, []);
                  groups.get(s)!.push(e);
                });
                const orderedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
                  const ia = sprintOrder.indexOf(a); const ib = sprintOrder.indexOf(b);
                  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                });

                return (
                  <>
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                      As notas de NPS são alimentadas pela aba <strong className="text-primary">Engajamento</strong>. Aqui você vê um dashboard completo de cada cliente: NPS, engajamento, vendas e faturamento por canais.
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <Label className="text-xs text-muted-foreground">Mês:</Label>
                        <Select value={npsMonth} onValueChange={setNpsMonth}>
                          <SelectTrigger className="w-[200px] bg-card/40 border-border/40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os meses</SelectItem>
                            {months.map((m) => (
                              <SelectItem key={m} value={m} className="capitalize">{formatMonth(`${m}-01`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={npsSearch}
                          onChange={(e) => setNpsSearch(e.target.value)}
                          placeholder="Pesquisar cliente..."
                          className="pl-9 bg-card/40 border-border/40"
                        />
                      </div>
                    </div>

                    {npsCohort && (
                      npsCohort.missingEntry ? (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                          ⚠️ Para o fechamento de NPS (base de clientes ativos há +30 dias), preencha a <strong>Data de entrada</strong> dos clientes na aba <strong>Clientes</strong>.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                          <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ativos totais</p>
                            <p className="text-2xl font-bold mt-1 text-violet-300">{npsCohort.totalAtivos}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">no mês · +{npsCohort.novosNoMes} novos</p>
                          </div>
                          <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ativos elegíveis</p>
                            <p className="text-2xl font-bold mt-1">{npsCohort.eligible.length}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">deviam responder (D+30)</p>
                          </div>
                          <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Responderam</p>
                            <p className="text-2xl font-bold mt-1 text-sky-300">{npsCohort.responded.length}</p>
                            <button onClick={() => setNpsListDialog("responded")} className="text-[10px] text-primary hover:underline mt-0.5">ver lista</button>
                          </div>
                          <div className={`rounded-2xl border p-4 ${npsCohort.responseRate >= 80 ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">% de resposta</p>
                            <p className={`text-2xl font-bold mt-1 ${npsCohort.responseRate >= 80 ? "text-emerald-300" : "text-red-300"}`}>{npsCohort.responseRate.toFixed(0)}%</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              meta ≥ 80% · <button onClick={() => setNpsListDialog("missed")} className="text-primary hover:underline">{npsCohort.missed.length} faltaram</button>
                            </p>
                          </div>
                          <div className={`rounded-2xl border p-4 ${npsCohort.avgNps >= 9 ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nota média</p>
                            <p className={`text-2xl font-bold mt-1 ${npsCohort.avgNps >= 9 ? "text-emerald-300" : "text-amber-300"}`}>{npsCohort.avgNps ? npsCohort.avgNps.toFixed(1) : "—"}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">meta ≥ 9,0</p>
                          </div>
                        </div>
                      )
                    )}

                    <NpsChart dist={dist} />

                    {/* Dashboard por cliente — agrupado por mês (accordion) */}
                    {(() => {
                      // Agrupa por mês
                      const byMonthMap = new Map<string, Engagement[]>();
                      filtered.forEach((e) => {
                        const mk = (e.reference_month || "").slice(0, 7) || "sem-mes";
                        if (!byMonthMap.has(mk)) byMonthMap.set(mk, []);
                        byMonthMap.get(mk)!.push(e);
                      });
                      const sortedMonths = Array.from(byMonthMap.keys()).sort((a, b) => b.localeCompare(a));

                      if (filtered.length === 0) return (
                        <div className="rounded-2xl border border-border/30 bg-card/40 p-10 text-center text-muted-foreground">
                          Nenhum cliente encontrado{q ? " para esta pesquisa" : npsMonth !== "all" ? " neste mês" : ""}.
                        </div>
                      );

                      return (
                        <NpsMonthAccordion
                          sortedMonths={sortedMonths}
                          byMonthMap={byMonthMap}
                          sprintOrder={sprintOrder}
                          formatMonth={formatMonth}
                          CURVE_COLORS={CURVE_COLORS}
                          computeChannels={computeChannels}
                          fmtBRL={fmtBRL}
                        />
                      );
                    })()}
                  </>
                );
              })()}
            </TabsContent>

            {/* ENGAJAMENTO — agrupado por mês */}
            <TabsContent value="engagement" className="space-y-4">
              {(() => {
                const months = Array.from(new Set(engagement.map((e) => (e.reference_month || "").slice(0, 7)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
                const filtered = engMonth === "all" ? engagement : engagement.filter((e) => (e.reference_month || "").slice(0, 7) === engMonth);
                return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <Label className="text-xs text-muted-foreground">Mês:</Label>
                      <Select value={engMonth} onValueChange={setEngMonth}>
                        <SelectTrigger className="w-[200px] bg-card/40 border-border/40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os meses</SelectItem>
                          {months.map((m) => (
                            <SelectItem key={m} value={m} className="capitalize">{formatMonth(`${m}-01`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" onClick={() => setEngShowTrash((v) => !v)} className="gap-1.5">
                        <Trash2 className="h-4 w-4" />
                        {engShowTrash ? `Voltar (${engTrash.length})` : `Lixeira (${engTrash.length})`}
                      </Button>
                      <Button variant="outline" onClick={() => { setEditingEng({ reference_month: `${(engMonth !== "all" ? engMonth : new Date().toISOString().slice(0, 7))}-01` }); setOpenEng(true); }} className="gap-1.5">
                        <Plus className="h-4 w-4" /> Novo cliente
                      </Button>
                      <Button onClick={() => { setNewMonthValue(new Date().toISOString().slice(0, 7)); setNewMonthOpen(true); }} className="gap-1.5">
                        <CalendarDays className="h-4 w-4" /> Novo mês
                      </Button>
                    </div>
                  </div>

              {engShowTrash ? (
                engTrash.length === 0 ? (
                  <div className="rounded-2xl border border-border/30 bg-card/40 p-12 text-center text-muted-foreground">
                    Lixeira vazia. Itens excluídos há mais de 30 dias são removidos definitivamente.
                  </div>
                ) : (
                  Array.from(
                    engTrash.reduce((map, e) => {
                      const k = (e.reference_month || "").slice(0, 7) || "—";
                      if (!map.has(k)) map.set(k, [] as Engagement[]);
                      map.get(k)!.push(e);
                      return map;
                    }, new Map<string, Engagement[]>())
                  ).sort(([a], [b]) => b.localeCompare(a)).map(([month, list]) => (
                    <div key={month} className="rounded-2xl border border-red-500/30 bg-red-500/5 overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Trash2 className="h-4 w-4 text-red-400" />
                          <span className="font-bold capitalize">{formatMonth(`${month}-01`)}</span>
                          <Badge variant="outline" className="bg-red-500/10 text-red-300 border-red-500/40">{list.length} registros</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => restoreMonth(month)}>Restaurar mês</Button>
                          <Button size="sm" variant="outline" className="text-red-400 hover:text-red-300" onClick={() => setPurgeMonth(`${month}-01`)}>
                            Excluir definitivo (token)
                          </Button>
                        </div>
                      </div>
                      <div className="px-4 py-3 text-xs text-muted-foreground">
                        {list.map((e) => e.client_name).join(" · ")}
                      </div>
                    </div>
                  ))
                )
              ) : null}

              {!engShowTrash && (filtered.length === 0 ? (
                <div className="rounded-2xl border border-border/30 bg-card/40 p-12 text-center text-muted-foreground">
                  Nenhum registro de engajamento{engMonth !== "all" ? " neste mês" : ""}. Use <strong>Novo mês</strong> para carregar todos os clientes automaticamente.
                </div>
              ) : (
                Array.from(
                  filtered.reduce((map, e) => {
                    const k = (e.reference_month || "").slice(0, 7) || "—";
                    if (!map.has(k)) map.set(k, [] as Engagement[]);
                    map.get(k)!.push(e);
                    return map;
                  }, new Map<string, Engagement[]>())
                )
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([month, list]) => {
                    const npsList = list.map((e) => e.nps_individual).filter((v): v is number => v != null);
                    const avgNps = npsList.length ? (npsList.reduce((s, n) => s + n, 0) / npsList.length).toFixed(1) : "—";
                    return (
                      <div key={month} className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden shadow-xl">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-primary/10 to-fuchsia-500/5 border-b border-border/30 flex-wrap">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            <span className="font-bold capitalize">{formatMonth(`${month}-01`)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/40">{list.length} registros</Badge>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/40">NPS médio: {avgNps}</Badge>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-red-400 hover:text-red-300" onClick={() => trashMonth(month)}>
                              <Trash2 className="h-3.5 w-3.5" /> Excluir mês
                            </Button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent border-border/30">
                                <TableHead>Cliente</TableHead>
                                <TableHead className="text-center">ABC</TableHead>
                                <TableHead className="text-center">Sprint</TableHead>
                                <TableHead className="text-center">Engaj. (1-5)</TableHead>
                                <TableHead className="text-center">NPS</TableHead>
                                <TableHead className="text-center">Vendas</TableHead>
                                <TableHead className="text-center">Meta × Vendeu</TableHead>
                                <TableHead className="text-center">Faturamento</TableHead>
                                <TableHead>Observação</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {list.map((e) => (
                                <TableRow key={e.id} className="border-border/20">
                                  <TableCell className="font-semibold">{e.client_name}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className={CURVE_COLORS[e.curve_abc || ""] || "border-border/40 text-muted-foreground"}>{e.curve_abc || "-"}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className={CURVE_COLORS[e.sprint || ""] || "border-border/40 text-muted-foreground"}>{e.sprint || "-"}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {e.engagement_score != null ? (
                                      <span className="inline-flex items-center gap-0.5">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                          <Star key={i} className={`h-3.5 w-3.5 ${i < (e.engagement_score || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                                        ))}
                                      </span>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell className="text-center font-bold">
                                    {e.nps_individual != null ? (
                                      <Badge variant="outline" className={
                                        e.nps_individual > 8 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" :
                                        e.nps_individual < 7 ? "bg-red-500/15 text-red-300 border-red-500/40" :
                                        "bg-amber-500/15 text-amber-300 border-amber-500/40"
                                      }>{e.nps_individual}</Badge>
                                    ) : "-"}
                                  </TableCell>
                                  {(() => {
                                    const ch = computeChannels(e.vendas_trafego, e.vendas_loja, e.faturamento);
                                    return (
                                      <>
                                        <TableCell className="text-center">
                                          {ch.vendasTotal > 0 ? (
                                            <div className="leading-tight">
                                              <span className="font-bold">{ch.vendasTotal}</span>
                                              <span className="block text-[10px] text-muted-foreground">T {Number(e.vendas_trafego) || 0} · L {Number(e.vendas_loja) || 0}</span>
                                              {e.vendas_perc_canais && <span className="block text-[9px] text-muted-foreground/70">{e.vendas_perc_canais}</span>}
                                            </div>
                                          ) : <span className="text-muted-foreground">-</span>}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {(e as any).meta_vendas != null ? (
                                            <div className="leading-tight">
                                              <span className={`font-bold ${ch.vendasTotal >= (e as any).meta_vendas ? "text-emerald-300" : "text-amber-300"}`}>
                                                {ch.vendasTotal} / {(e as any).meta_vendas}
                                              </span>
                                              <span className="block text-[10px] text-muted-foreground">vendeu / meta</span>
                                              <span className="block text-[9px] text-muted-foreground/70">
                                                tráf {Number(e.vendas_trafego) || 0}/{(e as any).meta_vendas_trafego ?? "—"} · loja {Number(e.vendas_loja) || 0}/{(e as any).meta_vendas_loja ?? "—"}
                                              </span>
                                            </div>
                                          ) : <span className="text-muted-foreground text-[10px]">definir meta</span>}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {e.faturamento != null && Number(e.faturamento) > 0 ? (
                                            <div className="leading-tight">
                                              <span className="font-bold text-emerald-300">{fmtBRL(e.faturamento)}</span>
                                              {ch.vendasTotal > 0 && (
                                                <span className="block text-[10px] text-muted-foreground">T {fmtBRL(ch.fatTrafego)} · L {fmtBRL(ch.fatLoja)}</span>
                                              )}
                                              {e.faturamento_perc_canais && <span className="block text-[9px] text-muted-foreground/70">{e.faturamento_perc_canais}</span>}
                                              {(e as any).meta_faturamento != null && (
                                                <span className={`block text-[9px] ${Number(e.faturamento) >= (e as any).meta_faturamento ? "text-emerald-400/80" : "text-amber-400/80"}`}>
                                                  meta {fmtBRL((e as any).meta_faturamento)}
                                                </span>
                                              )}
                                            </div>
                                          ) : <span className="text-muted-foreground">-</span>}
                                        </TableCell>
                                      </>
                                    );
                                  })()}
                                  <TableCell className="text-muted-foreground text-xs max-w-[240px] truncate" title={e.observation || ""}>{e.observation || "-"}</TableCell>
                                  <TableCell className="text-right">
                                    <Button size="icon" variant="ghost" onClick={() => { setEditingEng(e); setOpenEng(true); }}><Pencil className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => removeEng(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })
              ))}
                </>
                );
              })()}
            </TabsContent>

            {/* AGENDA */}
            <TabsContent value="agenda" className="space-y-4">
              <AgendaPanel
                agenda={agenda}
                clients={clients}
                squadId={squadId}
                activeClientsCount={clients.length}
                onNew={() => { setEditingAg({ reference_month: `${new Date().toISOString().slice(0, 7)}-01`, done: false }); setOpenAg(true); }}
                onEdit={(a) => { setEditingAg(a); setOpenAg(true); }}
                onRemove={removeAg}
                onToggleDone={toggleAgDone}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Lista de NPS: respondeu / faltou */}
      <Dialog open={!!npsListDialog} onOpenChange={(o) => { if (!o) setNpsListDialog(null); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {npsListDialog === "responded" ? "Clientes que responderam" : "Clientes que faltaram"}
              {npsCohort ? ` · ${formatMonth(`${npsCohort.M}-01`)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            {npsCohort && (npsListDialog === "responded" ? npsCohort.responded : npsCohort.missed).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente nesta lista.</p>
            ) : (
              npsCohort && (npsListDialog === "responded" ? npsCohort.responded : npsCohort.missed).map((c) => {
                const nota = npsCohort.npsByName.get((c.name || "").trim().toLowerCase());
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/30 bg-card/40 px-3 py-2 text-sm">
                    <span className="font-medium">{c.name}</span>
                    {npsListDialog === "responded" ? (
                      <Badge variant="outline" className={`font-bold ${nota != null && nota >= 9 ? "border-emerald-500/40 text-emerald-300" : nota != null && nota < 7 ? "border-red-500/40 text-red-300" : "border-amber-500/40 text-amber-300"}`}>
                        Nota {nota ?? "—"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-500/40 text-red-300">não respondeu</Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Painel de detalhes do cliente */}
      <Dialog open={!!detailClient} onOpenChange={(o) => { if (!o) setDetailClient(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailClient && (() => {
            const c = detailClient;
            const h = healthOf(c);
            const hist = engagement
              .filter((e) => (e.client_name || "").trim().toLowerCase() === (c.name || "").trim().toLowerCase())
              .sort((a, b) => (b.reference_month || "").localeCompare(a.reference_month || ""));
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${h === "red" ? "bg-red-500" : h === "yellow" ? "bg-amber-400" : "bg-emerald-500"}`} />
                    {c.name}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">{c.niche || "—"}</p>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {parseServices(c.services).map((s) => (
                      <Badge key={s} variant="outline" className={`${SERVICE_COLORS[s]} text-[10px] font-semibold`}>{s}</Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="Priorização" value={c.prioritization || "—"} />
                    <Info label="Curva / Sprint" value={`${c.curve_abc || "—"} / ${c.sprint || "—"}`} />
                    <Info label="Investido TP" value={parseMoney(c.invested_tp) != null ? formatBRL(parseMoney(c.invested_tp)) : "—"} />
                    <Info label="Contrato" value={c.contract_value != null ? formatBRL(c.contract_value) : "—"} />
                    <Info label="Meta de venda" value={c.sales_goal != null ? formatBRL(c.sales_goal) : "—"} />
                    <Info label="BM verificada" value={c.bm_verified ? "Sim" : "Não"} />
                    <Info label="Entrada" value={formatMonth(c.entry_date)} />
                    <Info label="Vencimento" value={c.due_date ? new Date(c.due_date + "T12:00:00Z").toLocaleDateString("pt-BR") : "—"} />
                  </div>
                  {c.observations && (
                    <div className="rounded-lg bg-muted/20 p-3 text-sm">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Observações</p>
                      {c.observations}
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Histórico de engajamento</p>
                    {hist.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem lançamentos de engajamento.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {hist.slice(0, 6).map((e) => (
                          <div key={e.id} className="flex items-center justify-between rounded-lg border border-border/30 bg-card/40 px-3 py-2 text-xs">
                            <span className="capitalize font-medium">{formatMonth(e.reference_month)}</span>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <span>Eng: <b className="text-foreground">{e.engagement_score ?? "—"}</b></span>
                              <span>NPS: <b className="text-foreground">{e.nps_individual ?? "—"}</b></span>
                              <span>Vendas: <b className="text-foreground">{e.vendas ?? "—"}</b></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" className="gap-1.5" onClick={() => { const cc = c; setDetailClient(null); openEdit(cc); }}>
                      <Pencil className="h-4 w-4" /> Editar cliente
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Client dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Cliente *</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Nicho</Label><Input value={editing.niche || ""} onChange={(e) => setEditing({ ...editing, niche: e.target.value })} /></div>
              <div className="col-span-2">
                <Label>Serviços contratados</Label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {SERVICE_OPTIONS.map((opt) => {
                    const selected = parseServices(editing.services).includes(opt.code);
                    return (
                      <button
                        type="button"
                        key={opt.code}
                        onClick={() => {
                          const cur = parseServices(editing.services);
                          const next = selected ? cur.filter((s) => s !== opt.code) : [...cur, opt.code];
                          setEditing({ ...editing, services: next.join(", ") });
                        }}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                          selected
                            ? `${SERVICE_COLORS[opt.code]} ring-2 ring-offset-0 ring-current/40`
                            : "border-border/40 bg-background/30 hover:bg-background/50 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-4 w-4 rounded border flex items-center justify-center ${selected ? "bg-current/20 border-current" : "border-border/60"}`}>
                            {selected && <CheckCircle2 className="h-3 w-3" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold leading-tight">{opt.code}</div>
                            <div className="text-[10px] opacity-80 leading-tight">{opt.label}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
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
              <div>
                <Label>Valor investido TP (mensal)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">R$</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="100"
                    className="pl-9"
                    placeholder="0"
                    value={editing.invested_tp ?? ""}
                    onChange={(e) => setEditing({ ...editing, invested_tp: e.target.value })}
                  />
                </div>
                {parseMoney(editing.invested_tp) != null && (
                  <p className="text-[11px] text-emerald-300 mt-1 font-semibold">{formatBRL(parseMoney(editing.invested_tp))}</p>
                )}
              </div>
              <div>
                <Label>Valor do contrato (mensal)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">R$</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="100"
                    className="pl-9"
                    placeholder="0"
                    value={editing.contract_value ?? ""}
                    onChange={(e) => setEditing({ ...editing, contract_value: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                {editing.contract_value != null && (
                  <p className="text-[11px] text-emerald-300 mt-1 font-semibold">{formatBRL(editing.contract_value)} / mês</p>
                )}
              </div>
              <div>
                <Label>Meta de Venda (mensal)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">R$</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="100"
                    className="pl-9"
                    placeholder="0"
                    value={editing.sales_goal ?? ""}
                    onChange={(e) => setEditing({ ...editing, sales_goal: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                {editing.sales_goal != null && (
                  <p className="text-[11px] text-amber-300 mt-1 font-semibold">{formatBRL(editing.sales_goal)} / mês</p>
                )}
              </div>
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
      <Dialog open={openChurn} onOpenChange={(o) => { setOpenChurn(o); if (!o) setPendingClientDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChurn?.id ? "Editar churn" : "Novo churn"}</DialogTitle>
            {pendingClientDelete && (
              <p className="text-xs text-amber-300 mt-1">
                O cliente será removido da lista após salvar o churn.
              </p>
            )}
          </DialogHeader>
          {editingChurn && (() => {
            const entryYM = editingChurn.entry_month ? editingChurn.entry_month.slice(0, 7) : "";
            const churnYM = editingChurn.churn_month ? editingChurn.churn_month.slice(0, 7) : "";
            const months = monthsBetween(editingChurn.entry_month, editingChurn.churn_month);
            return (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Cliente *</Label>
                  <Input value={editingChurn.client_name || ""} onChange={(e) => setEditingChurn({ ...editingChurn, client_name: e.target.value })} />
                </div>
                <div>
                  <Label>Mês de entrada</Label>
                  <Input type="month" value={entryYM} onChange={(e) => setEditingChurn({ ...editingChurn, entry_month: e.target.value ? `${e.target.value}-01` : null })} />
                </div>
                <div>
                  <Label>Mês do churn</Label>
                  <Input type="month" value={churnYM} onChange={(e) => setEditingChurn({ ...editingChurn, churn_month: e.target.value ? `${e.target.value}-01` : null })} />
                </div>
                <div className="col-span-2">
                  <Label>Meses vigentes (calculado)</Label>
                  <div className="h-9 px-3 py-2 rounded-md border border-border/40 bg-muted/30 text-sm flex items-center">
                    {months != null ? `${months} ${months === 1 ? "mês" : "meses"}` : "—"}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label>Valor do contrato (mensal)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">R$</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="100"
                      className="pl-9"
                      placeholder="0"
                      value={editingChurn.contract_value ?? ""}
                      onChange={(e) => setEditingChurn({ ...editingChurn, contract_value: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </div>
                  {editingChurn.contract_value != null && months != null && months > 0 && (
                    <p className="text-[11px] text-emerald-300 mt-1 font-semibold">
                      LTV: {formatBRL(editingChurn.contract_value * months)} ({months} {months === 1 ? "mês" : "meses"} × {formatBRL(editingChurn.contract_value)})
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <Label>Motivo</Label>
                  <Input value={editingChurn.reason || ""} onChange={(e) => setEditingChurn({ ...editingChurn, reason: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={editingChurn.observations || ""} onChange={(e) => setEditingChurn({ ...editingChurn, observations: e.target.value })} />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpenChurn(false); setPendingClientDelete(null); }}>Cancelar</Button>
            <Button onClick={saveChurn}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NPS dialog */}
      <Dialog open={openNps} onOpenChange={setOpenNps}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingNps?.id ? "Editar NPS" : "Novo NPS"}</DialogTitle></DialogHeader>
          {editingNps && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Período (mês) *</Label><Input type="month" value={editingNps.period?.slice(0, 7) || ""} onChange={(e) => setEditingNps({ ...editingNps, period: e.target.value ? `${e.target.value}-01` : "" })} /></div>
              <div><Label>Total de clientes</Label><Input type="number" value={editingNps.total_clients ?? ""} onChange={(e) => setEditingNps({ ...editingNps, total_clients: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Engajamento médio</Label><Input type="number" step="0.1" value={editingNps.avg_engagement ?? ""} onChange={(e) => setEditingNps({ ...editingNps, avg_engagement: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Detratores (0-6)</Label><Input type="number" value={editingNps.detractors ?? ""} onChange={(e) => setEditingNps({ ...editingNps, detractors: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Neutros (7-8)</Label><Input type="number" value={editingNps.neutrals ?? ""} onChange={(e) => setEditingNps({ ...editingNps, neutrals: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Promotores (9-10)</Label><Input type="number" value={editingNps.promoters ?? ""} onChange={(e) => setEditingNps({ ...editingNps, promoters: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={editingNps.observations || ""} onChange={(e) => setEditingNps({ ...editingNps, observations: e.target.value })} /></div>
              <div className="col-span-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-2.5">
                NPS calculado automaticamente: <strong>(Promotores − Detratores) ÷ Respostas × 100</strong>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNps(false)}>Cancelar</Button>
            <Button onClick={saveNps}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Engagement dialog */}
      <Dialog open={openEng} onOpenChange={setOpenEng}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-gradient-to-r from-primary/15 via-fuchsia-500/10 to-transparent">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-fuchsia-600 flex items-center justify-center shadow-lg shadow-primary/20">
                <Star className="h-4.5 w-4.5 text-white" />
              </span>
              <div className="flex flex-col">
                <span className="text-base font-bold leading-tight">{editingEng?.id ? "Editar engajamento" : "Novo registro"}</span>
                <span className="text-xs font-normal text-muted-foreground">Acompanhamento mensal do cliente</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {editingEng && (
            <div className="px-6 py-5 space-y-6">
              {/* Identificação */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <Users className="h-3.5 w-3.5" /> Identificação
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Mês *</Label>
                    <Input type="month" value={editingEng.reference_month?.slice(0, 7) || ""} onChange={(e) => setEditingEng({ ...editingEng, reference_month: e.target.value ? `${e.target.value}-01` : "" })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente *</Label>
                    <Select
                      value={editingEng.client_name || ""}
                      onValueChange={(v) => {
                        const c = clients.find((x) => x.name === v);
                        setEditingEng({
                          ...editingEng,
                          client_name: v,
                          curve_abc: editingEng.curve_abc || c?.curve_abc || null,
                          sprint: editingEng.sprint || c?.sprint || null,
                        });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Curva ABC</Label>
                    <Select value={editingEng.curve_abc || ""} onValueChange={(v) => setEditingEng({ ...editingEng, curve_abc: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{["A", "B", "C"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sprint</Label>
                    <Select value={editingEng.sprint || ""} onValueChange={(v) => setEditingEng({ ...editingEng, sprint: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{["A", "B", "C"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Engajamento & NPS */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  <Gauge className="h-3.5 w-3.5" /> Engajamento & NPS
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Engajamento (1-5)</Label>
                    <Input type="number" min="1" max="5" placeholder="0" value={editingEng.engagement_score ?? ""} onChange={(e) => setEditingEng({ ...editingEng, engagement_score: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>NPS individual (0-10)</Label>
                    <Input type="number" min="0" max="10" placeholder="0" value={editingEng.nps_individual ?? ""} onChange={(e) => setEditingEng({ ...editingEng, nps_individual: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                </div>
              </section>

              {/* Meta & Vendas */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  <ShoppingCart className="h-3.5 w-3.5" /> Meta & Vendas
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-muted-foreground" /> Situação da meta</Label>
                    <Select value={editingEng.meta_status || ""} onValueChange={(v) => setEditingEng({ ...editingEng, meta_status: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dentro da meta">Dentro da meta</SelectItem>
                        <SelectItem value="Fora da meta">Fora da meta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-muted-foreground" /> Meta Vendas Tráfego</Label>
                    <Input type="number" min="0" placeholder="ex: 5" value={editingEng.meta_vendas_trafego ?? ""} onChange={(e) => setEditingEng({ ...editingEng, meta_vendas_trafego: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-muted-foreground" /> Meta Vendas Loja</Label>
                    <Input type="number" min="0" placeholder="ex: 7" value={editingEng.meta_vendas_loja ?? ""} onChange={(e) => setEditingEng({ ...editingEng, meta_vendas_loja: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">Meta Vendas (total) <span className="text-[10px] text-muted-foreground">auto</span></Label>
                    <Input readOnly tabIndex={-1} className="bg-muted/40 cursor-default" value={((Number(editingEng.meta_vendas_trafego) || 0) + (Number(editingEng.meta_vendas_loja) || 0)) || ""} placeholder="—" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vendas Tráfego</Label>
                    <Input type="number" min="0" placeholder="0" value={editingEng.vendas_trafego ?? ""} onChange={(e) => setEditingEng({ ...editingEng, vendas_trafego: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vendas Loja</Label>
                    <Input type="number" min="0" placeholder="0" value={editingEng.vendas_loja ?? ""} onChange={(e) => setEditingEng({ ...editingEng, vendas_loja: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">Vendas (total) <span className="text-[10px] text-muted-foreground">auto</span></Label>
                    <Input readOnly tabIndex={-1} className="bg-muted/40 cursor-default" value={computeChannels(editingEng.vendas_trafego, editingEng.vendas_loja, editingEng.faturamento).vendasTotal || ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">% de vendas por canais <span className="text-[10px] text-muted-foreground">auto</span></Label>
                    <Input readOnly tabIndex={-1} className="bg-muted/40 cursor-default" placeholder="—" value={computeChannels(editingEng.vendas_trafego, editingEng.vendas_loja, editingEng.faturamento).vendasPerc} />
                  </div>
                </div>
              </section>

              {/* Faturamento */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  <DollarSign className="h-3.5 w-3.5" /> Faturamento
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-muted-foreground" /> Meta Faturamento</Label>
                    <Input type="number" min="0" placeholder="ex: 10000" value={editingEng.meta_faturamento ?? ""} onChange={(e) => setEditingEng({ ...editingEng, meta_faturamento: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Faturamento (total)</Label>
                    <Input type="number" min="0" placeholder="0" value={editingEng.faturamento ?? ""} onChange={(e) => setEditingEng({ ...editingEng, faturamento: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">Faturamento por canais <span className="text-[10px] text-muted-foreground">auto</span></Label>
                    <Input readOnly tabIndex={-1} className="bg-muted/40 cursor-default" placeholder="—" value={computeChannels(editingEng.vendas_trafego, editingEng.vendas_loja, editingEng.faturamento).fatPorCanais} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="flex items-center gap-1.5">% faturamento por canais <span className="text-[10px] text-muted-foreground">auto</span></Label>
                    <Input readOnly tabIndex={-1} className="bg-muted/40 cursor-default" placeholder="—" value={computeChannels(editingEng.vendas_trafego, editingEng.vendas_loja, editingEng.faturamento).fatPerc} />
                  </div>
                </div>
              </section>

              {/* Observação */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Observação
                </div>
                <Textarea rows={2} placeholder="Anotações sobre o cliente neste mês..." value={editingEng.observation || ""} onChange={(e) => setEditingEng({ ...editingEng, observation: e.target.value })} />
              </section>
            </div>
          )}
          <DialogFooter className="px-6 py-4 border-t border-border/40 bg-card/40">
            <Button variant="ghost" onClick={() => setOpenEng(false)}>Cancelar</Button>
            <Button onClick={saveEng} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Agenda dialog */}
      <Dialog open={openAg} onOpenChange={setOpenAg}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {editingAg?.id ? "Editar Alinhamento Mensal" : "Novo Alinhamento Mensal"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Reunião mensal de alinhamento com o cliente.
            </p>
          </DialogHeader>
          {editingAg && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="col-span-2">
                <Label>Cliente *</Label>
                <Select
                  value={editingAg.client_name || ""}
                  onValueChange={(v) => {
                    const c = clients.find((x) => x.name === v);
                    setEditingAg({
                      ...editingAg,
                      client_name: v,
                      category: editingAg.category || c?.curve_abc || null,
                    });
                  }}
                >
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mês de referência *</Label>
                <Input className="h-11" type="month" value={editingAg.reference_month?.slice(0, 7) || ""} onChange={(e) => setEditingAg({ ...editingAg, reference_month: e.target.value ? `${e.target.value}-01` : "" })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={editingAg.category || ""} onValueChange={(v) => setEditingAg({ ...editingAg, category: v })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Auto pela Curva ABC" /></SelectTrigger>
                  <SelectContent>{["A","B","C"].map((x)=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data da reunião</Label>
                <Input className="h-11 text-base font-semibold" type="date" value={editingAg.meeting_date || ""} onChange={(e) => setEditingAg({ ...editingAg, meeting_date: e.target.value })} />
              </div>
              <div>
                <Label>Hora</Label>
                <Input className="h-11 text-base font-semibold tabular-nums" type="time" value={editingAg.meeting_time?.slice(0, 5) || ""} onChange={(e) => setEditingAg({ ...editingAg, meeting_time: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Responsável</Label>
                <Input value={editingAg.responsible || ""} onChange={(e) => setEditingAg({ ...editingAg, responsible: e.target.value })} />
              </div>
              <div className="col-span-2 flex items-center gap-3 rounded-lg border border-border/40 bg-background/30 px-3 py-2.5">
                <input id="agdone" type="checkbox" className="h-4 w-4" checked={!!editingAg.done} onChange={(e) => setEditingAg({ ...editingAg, done: e.target.checked, not_done_reason: e.target.checked ? null : editingAg.not_done_reason })} />
                <Label htmlFor="agdone" className="cursor-pointer">Reunião realizada</Label>
              </div>
              {!editingAg.done && (
                <div className="col-span-2">
                  <Label>Motivo de não realizada</Label>
                  <Input
                    placeholder="Ex.: Próximo mês, cliente cancelou..."
                    value={editingAg.not_done_reason || ""}
                    onChange={(e) => setEditingAg({ ...editingAg, not_done_reason: e.target.value })}
                  />
                </div>
              )}
              <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={editingAg.observations || ""} onChange={(e) => setEditingAg({ ...editingAg, observations: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenAg(false)}>Cancelar</Button>
            <Button onClick={saveAg} className="bg-gradient-to-r from-primary to-fuchsia-600">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo mês de engajamento */}
      <Dialog open={newMonthOpen} onOpenChange={setNewMonthOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" /> Novo mês de engajamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Vamos criar um registro para <strong className="text-primary">cada cliente cadastrado</strong> ({clients.length}) neste mês.
              Você só vai precisar editar ABC, Sprint, engajamento e NPS de cada um.
            </p>
            <div>
              <Label>Mês *</Label>
              <Input type="month" value={newMonthValue} onChange={(e) => setNewMonthValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewMonthOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMonthFromClients(newMonthValue)} className="bg-gradient-to-r from-primary to-fuchsia-600">
              Carregar {clients.length} clientes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {purgeMonth && (
        <ActionVerificationDialog
          open={!!purgeMonth}
          onOpenChange={(o) => !o && setPurgeMonth(null)}
          action="purge_squad_engagement_month"
          payload={{ squad_id: squadId, reference_month: purgeMonth }}
          targetLabel={`Engajamento de ${formatMonth(purgeMonth)}`}
          title="Excluir mês definitivamente"
          successMessage="Mês excluído"
          onSuccess={() => { setPurgeMonth(null); void loadAll(squadId); }}
        />
      )}

      <AlertDialog open={!!confirmDeleteClient} onOpenChange={(o) => !o && setConfirmDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteClient
                ? `"${confirmDeleteClient.name}" será movido para a aba Churn com o mês atual. Você poderá editar o motivo lá.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={performClientDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir e mover para Churn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub, delta }: { label: string; value: number | string; icon: any; color: string; sub?: string; delta?: number | null }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-4 shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {delta != null && delta !== 0 && (
            <p className={`text-[10px] font-semibold mt-0.5 ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {delta > 0 ? "↑" : "↓"} {delta > 0 ? "+" : ""}{delta} vs mês anterior
            </p>
          )}
          {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5 capitalize">{sub}</p>}
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
  const m = String(d).match(/^(\d{4})-(\d{2})/);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function monthsBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ma = String(a).match(/^(\d{4})-(\d{2})/);
  const mb = String(b).match(/^(\d{4})-(\d{2})/);
  if (!ma || !mb) return null;
  const diff = (Number(mb[1]) - Number(ma[1])) * 12 + (Number(mb[2]) - Number(ma[2]));
  return Math.max(0, diff);
}

function AgendaPanel({
  agenda, clients, squadId, activeClientsCount, onNew, onEdit, onRemove, onToggleDone,
}: {
  agenda: Agenda[];
  clients: SquadClient[];
  squadId: string;
  activeClientsCount: number;
  onNew: () => void;
  onEdit: (a: Agenda) => void;
  onRemove: (id: string) => void;
  onToggleDone: (a: Agenda) => void;
}) {
  const months = useMemo(() => {
    const set = new Set<string>();
    agenda.forEach((a) => a.reference_month && set.add(a.reference_month.slice(0, 7)));
    const cur = new Date().toISOString().slice(0, 7);
    set.add(cur);
    return Array.from(set).sort().reverse();
  }, [agenda]);

  const [month, setMonth] = useState<string>(months[0] || new Date().toISOString().slice(0, 7));
  const [agendaMissing, setAgendaMissing] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  useEffect(() => {
    if (!months.includes(month) && months[0]) setMonth(months[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months.join(",")]);

  const filtered = useMemo(
    () => agenda.filter((a) => a.reference_month?.startsWith(month)),
    [agenda, month]
  );

  // Só clientes que JÁ TÊM mensal marcada na agenda deste mês (para o "Iniciar Mensal")
  const meetingOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    filtered.forEach((a) => {
      const nm = (a.client_name || "").trim();
      if (!nm) return;
      const key = nm.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ id: a.id, name: nm });
    });
    return out.sort((x, y) => x.name.localeCompare(y.name));
  }, [filtered]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((a) => a.done).length;
    const justified = filtered.filter((a) => !a.done && (a.not_done_reason || "").trim().length > 0).length;
    const scheduled = filtered.filter((a) => !a.done && !!a.meeting_date).length;
    const overdueUnjustified = filtered.filter((a) => {
      if (a.done) return false;
      if ((a.not_done_reason || "").trim().length > 0) return false;
      if (!a.meeting_date) return true; // sem data e não justificada
      const d = new Date(a.meeting_date + "T12:00:00Z");
      return d < today;
    }).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    // ── Entrega de mensais sobre a BASE ELEGÍVEL (D+30) ──
    const ymf = (d: string | null | undefined) => (d || "").slice(0, 7);
    const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
    const clientsWithEntry = clients.filter((c) => !!c.entry_date).length;
    const eligible = clients.filter((c) => c.entry_date && ymf(c.entry_date) < month);
    const deliveredNames = new Set(
      filtered.filter((a) => a.done).map((a) => norm(a.client_name)).filter(Boolean)
    );
    const deliveredEligible = eligible.filter((c) => deliveredNames.has(norm(c.name)));
    const missedEligible = eligible.filter((c) => !deliveredNames.has(norm(c.name)));
    const deliveryRate = eligible.length > 0 ? Math.round((deliveredEligible.length / eligible.length) * 100) : 0;
    return {
      total, done, justified, scheduled, overdueUnjustified, pct,
      eligible, deliveredEligible, missedEligible, deliveryRate,
      missingEntry: clientsWithEntry === 0,
    };
  }, [filtered, clients, month]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-56 bg-card/40 backdrop-blur-sm">
            <SelectValue placeholder="Mês de referência" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {new Date(m + "-01T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => setMeetingOpen(true)} className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 shadow-lg shadow-emerald-500/20">
          <Play className="h-4 w-4" /> Iniciar Mensal
        </Button>
        <MonthlyMeetingDialog
          open={meetingOpen}
          onClose={() => setMeetingOpen(false)}
          squadId={squadId}
          referenceMonth={month}
          clients={meetingOptions}
        />
        <Button onClick={onNew} className="gap-1.5 bg-gradient-to-r from-primary to-fuchsia-600 hover:opacity-90 shadow-lg shadow-primary/30"><Plus className="h-4 w-4" /> Novo Alinhamento Mensal</Button>
      </div>

      {stats.missingEntry ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          ⚠️ Para a meta de mensais entregues (clientes ativos há +30 dias), preencha a <strong>Data de entrada</strong> dos clientes na aba <strong>Clientes</strong>.
        </div>
      ) : (
        <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
          stats.deliveryRate >= 80 ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"
        }`}>
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mensais entregues (D+30)</p>
              <p className={`text-2xl font-black mt-0.5 ${stats.deliveryRate >= 80 ? "text-emerald-300" : "text-red-300"}`}>
                {stats.deliveryRate}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stats.deliveredEligible.length} de {stats.eligible.length} clientes elegíveis ·{" "}
                <button onClick={() => setAgendaMissing(true)} className="text-primary hover:underline">{stats.missedEligible.length} faltaram</button>
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
            stats.deliveryRate >= 80
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-red-500/40 bg-red-500/15 text-red-300"
          }`}>
            {stats.deliveryRate >= 80 ? "✓ Dentro da meta" : "⚠ Abaixo da meta"} · alvo ≥ 80%
          </span>
        </div>
      )}

      <Dialog open={agendaMissing} onOpenChange={setAgendaMissing}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clientes sem mensal entregue · {new Date(month + "-01T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            {stats.missedEligible.length === 0 ? (
              <p className="text-sm text-emerald-300 text-center py-4">Todos os elegíveis tiveram a mensal entregue! 🎉</p>
            ) : (
              stats.missedEligible.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="outline" className="border-red-500/40 text-red-300">sem mensal</Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryStat label="Marcadas" value={stats.total} tone="primary" />
        <SummaryStat label="Realizadas" value={stats.done} tone="emerald" />
        <SummaryStat label="A fazer" value={stats.scheduled} tone="sky" />
        <SummaryStat label="Justificadas" value={stats.justified} tone="amber" />
        <SummaryStat label="% Calls" value={`${stats.pct}%`} tone="primary" />
      </div>

      {stats.overdueUnjustified > 0 && (
        <div className="alert-blink rounded-xl border border-red-500/40 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-300" />
          <p className="text-sm">
            <strong>{stats.overdueUnjustified}</strong> mensal{stats.overdueUnjustified > 1 ? "is" : ""} sem realizar e sem justificativa neste mês de referência.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-x-auto shadow-xl">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="text-center">OK</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Status / Motivo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Nenhum compromisso neste mês.</TableCell></TableRow>
            ) : filtered.map((a) => {
              const d = a.meeting_date ? new Date(a.meeting_date + "T12:00:00Z") : null;
              const overdue = !a.done && (!a.not_done_reason || !a.not_done_reason.trim()) && (!d || d < today);
              return (
                <TableRow key={a.id} className={`border-border/20 ${overdue ? "alert-blink" : ""}`}>
                  <TableCell className="text-center">
                    <button onClick={() => onToggleDone(a)} title="Marcar como realizada">
                      {a.done
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        : <XCircle className="h-4 w-4 text-muted-foreground/50" />}
                    </button>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="bg-muted/40">{a.category || "-"}</Badge></TableCell>
                  <TableCell className="font-semibold">{a.client_name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{a.responsible || "-"}</TableCell>
                  <TableCell>
                    {d ? (
                      <div className="flex flex-col leading-tight">
                        <span className="text-base font-bold text-foreground">{d.toLocaleDateString("pt-BR", { day: "2-digit" })}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {a.meeting_time ? (
                      <span className="inline-block rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-sm font-bold text-primary tabular-nums">
                        {a.meeting_time.slice(0, 5)}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">-</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.done ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Realizada</Badge>
                    ) : a.not_done_reason ? (
                      <span className="text-amber-300" title={a.not_done_reason}>{a.not_done_reason}</span>
                    ) : (
                      <Badge className="bg-red-500/30 text-red-200 border-red-500/40 gap-1"><AlertCircle className="h-3 w-3" /> Sem motivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => onEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onRemove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number | string; tone: "primary" | "emerald" | "sky" | "amber" }) {
  const cls = {
    primary: "from-primary to-fuchsia-600",
    emerald: "from-emerald-500 to-teal-600",
    sky: "from-sky-500 to-blue-600",
    amber: "from-amber-500 to-orange-600",
  }[tone];
  return (
    <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-4 shadow-lg">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${cls} bg-clip-text text-transparent`}>{value}</p>
    </div>
  );
}

// ===== ServiceFunnel: pretty trapezoidal funnel with details per bucket =====
type FunnelRow = {
  bucket: 1 | 2 | 3;
  label: string;
  count: number;
  pct: number;
  clients: { name: string; services: string[] }[];
  svcCounts: Record<string, number>;
};
function ServiceFunnel({ data }: { data: FunnelRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 560, rowH = 92, gap = 4;
  const H = data.length * (rowH + gap);
  const palette: Record<number, { stroke: string; from: string; to: string; tag: string }> = {
    1: { stroke: "263 70% 58%", from: "263 70% 62%", to: "263 80% 45%", tag: "text-primary" },
    2: { stroke: "295 70% 60%", from: "295 75% 65%", to: "295 80% 48%", tag: "text-fuchsia-300" },
    3: { stroke: "160 70% 45%", from: "160 65% 52%", to: "160 75% 38%", tag: "text-emerald-300" },
  };
  const widths = data.map((d) => Math.max(140, (d.count / max) * (W - 40) + 80));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* SVG funnel */}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            {data.map((d) => (
              <linearGradient key={`g${d.bucket}`} id={`grad-${d.bucket}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={`hsl(${palette[d.bucket].from})`} stopOpacity="0.95" />
                <stop offset="100%" stopColor={`hsl(${palette[d.bucket].to})`} stopOpacity="0.95" />
              </linearGradient>
            ))}
          </defs>
          {data.map((d, i) => {
            const w = widths[i];
            const next = widths[i + 1] ?? Math.max(80, w * 0.6);
            const x1 = (W - w) / 2;
            const x2 = (W - next) / 2;
            const y = i * (rowH + gap);
            const path = `M${x1},${y} L${x1 + w},${y} L${x2 + next},${y + rowH} L${x2},${y + rowH} Z`;
            return (
              <g key={d.bucket}>
                <path d={path} fill={`url(#grad-${d.bucket})`} stroke={`hsl(${palette[d.bucket].stroke})`} strokeWidth={1.5} />
                <text x={W / 2} y={y + rowH / 2 - 6} textAnchor="middle" className="fill-white" style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>
                  {d.label}
                </text>
                <text x={W / 2} y={y + rowH / 2 + 18} textAnchor="middle" className="fill-white/85" style={{ fontSize: 13, fontWeight: 600 }}>
                  {d.count} cliente{d.count === 1 ? "" : "s"} · {d.pct}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Side details */}
      <div className="space-y-3">
        {data.map((d) => {
          const p = palette[d.bucket];
          return (
            <div key={d.bucket} className="rounded-xl border bg-card/60 backdrop-blur-sm p-3 shadow-sm" style={{ borderColor: `hsl(${p.stroke} / 0.4)` }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${p.from})` }} />
                  <span className="text-sm font-bold">{d.label}</span>
                </div>
                <span className={`text-xs font-bold ${p.tag}`}>{d.count} ({d.pct}%)</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {(["TP", "CRM", "COM"] as const).map((s) => (
                  d.svcCounts[s] ? (
                    <Badge key={s} variant="outline" className={`${SERVICE_COLORS[s]} text-[10px] font-semibold`}>
                      {s} · {d.svcCounts[s]}
                    </Badge>
                  ) : null
                ))}
                {Object.values(d.svcCounts).every((v) => !v) && (
                  <span className="text-[11px] text-muted-foreground">Sem serviços neste grupo</span>
                )}
              </div>
              {d.clients.length > 0 && (
                <details className="mt-2 group">
                  <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition">
                    Ver clientes ({d.clients.length})
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1">
                    {d.clients.map((c, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-[11px] bg-background/50 rounded px-2 py-1">
                        <span className="font-medium truncate" title={c.name}>{c.name}</span>
                        <span className="flex gap-0.5 shrink-0">
                          {c.services.map((s) => (
                            <Badge key={s} variant="outline" className={`${SERVICE_COLORS[s]} text-[9px] px-1 py-0`}>{s}</Badge>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== MetricsOverview: charts for monthly metrics =====
function MetricsOverview({ metrics }: { metrics: Metric[] }) {
  if (!metrics.length) return null;
  const sorted = [...metrics].sort((a, b) => (a.reference_month || "").localeCompare(b.reference_month || ""));
  const data = sorted.map((m) => ({
    mes: formatMonth(m.reference_month),
    Ativos: m.active_clients ?? 0,
    Churn: m.churn_count ?? 0,
    Entradas: m.new_clients ?? 0,
    Renov: m.renewals ?? 0,
    Mensais: m.monthly_clients ?? 0,
    Calls: m.calls_delivered_pct != null ? Math.round(Number(m.calls_delivered_pct) * 100) : 0,
  }));
  const last = sorted[sorted.length - 1];
  const totals = {
    ativos: last.active_clients ?? 0,
    churn: sorted.reduce((s, m) => s + (m.churn_count ?? 0), 0),
    entradas: sorted.reduce((s, m) => s + (m.new_clients ?? 0), 0),
    callsMedia: Math.round(
      (sorted.reduce((s, m) => s + (m.calls_delivered_pct != null ? Number(m.calls_delivered_pct) : 0), 0) /
        sorted.length) * 100
    ),
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat label="Ativos (último mês)" value={totals.ativos} tone="emerald" />
        <SummaryStat label="Entradas (acum.)" value={`+${totals.entradas}`} tone="primary" />
        <SummaryStat label="Churn (acum.)" value={totals.churn} tone="amber" />
        <SummaryStat label="% Calls (média)" value={`${totals.callsMedia}%`} tone="sky" />
      </div>
      <Card className="bg-card/40 backdrop-blur-sm border-border/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Evolução mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="Ativos" stroke="hsl(160 70% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Mensais" stroke="hsl(263 70% 58%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Churn" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Entradas" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card/40 backdrop-blur-sm border-border/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> % Calls entregues por mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="Calls" radius={[6, 6, 0, 0]}>
                  {data.map((_, i) => <Cell key={i} fill="hsl(263 70% 58%)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== NpsChart: distribution of engagement NPS individual scores =====
function NpsChart({ dist }: { dist: {
  total: number; buckets: { score: number; count: number }[];
  pctAbove8: number; pctTen: number; pctBelow7: number;
  above8: number; tens: number; below7: number; middle: number;
  npsScore: number; avg: number;
  monthly: { mes: string; mediaNota: number; pctAcima8: number; nps: number }[];
} }) {
  const data = dist.buckets.map((b) => ({
    nota: b.score.toString(),
    Respostas: b.count,
    color: b.score === 10 ? "hsl(160 75% 38%)" : b.score > 8 ? "hsl(160 70% 50%)" : b.score < 7 ? "hsl(0 84% 60%)" : "hsl(38 92% 55%)",
  }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat label="Notas coletadas" value={dist.total} tone="primary" />
        <SummaryStat label="Média das notas" value={dist.total ? dist.avg.toFixed(1) : "—"} tone="sky" />
        <SummaryStat label="% acima de 8" value={`${dist.pctAbove8}%`} tone="emerald" />
        <SummaryStat label="% nota 10" value={`${dist.pctTen}%`} tone="amber" />
      </div>

      <Card className="bg-card/40 backdrop-blur-sm border-border/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Smile className="h-4 w-4 text-primary" /> % de NPS — distribuição das notas (Engajamento)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Categorias: <strong className="text-emerald-300">Acima de 8</strong> · <strong className="text-emerald-400">Nota 10</strong> · <strong className="text-red-300">Abaixo de 7</strong>. Meta: nota acima de <strong>8</strong>.
          </p>
        </CardHeader>
        <CardContent>
          {dist.total === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Sem notas registradas. Adicione NPS individuais na aba Engajamento.
            </p>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis dataKey="nota" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="Respostas" radius={[6, 6, 0, 0]}>
                      {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-[11px] uppercase text-emerald-300/80">Acima de 8</p>
                  <p className="text-xl font-bold text-emerald-300">{dist.above8} <span className="text-xs font-normal text-emerald-300/60">({dist.pctAbove8}%)</span></p>
                </div>
                <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 p-3">
                  <p className="text-[11px] uppercase text-emerald-300/80">Nota 10</p>
                  <p className="text-xl font-bold text-emerald-300">{dist.tens} <span className="text-xs font-normal text-emerald-300/60">({dist.pctTen}%)</span></p>
                </div>
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-[11px] uppercase text-red-300/80">Abaixo de 7</p>
                  <p className="text-xl font-bold text-red-300">{dist.below7} <span className="text-xs font-normal text-red-300/60">({dist.pctBelow7}%)</span></p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-primary/80">NPS final</p>
                  <p className="text-3xl font-bold text-primary mt-0.5">{dist.npsScore}</p>
                </div>
                <p className="text-xs text-muted-foreground max-w-xs text-right">
                  (Acima de 8 − Abaixo de 7) ÷ Total × 100
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {dist.monthly.length > 0 && (
        <Card className="bg-card/40 backdrop-blur-sm border-border/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Evolução mensal do NPS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dist.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="mediaNota" name="Média da nota" stroke="hsl(263 70% 58%)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="pctAcima8" name="% acima de 8" stroke="hsl(160 70% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="nps" name="NPS" stroke="hsl(38 92% 55%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChurnPanel({
  churns, clients, activeClientsCount, onNew, onEdit, onRemove,
}: {
  churns: Churn[];
  clients: SquadClient[];
  activeClientsCount: number;
  onNew: () => void;
  onEdit: (c: Churn) => void;
  onRemove: (id: string) => void;
}) {
  // Filtro por mês de saída
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const monthOptions = useMemo(() => {
    const set = new Set(churns.map((c) => (c.churn_month || "").slice(0, 7)).filter(Boolean));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [churns]);
  const filteredChurns = useMemo(
    () => (monthFilter === "all" ? churns : churns.filter((c) => (c.churn_month || "").slice(0, 7) === monthFilter)),
    [churns, monthFilter]
  );
  // Resumo de motivos das saídas (do conjunto filtrado)
  const reasonBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredChurns.forEach((c) => {
      const r = (c.reason || "").trim() || "Sem motivo informado";
      map.set(r, (map.get(r) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredChurns]);

  // Taxa de churn do mês com BASE ELEGÍVEL (D+30): só conta clientes ativos há ≥30 dias
  // (entraram ANTES do mês analisado). Novos do mês não entram na conta.
  const ym = (d: string | null | undefined) => (d || "").slice(0, 7);
  const monthStats = useMemo(() => {
    if (monthFilter === "all") return null;
    const M = monthFilter;
    // Quantos clientes têm data de entrada preenchida (pra avisar se faltar)
    const clientsWithEntry = clients.filter((c) => !!c.entry_date).length;
    // Base elegível = ativos que entraram antes de M + churns que saíram em M ou depois e entraram antes de M
    const activeEnteredBefore = clients.filter((c) => c.entry_date && ym(c.entry_date) < M).length;
    const churnedLaterEnteredBefore = churns.filter(
      (ch) => ym(ch.entry_month) && ym(ch.entry_month) < M && ym(ch.churn_month) >= M
    ).length;
    const eligibleBase = activeEnteredBefore + churnedLaterEnteredBefore;
    // Saídas do mês que eram elegíveis (entraram antes de M)
    const eligibleChurns = churns.filter(
      (ch) => ym(ch.churn_month) === M && ym(ch.entry_month) && ym(ch.entry_month) < M
    ).length;
    const totalChurnsMonth = churns.filter((ch) => ym(ch.churn_month) === M).length;
    const rate = eligibleBase > 0 ? (eligibleChurns / eligibleBase) * 100 : 0;
    return {
      M, eligibleBase, eligibleChurns, totalChurnsMonth, rate,
      withinTarget: rate <= 5,
      missingEntryData: clientsWithEntry === 0,
    };
  }, [monthFilter, clients, churns]);

  // Group churns by churn_month (YYYY-MM)
  const grouped = useMemo(() => {
    const map = new Map<string, Churn[]>();
    for (const c of filteredChurns) {
      const key = c.churn_month ? c.churn_month.slice(0, 7) : "sem-data";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredChurns]);

  // Compute active base per month: current active + churns occurring on/after that month
  const totalChurns = churns.length;
  const baselineActive = activeClientsCount; // current active

  const totalRate = baselineActive + totalChurns > 0
    ? (totalChurns / (baselineActive + totalChurns)) * 100
    : 0;

  // Average lifetime (in months) of churned clients
  const lifetimes = churns
    .map((c) => monthsBetween(c.entry_month, c.churn_month))
    .filter((n): n is number => n != null && n >= 0);
  const avgLifetime = lifetimes.length > 0
    ? lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length
    : null;

  // LTV per churn = contract_value * months_active
  const ltvList = churns.map((c) => {
    const m = monthsBetween(c.entry_month, c.churn_month);
    if (c.contract_value == null || m == null || m < 0) return null;
    return c.contract_value * m;
  });
  const validLtvs = ltvList.filter((n): n is number => n != null);
  const totalLtv = validLtvs.reduce((a, b) => a + b, 0);
  const avgLtv = validLtvs.length > 0 ? totalLtv / validLtvs.length : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card/40 border-border/30">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Clientes ativos</p>
            <p className="text-3xl font-bold mt-1">{activeClientsCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/30">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total de churns</p>
            <p className="text-3xl font-bold text-red-300 mt-1">{totalChurns}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/30">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Taxa acumulada</p>
            <p className="text-3xl font-bold text-amber-300 mt-1">{totalRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/30">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Lifetime médio</p>
            <p className="text-3xl font-bold text-emerald-300 mt-1">
              {avgLifetime != null ? `${avgLifetime.toFixed(1)} ${avgLifetime === 1 ? "mês" : "meses"}` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Média de meses ativos dos {lifetimes.length} {lifetimes.length === 1 ? "churn" : "churns"} com datas
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/30">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">LTV total</p>
            <p className="text-2xl font-bold text-emerald-300 mt-1">
              {validLtvs.length > 0 ? formatBRL(totalLtv) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Média {avgLtv != null ? formatBRL(avgLtv) : "—"} · {validLtvs.length} {validLtvs.length === 1 ? "cliente" : "clientes"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro por mês + motivos das saídas */}
      <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <Label className="text-xs text-muted-foreground">Mês da saída:</Label>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[200px] bg-card/40 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">{formatMonth(`${m}-01`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {filteredChurns.length} {filteredChurns.length === 1 ? "saída" : "saídas"}
            </span>
          </div>
          <Button onClick={onNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo churn
          </Button>
        </div>

        {monthStats && (
          monthStats.missingEntryData ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              ⚠️ Para calcular a taxa de churn do mês (base de clientes ativos há +30 dias), preencha a
              <strong> Data de entrada</strong> dos clientes na aba <strong>Clientes</strong>.
            </div>
          ) : (
            <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
              monthStats.withinTarget
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-red-500/40 bg-red-500/10"
            }`}>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Taxa de churn · {formatMonth(`${monthStats.M}-01`)}
                </p>
                <p className={`text-3xl font-black mt-0.5 ${monthStats.withinTarget ? "text-emerald-300" : "text-red-300"}`}>
                  {monthStats.rate.toFixed(1)}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {monthStats.eligibleChurns} de {monthStats.eligibleBase} clientes elegíveis (ativos há +30 dias, sem os novos do mês)
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  monthStats.withinTarget
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-red-500/40 bg-red-500/15 text-red-300"
                }`}>
                  {monthStats.withinTarget ? "✓ Dentro da meta" : "⚠ Acima da meta"} · alvo ≤ 5%
                </span>
                {!monthStats.withinTarget && (
                  <p className="text-[11px] text-red-300/80 mt-1.5">
                    {(monthStats.rate - 5).toFixed(1)}% acima do limite
                  </p>
                )}
              </div>
            </div>
          )
        )}

        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Motivos das saídas</p>
          {reasonBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma saída no período.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {reasonBreakdown.map(([reason, count]) => (
                <div
                  key={reason}
                  className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1.5"
                >
                  <span className="text-xs text-red-200">{reason}</span>
                  <span className="text-xs font-bold text-red-300 bg-red-500/20 rounded px-1.5">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-12 text-center text-muted-foreground">
          Nenhum churn registrado.
        </div>
      ) : grouped.map(([monthKey, items], idx) => {
        // Active base for that month = current active + churns from that month onward (back in time)
        const churnsFromThisMonthOnward = churns.filter((c) => {
          const k = c.churn_month?.slice(0, 7) || "";
          return k && k >= monthKey;
        }).length;
        const baseForMonth = baselineActive + churnsFromThisMonthOnward;
        const rate = baseForMonth > 0 ? (items.length / baseForMonth) * 100 : 0;
        const rateColor = rate >= 10 ? "text-red-300 bg-red-500/15 border-red-500/30"
          : rate >= 5 ? "text-amber-300 bg-amber-500/15 border-amber-500/30"
          : "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";

        return (
          <div key={monthKey} className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/30 bg-muted/10">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold capitalize">{formatMonth(`${monthKey}-01`)}</span>
                <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/30">
                  {items.length} {items.length === 1 ? "churn" : "churns"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Taxa de churn</span>
                <Badge className={rateColor}>{rate.toFixed(1)}%</Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/30">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Mês entrada</TableHead>
                    <TableHead>Meses vigentes</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>LTV</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => {
                    const m = monthsBetween(c.entry_month, c.churn_month);
                    const ltv = c.contract_value != null && m != null && m >= 0 ? c.contract_value * m : null;
                    return (
                      <TableRow key={c.id} className="border-border/20">
                        <TableCell className="font-semibold">{c.client_name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatMonth(c.entry_month)}</TableCell>
                        <TableCell><Badge variant="outline">{c.months_active || "-"}</Badge></TableCell>
                        <TableCell className="text-xs">{c.contract_value != null ? formatBRL(c.contract_value) : "-"}</TableCell>
                        <TableCell className="text-xs font-semibold text-emerald-300">{ltv != null ? formatBRL(ltv) : "-"}</TableCell>
                        <TableCell className="text-xs">{c.reason || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{c.observations || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => onEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => onRemove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
