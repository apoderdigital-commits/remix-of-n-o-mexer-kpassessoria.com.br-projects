import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertCircle, AlertTriangle, ArrowLeft, BarChart3, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, DollarSign, FileText, Folder, FolderOpen, Gauge, MessageSquare, NotebookPen, Pencil, Play, Plus, Search, Settings, ShoppingCart, Smile, Star, Store, Target, Trash2, TrendingDown, TrendingUp, Users, XCircle, SlidersHorizontal } from "lucide-react";
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
  meta_vendas_trafego: number | null;
  meta_vendas_loja: number | null;
  contract_file_url: string | null;
  contract_file_name: string | null;
  strategy_file_url: string | null;
  strategy_file_name: string | null;
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
  engagement_score: number | null; nps_individual: number | null; crm_usage: number | null; observation: string | null;
  plano_estrategico: boolean | null; plano_estrategico_link: string | null; conversao_comercial: number | null;
  meta_status: string | null;
  meta_vendas: number | null; meta_vendas_trafego: number | null; meta_vendas_loja: number | null; meta_faturamento: number | null;
  vendas: number | null; vendas_trafego: number | null; vendas_loja: number | null;
  vendas_por_canais: string | null; vendas_perc_canais: string | null;
  faturamento: number | null; faturamento_por_canais: string | null; faturamento_perc_canais: string | null;
  venda_secundaria: number | null;
};
type Agenda = {
  id: string; squad_id: string; reference_month: string;
  category: string | null; client_name: string; responsible: string | null;
  meeting_date: string | null; meeting_time: string | null; done: boolean;
  observations: string | null; not_done_reason: string | null;
};

const emptyClient: Partial<SquadClient> = {
  name: "", niche: "", services: "", curve_abc: "", sprint: "",
  invested_tp: "", contract_value: null, sales_goal: null, meta_vendas_trafego: null, meta_vendas_loja: null, observations: "", renewal_60d: false, bm_verified: false,
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
  AA: "bg-red-500/40 text-red-900 dark:text-red-100 border-red-500/60",
  AB: "bg-orange-500/40 text-orange-900 dark:text-orange-100 border-orange-500/60",
  AC: "bg-amber-500/40 text-amber-900 dark:text-amber-100 border-amber-500/60",
  BA: "bg-yellow-500/40 text-yellow-900 dark:text-yellow-100 border-yellow-500/60",
  BB: "bg-lime-500/40 text-lime-900 dark:text-lime-100 border-lime-500/60",
  BC: "bg-emerald-500/40 text-emerald-900 dark:text-emerald-100 border-emerald-500/60",
  CA: "bg-teal-500/40 text-teal-900 dark:text-teal-100 border-teal-500/60",
  CB: "bg-sky-500/40 text-sky-900 dark:text-sky-100 border-sky-500/60",
  CC: "bg-blue-500/40 text-blue-900 dark:text-blue-100 border-blue-500/60",
};

const CURVE_COLORS: Record<string, string> = {
  A: "bg-primary/40 text-primary-foreground dark:text-primary border-primary/60",
  B: "bg-fuchsia-500/40 text-fuchsia-900 dark:text-fuchsia-100 border-fuchsia-500/60",
  C: "bg-slate-500/40 text-slate-900 dark:text-slate-100 border-slate-500/60",
};

const SERVICE_OPTIONS = [
  { code: "TP", label: "Tráfego Pago" },
  { code: "CRM", label: "CRM" },
  { code: "COM", label: "Acomp. Comercial" },
] as const;

const SERVICE_COLORS: Record<string, string> = {
  TP: "bg-primary/40 text-primary-foreground dark:text-primary border-primary/60",
  CRM: "bg-fuchsia-500/40 text-fuchsia-900 dark:text-fuchsia-100 border-fuchsia-500/60",
  COM: "bg-emerald-500/40 text-emerald-900 dark:text-emerald-100 border-emerald-500/60",
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
  const npsTone = nps == null ? "text-muted-foreground" : nps > 8 ? "text-emerald-600 dark:text-emerald-400" : nps < 7 ? "text-red-400" : "text-amber-600 dark:text-amber-400";
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
              <Star key={i} className={`h-3 w-3 ${i < engStars ? "fill-amber-400 text-amber-600 dark:text-amber-400" : "text-muted-foreground/25"}`} />
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
              <p className="text-[10px] uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Faturamento</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">{fmtBRL(e.faturamento)}</p>
              <div className="text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span className="flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5 text-sky-400" />Tráfego</span><span>{fmtBRL(ch.fatTrafego)}</span></div>
                <div className="flex justify-between"><span className="flex items-center gap-1"><Store className="h-2.5 w-2.5 text-fuchsia-400" />Loja</span><span>{fmtBRL(ch.fatLoja)}</span></div>
              </div>
            </div>
          </div>
          {e.meta_status && (
            <Badge variant="outline" className={e.meta_status.toLowerCase().includes("dentro") ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/40"}>
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
  const navigate = useNavigate();
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
  const [npsListDialog, setNpsListDialog] = useState<"responded" | "missed" | "eligible" | null>(null);
  const [ltvOpen, setLtvOpen] = useState(false);
  const [crmListDialog, setCrmListDialog] = useState<null | "using" | "not">(null);
  const [contractUploading, setContractUploading] = useState(false);
  const [strategyUploading, setStrategyUploading] = useState(false);
  const [contractViewer, setContractViewer] = useState<{ url: string; name: string; title?: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description?: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void | Promise<void> } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [npsSearch, setNpsSearch] = useState("");
  const [engShowTrash, setEngShowTrash] = useState(false);
  const [openEngMonths, setOpenEngMonths] = useState<Set<string>>(new Set());
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
    // O RLS já devolve só os squads que o usuário pode ver: admin vê todos,
    // colaborador vê apenas os que ele é membro (policy "Members view their squads").
    const { data } = await supabase.from("squads").select("*").order("name");
    setSquads(data || []);
    // Nenhum squad abre sozinho — o usuário escolhe. Exceção: quem só tem acesso a 1
    // squad não tem o que escolher, então já entra direto no dele.
    if (data && data.length === 1 && !squadId) setSquadId(data[0].id);
    setLoading(false);
  }

  async function loadAll(sid: string) {
    const [c, m, ch, n, e, a, et, s] = await Promise.all([
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
      (supabase as any).from("squad_monthly_sessions").select("*").eq("squad_id", sid),
    ]);
    setClients((c.data as unknown as SquadClient[]) || []);
    setMetrics((m.data as Metric[]) || []);
    setChurns((ch.data as Churn[]) || []);
    setNps((n.data as Nps[]) || []);
    setEngagement((e.data as Engagement[]) || []);
    setEngTrash((et?.data as Engagement[]) || []);
    setAgenda((a.data as Agenda[]) || []);
    setSessions((s?.data as any[]) || []);
  }

  // ---------- CLIENTS ----------
  function openNew() { setEditing({ ...emptyClient, squad_id: squadId }); setOpen(true); }
  function openEdit(c: SquadClient) { setEditing({ ...c }); setOpen(true); }

  // ── Contrato (PDF) do cliente — todos da dash veem; só admin anexa/remove ──
  async function uploadContract(file: File) {
    if (!editing?.id) { toast.error("Salve o cliente antes de anexar o contrato."); return; }
    setContractUploading(true);
    const path = `${squadId}/${editing.id}/${file.name}`;
    const up = await supabase.storage.from("contratos").upload(path, file, { upsert: true });
    if (up.error) { setContractUploading(false); toast.error("Erro no upload: " + up.error.message); return; }
    const res = await (supabase as any).from("squad_clients")
      .update({ contract_file_url: path, contract_file_name: file.name }).eq("id", editing.id);
    setContractUploading(false);
    if (res.error) {
      if (/contract_file/.test(res.error.message || "")) toast.error("O contrato precisa da migração (peça ao Lovable).");
      else toast.error(res.error.message);
      return;
    }
    setEditing({ ...editing, contract_file_url: path, contract_file_name: file.name });
    toast.success("Contrato anexado!");
    void loadAll(squadId);
  }

  async function removeContract() {
    if (!editing?.id || !editing.contract_file_url) return;
    await supabase.storage.from("contratos").remove([editing.contract_file_url]);
    const res = await (supabase as any).from("squad_clients")
      .update({ contract_file_url: null, contract_file_name: null }).eq("id", editing.id);
    if (res.error) { toast.error(res.error.message); return; }
    setEditing({ ...editing, contract_file_url: null, contract_file_name: null });
    toast.success("Contrato removido.");
    void loadAll(squadId);
  }

  async function openContract(path: string, name: string) {
    const { data, error } = await supabase.storage.from("contratos").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o contrato."); return; }
    setContractViewer({ url: data.signedUrl, name });
  }

  // ── Funil de projeções / Planejamento estratégico (1ª reunião) — anexo fixo no cadastro do cliente.
  //    Guardado no bucket "projecoes" (mesmo que já aceita PNG do funil). Só admin anexa/remove; todos veem. ──
  async function uploadStrategy(file: File) {
    if (!editing?.id) { toast.error("Salve o cliente antes de anexar o planejamento."); return; }
    setStrategyUploading(true);
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const base = file.name.slice(0, file.name.length - ext.length)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 60) || "planejamento";
    const path = `planejamento/${squadId}/${editing.id}/${base}${ext}`;
    const up = await supabase.storage.from("projecoes").upload(path, file, { upsert: true });
    if (up.error) { setStrategyUploading(false); toast.error("Erro no upload: " + up.error.message); return; }
    const res = await (supabase as any).from("squad_clients")
      .update({ strategy_file_url: path, strategy_file_name: file.name }).eq("id", editing.id);
    setStrategyUploading(false);
    if (res.error) {
      if (/strategy_file/.test(res.error.message || "")) toast.error("O anexo do planejamento precisa da migração (peça ao Lovable).");
      else toast.error(res.error.message);
      return;
    }
    setEditing({ ...editing, strategy_file_url: path, strategy_file_name: file.name });
    toast.success("Planejamento anexado!");
    void loadAll(squadId);
  }

  async function removeStrategy() {
    if (!editing?.id || !editing.strategy_file_url) return;
    await supabase.storage.from("projecoes").remove([editing.strategy_file_url]);
    const res = await (supabase as any).from("squad_clients")
      .update({ strategy_file_url: null, strategy_file_name: null }).eq("id", editing.id);
    if (res.error) { toast.error(res.error.message); return; }
    setEditing({ ...editing, strategy_file_url: null, strategy_file_name: null });
    toast.success("Planejamento removido.");
    void loadAll(squadId);
  }

  async function openStrategy(path: string, name: string) {
    const { data, error } = await supabase.storage.from("projecoes").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o planejamento."); return; }
    setContractViewer({ url: data.signedUrl, name, title: "Planejamento estratégico" });
  }

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
      const mvRes = await (supabase as any)
        .from("squad_clients")
        .update({ meta_vendas_trafego: editing.meta_vendas_trafego ?? null, meta_vendas_loja: editing.meta_vendas_loja ?? null })
        .eq("id", clientId);
      if (mvRes.error && /meta_vendas/.test(mvRes.error.message || "")) {
        toast("Cliente salvo. As metas de venda (tráfego/loja) precisam da migração (peça ao Lovable).");
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

  function removeMetric(id: string) {
    setConfirmDialog({
      title: "Remover esta métrica?", description: "O registro mensal será apagado. Não dá para desfazer.",
      confirmLabel: "Remover", destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from("squad_monthly_metrics").delete().eq("id", id);
        if (error) { toast.error(error.message); return; }
        void loadAll(squadId);
      },
    });
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

  function removeChurn(id: string) {
    setConfirmDialog({
      title: "Remover este registro de churn?", description: "Ele sai da lista e das taxas do mês. Não dá para desfazer.",
      confirmLabel: "Remover", destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from("squad_churn").delete().eq("id", id);
        if (error) { toast.error(error.message); return; }
        void loadAll(squadId);
      },
    });
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
  function removeNps(id: string) {
    setConfirmDialog({
      title: "Remover este NPS?", confirmLabel: "Remover", destructive: true,
      onConfirm: async () => {
        await (supabase as any).from("squad_nps").delete().eq("id", id);
        void loadAll(squadId);
      },
    });
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

    // Uso do CRM (coluna opcional) — save resiliente
    if (engSavedId && editingEng.crm_usage != null) {
      const crmRes = await (supabase as any).from("squad_engagement").update({ crm_usage: editingEng.crm_usage }).eq("id", engSavedId);
      if (crmRes.error && /crm_usage/.test(crmRes.error.message || "")) {
        toast("Salvo. O Uso do CRM precisa da migração (peça ao Lovable).");
      }
    }

    // Venda secundária / upsell do squad ao cliente em R$ (coluna opcional) — save resiliente
    if (engSavedId && editingEng.venda_secundaria != null) {
      const vsRes = await (supabase as any).from("squad_engagement").update({ venda_secundaria: editingEng.venda_secundaria }).eq("id", engSavedId);
      if (vsRes.error && /venda_secundaria/.test(vsRes.error.message || "")) {
        toast("Salvo. A Venda secundária (R$) precisa da migração (peça ao Lovable).");
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
  function removeEng(id: string) {
    setConfirmDialog({
      title: "Mover este registro para a lixeira?", description: "Dá para restaurar depois pela lixeira.",
      confirmLabel: "Mover para lixeira",
      onConfirm: async () => {
        await (supabase as any).from("squad_engagement")
          .update({ deleted_at: new Date().toISOString() }).eq("id", id);
        void loadAll(squadId);
      },
    });
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
  function trashMonth(month: string) {
    // month = "YYYY-MM"
    const ref = `${month}-01`;
    setConfirmDialog({
      title: `Mover TODOS os registros de ${month} para a lixeira?`,
      description: "Todos os engajamentos desse mês vão para a lixeira. Dá para restaurar depois.",
      confirmLabel: "Mover tudo",
      onConfirm: async () => { await doTrashMonth(ref); },
    });
  }
  async function doTrashMonth(ref: string) {
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
  function removeAg(id: string) {
    setConfirmDialog({
      title: "Remover este compromisso?", confirmLabel: "Remover", destructive: true,
      onConfirm: async () => {
        await (supabase as any).from("squad_agenda").delete().eq("id", id);
        void loadAll(squadId);
      },
    });
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
    const npsScores = rows.map((e) => e.nps_individual).filter((v): v is number => v != null);
    const avgNps = npsScores.length ? npsScores.reduce((s, v) => s + v, 0) / npsScores.length : 0;
    return { latest: highlightMonth, npsCount, avgEng, avgNps };
  }, [engagement, highlightMonth]);

  // Taxa de churn do mês selecionado — mesma regra D+30 do Fechamento:
  // conta só churns de clientes com +30 dias (entry_month < M); a base é quem
  // estava ativo antes do mês (inclui quem depois deu churn, senão a base encolhe).
  const churnKpi = useMemo(() => {
    const M = highlightMonth;
    if (!M) return null;
    const ym = (d: string | null | undefined) => (d || "").slice(0, 7);
    const count = churns.filter((ch) => ym(ch.churn_month) === M && ym(ch.entry_month) && ym(ch.entry_month) < M).length;
    const activeBefore = clients.filter((c) => c.entry_date && ym(c.entry_date) < M).length;
    const churnedLater = churns.filter((ch) => ym(ch.entry_month) && ym(ch.entry_month) < M && ym(ch.churn_month) >= M).length;
    const base = activeBefore + churnedLater;
    return { rate: base ? (count / base) * 100 : 0, count, base };
  }, [churns, clients, highlightMonth]);

  // LTV por cliente = contrato mensal × meses de casa (entrada até hoje, mês atual incluso).
  const ltvData = useMemo(() => {
    const nowYM = new Date().toISOString().slice(0, 7);
    const rows = clients.map((c) => {
      const val = Number(c.contract_value) || 0;
      const diff = monthsBetween(c.entry_date, `${nowYM}-01`);
      const months = c.entry_date && diff != null ? diff + 1 : null;
      const ltv = val > 0 && months ? val * months : null;
      return { name: c.name, val, months, ltv };
    });
    const withLtv = rows.filter((r) => r.ltv != null).sort((a, b) => (b.ltv as number) - (a.ltv as number)) as { name: string; val: number; months: number; ltv: number }[];
    const total = withLtv.reduce((sum, r) => sum + r.ltv, 0);
    const sem = rows.filter((r) => r.ltv == null).map((r) => ({
      name: r.name,
      motivo: r.val <= 0 && r.months == null ? "sem contrato e sem data de entrada" : r.val <= 0 ? "sem valor de contrato" : "sem data de entrada",
    }));
    const avgMonths = withLtv.length ? withLtv.reduce((sum, r) => sum + r.months, 0) / withLtv.length : 0;
    return { rows: withLtv, total, avg: withLtv.length ? total / withLtv.length : 0, avgMonths, sem };
  }, [clients]);

  // Resumo financeiro do squad
  const financeSummary = useMemo(() => {
    const investido = clients.reduce((s, c) => s + (parseMoney(c.invested_tp) || 0), 0);
    const contratos = clients.reduce((s, c) => s + (Number(c.contract_value) || 0), 0);
    const meta = clients.reduce((s, c) => s + (Number(c.sales_goal) || 0), 0);
    const rows = engagement.filter((e) => (e.reference_month || "").slice(0, 7) === highlightMonth);
    const faturamento = rows.reduce((s, e) => s + (Number(e.faturamento) || 0), 0);
    const ticketMedio = clients.length ? contratos / clients.length : 0;
    return { investido, contratos, meta, faturamento, ticketMedio };
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
    // Uso do CRM (nota 1-5 por cliente). "Usando" = nota >= 4. Base = elegíveis D+30.
    const CRM_OK = 4;
    const crmEntries = eligible.map((c) => {
      const r = rowByName.get(norm(c.name));
      const v = r && (r as any).crm_usage != null ? Number((r as any).crm_usage) : null;
      return { name: c.name, score: v };
    });
    const crmRatedArr = crmEntries.filter((e) => e.score != null);
    const crmUsingArr = crmEntries.filter((e) => e.score != null && (e.score as number) >= CRM_OK);
    const crmNotUsingArr = crmEntries.filter((e) => e.score == null || (e.score as number) < CRM_OK);
    const crmAvg = crmRatedArr.length ? crmRatedArr.reduce((s, e) => s + (e.score as number), 0) / crmRatedArr.length : 0;
    const crmDist = [1, 2, 3, 4, 5].map((n) => crmRatedArr.filter((e) => Math.round(e.score as number) === n).length);
    const crmUsingPct = eligible.length ? (crmUsingArr.length / eligible.length) * 100 : 0;
    return {
      M, eligibleCount: eligible.length, evaluated: engScores.length, avgEng, vendido, secondaryPct, withSecondary,
      crmRated: crmRatedArr.length, crmUsing: crmUsingArr.length, crmNotUsing: crmNotUsingArr.length,
      crmAvg, crmDist, crmUsingPct,
      crmUsingList: crmUsingArr.map((e) => e.name), crmNotUsingList: crmNotUsingArr.map((e) => e.name),
      missingEntry: clientsWithEntry === 0,
    };
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
          <Button size="icon" variant="ghost"
            title={squadId && squads.length > 1 ? "Voltar para a seleção de squad" : "Voltar ao início"}
            onClick={() => { if (squadId && squads.length > 1) setSquadId(""); else navigate("/"); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
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

      <main className="px-4 sm:px-8 py-6 max-w-[1600px] mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Sem troca de squad aqui: a escolha e feita na tela de selecao. Pra ir
              pra outro squad, o usuario volta e entra de novo na Dash do Squad. */}
          {squadId && (
            <div className="flex items-center gap-2 h-10 px-4 rounded-md border border-border/30 bg-card/40 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full" style={{ background: currentSquad?.color || "#8B5CF6" }} />
              <span className="text-sm font-medium">{currentSquad?.name}</span>
            </div>
          )}
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
        ) : !squadId ? (
          <div className="py-10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">Selecione um squad</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha qual squad você quer visualizar.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
              {squads.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSquadId(s.id)}
                  className="group w-full sm:w-64 text-left rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-5 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color || "#8B5CF6" }} />
                    <span className="font-semibold text-lg">{s.name}</span>
                  </div>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.description}</p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Abrir squad <ChevronRight className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Tabs defaultValue="clients" className="space-y-6">
            <TabsList className="bg-card/40 backdrop-blur-sm border border-border/30">
              <TabsTrigger value="clients" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Clientes</TabsTrigger>
              <TabsTrigger value="engagement" className="gap-1.5"><Star className="h-3.5 w-3.5" /> Engajamento</TabsTrigger>
              <TabsTrigger value="churn" className="gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Churn</TabsTrigger>
              <TabsTrigger value="agenda" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Agenda das Mensais</TabsTrigger>
              <TabsTrigger value="fechamento" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Fechamento Operacional</TabsTrigger>
            </TabsList>

            {/* CLIENTES */}
            <TabsContent value="clients" className="space-y-4">
              {incompleteClients.length > 0 && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 shadow-lg shadow-red-500/10 alert-blink">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-300 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-red-800 dark:text-red-200">
                        {incompleteClients.length} cliente{incompleteClients.length > 1 ? "s" : ""} com informações faltando
                      </p>
                      <p className="text-xs text-red-800/70 dark:text-red-200/70 mt-0.5">
                        Campos essenciais: nome, valor TP, serviços, Curva ABC e Sprint.
                      </p>
                      {showIncomplete && (
                        <ul className="mt-3 space-y-1 max-h-44 overflow-y-auto text-xs">
                          {incompleteClients.map(({ client, missing }) => (
                            <li key={client.id} className="flex items-center justify-between gap-3 bg-background/30 rounded-lg px-2.5 py-1.5">
                              <button onClick={() => openEdit(client)} className="font-semibold text-foreground hover:text-primary truncate text-left">
                                {client.name || "(sem nome)"}
                              </button>
                              <span className="text-red-700/80 dark:text-red-300/80 shrink-0">faltando: {missing.join(", ")}</span>
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
                    <CalendarDays className="h-5 w-5 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-amber-800 dark:text-amber-200">
                        {upcomingDue.length} contrato{upcomingDue.length > 1 ? "s" : ""} vencendo em até 30 dias
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {upcomingDue.map(({ client, days }) => (
                          <button
                            key={client.id}
                            onClick={() => openEdit(client)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 transition-colors"
                          >
                            {client.name}
                            <span className="text-amber-700/70 dark:text-amber-300/70">· {days === 0 ? "hoje" : `${days}d`}</span>
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

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                <StatCard label="Total" value={stats.total} icon={Users} color="from-emerald-500 to-teal-600" />
                <StatCard label="Prioridade AA" value={stats.aa} icon={AlertTriangle} color="from-red-500 to-orange-600" />
                <StatCard
                  label="BM Verificada"
                  value={stats.bm}
                  icon={CheckCircle2}
                  color="from-green-500 to-emerald-600"
                  tint="emerald"
                  subRaw
                  sub={stats.total > 0 ? `de ${stats.total} clientes · ${Math.round((stats.bm / stats.total) * 100)}% da carteira` : "sem clientes"}
                />
                <StatCard label="NPS ativos" value={`${engHighlights.npsCount}/${stats.total}`} icon={Smile} color="from-sky-500 to-blue-600" sub={engHighlights.latest ? formatMonth(`${engHighlights.latest}-01`) : "sem dados"} delta={engTrend?.npsDelta ?? null} />
                <StatCard label="Média Engajamento" value={engHighlights.avgEng ? engHighlights.avgEng.toFixed(1) : "—"} icon={Star} color="from-amber-500 to-yellow-600" sub={engHighlights.latest ? formatMonth(`${engHighlights.latest}-01`) : "sem dados"} delta={engTrend?.avgDelta ?? null} />
                <StatCard label="NPS Médio" value={engHighlights.avgNps ? engHighlights.avgNps.toFixed(1) : "—"} icon={Smile} color="from-indigo-500 to-violet-600" sub={engHighlights.latest ? formatMonth(`${engHighlights.latest}-01`) : "sem dados"} />
                <StatCard
                  label="Taxa de Churn"
                  value={churnKpi && churnKpi.base > 0 ? `${churnKpi.rate.toFixed(1)}%` : "—"}
                  icon={TrendingDown}
                  color="from-rose-500 to-red-600"
                  tint={churnKpi && churnKpi.base > 0 && churnKpi.rate >= 5 ? "red" : undefined}
                  subRaw
                  sub={churnKpi && churnKpi.base > 0 ? `${churnKpi.count} de ${churnKpi.base} elegíveis (D+30) · meta < 5%` : "sem base elegível no mês"}
                />
              </div>

              {/* Resumo financeiro do squad */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                  { label: "Investido TP", value: financeSummary.investido, cls: "text-emerald-700 dark:text-emerald-300", sub: "/ mês" },
                  { label: "Contratos", value: financeSummary.contratos, cls: "text-sky-700 dark:text-sky-300", sub: "/ mês" },
                  { label: "Ticket Médio", value: financeSummary.ticketMedio, cls: "text-cyan-700 dark:text-cyan-300", sub: `${clients.length} clientes` },
                  { label: "Faturamento", value: financeSummary.faturamento, cls: "text-fuchsia-700 dark:text-fuchsia-300", sub: engHighlights.latest ? formatMonth(`${engHighlights.latest}-01`) : "" },
                ].map((f) => (
                  <div key={f.label} className="rounded-2xl border border-border/30 bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm p-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
                    <p className={`text-xl font-bold mt-1 ${f.cls}`}>{formatBRL(f.value)}</p>
                    {f.sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5 capitalize">{f.sub}</p>}
                  </div>
                ))}
                <button onClick={() => setLtvOpen(true)}
                  className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-card/30 backdrop-blur-sm p-4 text-left transition hover:border-violet-500/60 hover:shadow-lg hover:shadow-violet-500/10">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">LTV da Carteira</p>
                  <p className="text-xl font-bold mt-1 text-violet-700 dark:text-violet-300">{formatBRL(ltvData.total)}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{ltvData.rows.length} clientes · clique p/ ver</p>
                </button>
                <button onClick={() => setLtvOpen(true)}
                  className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-card/30 backdrop-blur-sm p-4 text-left transition hover:border-violet-500/60 hover:shadow-lg hover:shadow-violet-500/10">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">LTV Médio</p>
                  <p className="text-xl font-bold mt-1 text-violet-700 dark:text-violet-300">{formatBRL(ltvData.avg)}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">tempo médio de contrato: {ltvData.avgMonths ? ltvData.avgMonths.toFixed(1) : "—"} meses · clique p/ ver</p>
                </button>
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
                        <TableCell className="min-w-[300px] max-w-[480px]">
                          <button onClick={() => setDetailClient(c)} className="flex items-center gap-2.5 text-left group/cli w-full min-w-0">
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
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold leading-tight truncate group-hover/cli:text-primary transition-colors" title={c.name}>{c.name}</p>
                              {c.niche && <p className="text-[11px] text-muted-foreground truncate">{c.niche}</p>}
                              {c.entry_date && (() => {
                                const dias = Math.floor((Date.now() - new Date(c.entry_date).getTime()) / 86400000);
                                if (!Number.isFinite(dias) || dias < 0) return null;
                                const meses = Math.floor(dias / 30);
                                const txt = dias === 0 ? "entrou hoje"
                                  : dias < 60 ? `${dias} ${dias === 1 ? "dia" : "dias"} com a gente`
                                  : `${dias} dias · ~${meses} ${meses === 1 ? "mês" : "meses"}`;
                                return (
                                  <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 mt-0.5 flex items-center gap-1"
                                     title={`Início: ${new Date(c.entry_date).toLocaleDateString("pt-BR")}`}>
                                    <CalendarDays className="h-3 w-3 shrink-0" /> {txt}
                                  </p>
                                );
                              })()}
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {parseServices(c.services).length === 0 ? (
                              <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 text-[10px]">faltando</Badge>
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
                            ? <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Sim</Badge>
                            : <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30 gap-1"><XCircle className="h-3 w-3" /> Não</Badge>}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {parseMoney(c.invested_tp) == null
                            ? <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 text-[10px]">faltando</Badge>
                            : <span className="text-emerald-700 dark:text-emerald-300">{formatBRL(parseMoney(c.invested_tp))}</span>}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {c.sales_goal != null
                            ? <span className="text-amber-700 dark:text-amber-300">{formatBRL(c.sales_goal)}</span>
                            : <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/40">definir</Badge>}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {(c as any).contract_file_url && (
                            <Button size="icon" variant="ghost" title="Ver contrato"
                              onClick={() => openContract((c as any).contract_file_url, (c as any).contract_file_name || "contrato")}>
                              <FileText className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {(c as any).strategy_file_url && (
                            <Button size="icon" variant="ghost" title="Ver planejamento estratégico"
                              onClick={() => openStrategy((c as any).strategy_file_url, (c as any).strategy_file_name || "planejamento")}>
                              <TrendingUp className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* Matriz de Priorização — movida da aba antiga pra dentro de Clientes */}
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
                      <p className="text-[11px] uppercase tracking-wide text-fuchsia-700/80 dark:text-fuchsia-300/80">CRM</p>
                      <p className="text-2xl font-bold mt-1 text-fuchsia-700 dark:text-fuchsia-300">{serviceCounts.CRM}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">Acomp. Comercial (COM)</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">{serviceCounts.COM}</p>
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
                          <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/40">{list.length} registros</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => restoreMonth(month)}>Restaurar mês</Button>
                          <Button size="sm" variant="outline" className="text-red-400 hover:text-red-700 dark:text-red-300" onClick={() => setPurgeMonth(`${month}-01`)}>
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
                    const isEngOpen = openEngMonths.has(month) || engMonth === month;
                    return (
                      <div key={month} className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden shadow-xl">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-primary/10 to-fuchsia-500/5 border-b border-border/30 flex-wrap">
                          <button type="button" onClick={() => setOpenEngMonths((prev) => { const nx = new Set(prev); if (nx.has(month)) nx.delete(month); else nx.add(month); return nx; })} className="flex items-center gap-2 text-left hover:opacity-80 transition">
                            <ChevronRight className={`h-4 w-4 text-primary transition-transform ${isEngOpen ? "rotate-90" : ""}`} />
                            <CalendarDays className="h-4 w-4 text-primary" />
                            <span className="font-bold capitalize">{formatMonth(`${month}-01`)}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">{isEngOpen ? "· clique p/ fechar" : "· clique p/ abrir"}</span>
                          </button>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/40">{list.length} registros</Badge>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40">NPS médio: {avgNps}</Badge>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-red-400 hover:text-red-700 dark:text-red-300" onClick={() => trashMonth(month)}>
                              <Trash2 className="h-3.5 w-3.5" /> Excluir mês
                            </Button>
                          </div>
                        </div>
                        {isEngOpen && (
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
                                          <Star key={i} className={`h-3.5 w-3.5 ${i < (e.engagement_score || 0) ? "fill-amber-400 text-amber-600 dark:text-amber-400" : "text-muted-foreground/30"}`} />
                                        ))}
                                      </span>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell className="text-center font-bold">
                                    {e.nps_individual != null ? (
                                      <Badge variant="outline" className={
                                        e.nps_individual > 8 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" :
                                        e.nps_individual < 7 ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40" :
                                        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
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
                                          {(() => {
                                            const cli = clients.find((cc) => (cc.name || "").trim().toLowerCase() === (e.client_name || "").trim().toLowerCase());
                                            const mTraf = (e as any).meta_vendas_trafego ?? (cli as any)?.meta_vendas_trafego ?? null;
                                            const mLoja = (e as any).meta_vendas_loja ?? (cli as any)?.meta_vendas_loja ?? null;
                                            const mTotal = (e as any).meta_vendas ?? ((mTraf != null || mLoja != null) ? (Number(mTraf) || 0) + (Number(mLoja) || 0) : null);
                                            return mTotal != null ? (
                                              <div className="leading-tight">
                                                <span className={`font-bold ${ch.vendasTotal >= mTotal ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                                                  {ch.vendasTotal} / {mTotal}
                                                </span>
                                                <span className="block text-[10px] text-muted-foreground">vendeu / meta</span>
                                                <span className="block text-[9px] text-muted-foreground/70">
                                                  tráf {Number(e.vendas_trafego) || 0}/{mTraf ?? "—"} · loja {Number(e.vendas_loja) || 0}/{mLoja ?? "—"}
                                                </span>
                                              </div>
                                            ) : <span className="text-muted-foreground text-[10px]">definir meta</span>;
                                          })()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {e.faturamento != null && Number(e.faturamento) > 0 ? (
                                            <div className="leading-tight">
                                              <span className="font-bold text-emerald-700 dark:text-emerald-300">{fmtBRL(e.faturamento)}</span>
                                              {ch.vendasTotal > 0 && (
                                                <span className="block text-[10px] text-muted-foreground">T {fmtBRL(ch.fatTrafego)} · L {fmtBRL(ch.fatLoja)}</span>
                                              )}
                                              {e.faturamento_perc_canais && <span className="block text-[9px] text-muted-foreground/70">{e.faturamento_perc_canais}</span>}
                                              {(e as any).meta_faturamento != null && (
                                                <span className={`block text-[9px] ${Number(e.faturamento) >= (e as any).meta_faturamento ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-amber-600/80 dark:text-amber-400/80"}`}>
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
                        )}
                      </div>
                    );
                  })
              ))}
                </>
                );
              })()}

              {/* Histórico de NPS por cliente — movido da aba "% de NPS" */}
              <div className="space-y-4 pt-5 mt-3 border-t border-border/30">
                <p className="text-sm font-semibold flex items-center gap-2"><Smile className="h-4 w-4 text-primary" /> Histórico de NPS por cliente</p>
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
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                          ⚠️ Para o fechamento de NPS (base de clientes ativos há +30 dias), preencha a <strong>Data de entrada</strong> dos clientes na aba <strong>Clientes</strong>.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                          <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ativos totais</p>
                            <p className="text-2xl font-bold mt-1 text-violet-700 dark:text-violet-300">{npsCohort.totalAtivos}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">no mês · +{npsCohort.novosNoMes} novos</p>
                          </div>
                          <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ativos elegíveis</p>
                            <p className="text-2xl font-bold mt-1">{npsCohort.eligible.length}</p>
                            <button onClick={() => setNpsListDialog("eligible")} className="text-[10px] text-primary hover:underline mt-0.5">ver lista (D+30)</button>
                          </div>
                          <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Responderam</p>
                            <p className="text-2xl font-bold mt-1 text-sky-700 dark:text-sky-300">{npsCohort.responded.length}</p>
                            <button onClick={() => setNpsListDialog("responded")} className="text-[10px] text-primary hover:underline mt-0.5">ver lista</button>
                          </div>
                          <div className={`rounded-2xl border p-4 ${npsCohort.responseRate >= 80 ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">% de resposta</p>
                            <p className={`text-2xl font-bold mt-1 ${npsCohort.responseRate >= 80 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{npsCohort.responseRate.toFixed(0)}%</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              meta ≥ 80% · <button onClick={() => setNpsListDialog("missed")} className="text-primary hover:underline">{npsCohort.missed.length} faltaram</button>
                            </p>
                          </div>
                          <div className={`rounded-2xl border p-4 ${npsCohort.avgNps >= 9 ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nota média</p>
                            <p className={`text-2xl font-bold mt-1 ${npsCohort.avgNps >= 9 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{npsCohort.avgNps ? npsCohort.avgNps.toFixed(1) : "—"}</p>
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
              </div>
            </TabsContent>

            {/* AGENDA */}
            <TabsContent value="agenda" className="space-y-4">
              <AgendaPanel
                agenda={agenda}
                sessions={sessions}
                engagement={engagement}
                clients={clients}
                squadId={squadId}
                activeClientsCount={clients.length}
                onNew={() => { setEditingAg({ reference_month: `${new Date().toISOString().slice(0, 7)}-01`, done: false }); setOpenAg(true); }}
                onEdit={(a) => { setEditingAg(a); setOpenAg(true); }}
                onRemove={removeAg}
                onToggleDone={toggleAgDone}
                onReload={() => loadAll(squadId)}
              />
            </TabsContent>

            {/* FECHAMENTO OPERACIONAL */}
            <TabsContent value="fechamento" className="space-y-4">
              <FechamentoPanel
                clients={clients}
                engagement={engagement}
                churns={churns}
                agenda={agenda}
                squadId={squadId}
                squadName={currentSquad?.name || "Squad"}
                isAdmin={isAdmin}
                onReload={() => loadAll(squadId)}
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
              {npsListDialog === "responded" ? "Clientes que responderam" : npsListDialog === "eligible" ? "Clientes elegíveis (D+30)" : "Clientes que faltaram"}
              {npsCohort ? ` · ${formatMonth(`${npsCohort.M}-01`)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            {(() => {
              const list = !npsCohort ? [] : npsListDialog === "responded" ? npsCohort.responded : npsListDialog === "eligible" ? npsCohort.eligible : npsCohort.missed;
              if (list.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente nesta lista.</p>;
              return list.map((c) => {
                const nota = npsCohort!.npsByName.get((c.name || "").trim().toLowerCase());
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/30 bg-card/40 px-3 py-2 text-sm">
                    <span className="font-medium">{c.name}</span>
                    {nota != null ? (
                      <Badge variant="outline" className={`font-bold ${nota >= 9 ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : nota < 7 ? "border-red-500/40 text-red-700 dark:text-red-300" : "border-amber-500/40 text-amber-700 dark:text-amber-300"}`}>
                        Nota {nota}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-500/40 text-red-700 dark:text-red-300">não respondeu</Badge>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista de Uso do CRM: usando / não usando */}
      <Dialog open={!!crmListDialog} onOpenChange={(o) => { if (!o) setCrmListDialog(null); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {crmListDialog === "using" ? "Clientes usando o CRM (nota ≥ 4)" : "Clientes não usando / sem nota"}
              {metricsCohort ? ` · ${formatMonth(`${metricsCohort.M}-01`)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            {(() => {
              const names = !metricsCohort ? [] : (crmListDialog === "using" ? metricsCohort.crmUsingList : metricsCohort.crmNotUsingList);
              if (names.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente nesta lista.</p>;
              return names.map((nome, i) => (
                <div key={`${nome}-${i}`} className="flex items-center justify-between rounded-lg border border-border/30 bg-card/40 px-3 py-2 text-sm">
                  <span className="font-medium">{nome}</span>
                  <Badge variant="outline" className={crmListDialog === "using" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : "border-red-500/40 text-red-700 dark:text-red-300"}>
                    {crmListDialog === "using" ? "usando" : "não confirmado"}
                  </Badge>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Visualizador do contrato — popup dentro da dash */}
      <Dialog open={!!contractViewer} onOpenChange={(o) => { if (!o) setContractViewer(null); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> {contractViewer?.title || "Contrato"}{contractViewer?.name ? ` · ${contractViewer.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {contractViewer && (
            /\.pdf(\?|$)/i.test(contractViewer.name) ? (
              <iframe src={contractViewer.url} title="Contrato" className="w-full h-[75vh] rounded-lg border border-border/30 bg-white" />
            ) : (
              <img src={contractViewer.url} alt="Contrato" className="w-full h-auto rounded-lg border border-border/30" />
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação estilizada (substitui o confirm() do navegador) */}
      <Dialog open={!!confirmDialog} onOpenChange={(o) => { if (!o && !confirmBusy) setConfirmDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog?.destructive && <AlertTriangle className="h-4 w-4 text-destructive" />}
              {confirmDialog?.title}
            </DialogTitle>
          </DialogHeader>
          {confirmDialog?.description && (
            <p className="text-sm text-muted-foreground">{confirmDialog.description}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" disabled={confirmBusy} onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button
              variant={confirmDialog?.destructive ? "destructive" : "default"}
              disabled={confirmBusy}
              onClick={async () => {
                if (!confirmDialog) return;
                setConfirmBusy(true);
                try { await confirmDialog.onConfirm(); } finally { setConfirmBusy(false); setConfirmDialog(null); }
              }}
            >
              {confirmBusy ? "Aguarde..." : (confirmDialog?.confirmLabel || "Confirmar")}
            </Button>
          </DialogFooter>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

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
              <div className="col-span-2 mt-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Financeiro · valores mensais</p>
                <div className="h-px bg-gradient-to-r from-border/60 to-transparent mt-1.5" />
              </div>
              <div>
                <Label>Valor investido TP</Label>
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
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1 font-semibold">{formatBRL(parseMoney(editing.invested_tp))}</p>
                )}
              </div>
              <div>
                <Label>Valor do contrato</Label>
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
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1 font-semibold">{formatBRL(editing.contract_value)} / mês</p>
                )}
              </div>
              <div className="col-span-2 mt-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Metas de venda</p>
                <div className="h-px bg-gradient-to-r from-border/60 to-transparent mt-1.5" />
              </div>
              <div className="col-span-2">
                <Label>Meta de faturamento <span className="font-normal text-muted-foreground">· R$ por mês</span></Label>
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
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 font-semibold">{formatBRL(editing.sales_goal)} / mês</p>
                )}
              </div>
              <div>
                <Label>Vendas Tráfego <span className="font-normal text-muted-foreground">· quantidade</span></Label>
                <Input type="number" min="0" placeholder="ex: 5" value={editing.meta_vendas_trafego ?? ""} onChange={(e) => setEditing({ ...editing, meta_vendas_trafego: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div>
                <Label>Vendas Loja <span className="font-normal text-muted-foreground">· quantidade</span></Label>
                <Input type="number" min="0" placeholder="ex: 7" value={editing.meta_vendas_loja ?? ""} onChange={(e) => setEditing({ ...editing, meta_vendas_loja: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="col-span-2 mt-2">
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, bm_verified: !editing.bm_verified })}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                    editing.bm_verified
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-border/40 bg-background/30 hover:bg-background/50"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full ${editing.bm_verified ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                      {editing.bm_verified ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </span>
                    <span className="flex flex-col text-left leading-tight">
                      <span className="text-sm font-semibold">BM Verificada</span>
                      <span className="text-[11px] text-muted-foreground">Business Manager conferida</span>
                    </span>
                  </span>
                  <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editing.bm_verified ? "bg-emerald-500" : "bg-muted-foreground/30"}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${editing.bm_verified ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </span>
                </button>
              </div>
              <div className="col-span-2"><Label>Observações</Label><Textarea rows={3} value={editing.observations || ""} onChange={(e) => setEditing({ ...editing, observations: e.target.value })} /></div>
              <div className="col-span-2 rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
                <Label className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Contrato (PDF)</Label>
                {!editing.id ? (
                  <p className="text-xs text-muted-foreground">Salve o cliente primeiro para poder anexar o contrato.</p>
                ) : (
                  <>
                    {editing.contract_file_url ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" size="sm" variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => openContract(editing.contract_file_url!, editing.contract_file_name || "contrato")}>
                          <FileText className="h-4 w-4" /> Ver contrato
                        </Button>
                        <span className="text-xs text-muted-foreground truncate max-w-[220px]">{editing.contract_file_name}</span>
                        {isAdmin && (
                          <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={removeContract}>
                            <Trash2 className="h-4 w-4" /> Remover
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum contrato anexado.</p>
                    )}
                    {isAdmin ? (
                      <Input type="file" accept="application/pdf,.pdf" disabled={contractUploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadContract(f); e.currentTarget.value = ""; }} />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Somente administradores podem anexar ou remover o contrato.</p>
                    )}
                  </>
                )}
              </div>
              <div className="col-span-2 rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
                <Label className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Funil de projeções · Planejamento estratégico</Label>
                <p className="text-[11px] text-muted-foreground -mt-1">PNG exportado do funil de projeções na 1ª reunião (planejamento estratégico do cliente).</p>
                {!editing.id ? (
                  <p className="text-xs text-muted-foreground">Salve o cliente primeiro para poder anexar o planejamento.</p>
                ) : (
                  <>
                    {editing.strategy_file_url ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" size="sm" variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => openStrategy(editing.strategy_file_url!, editing.strategy_file_name || "planejamento")}>
                          <TrendingUp className="h-4 w-4" /> Ver planejamento
                        </Button>
                        <span className="text-xs text-muted-foreground truncate max-w-[220px]">{editing.strategy_file_name}</span>
                        {isAdmin && (
                          <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={removeStrategy}>
                            <Trash2 className="h-4 w-4" /> Remover
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum planejamento anexado.</p>
                    )}
                    {isAdmin ? (
                      <Input type="file" accept="image/png,image/jpeg,image/*,application/pdf,.pdf" disabled={strategyUploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadStrategy(f); e.currentTarget.value = ""; }} />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Somente administradores podem anexar ou remover o planejamento.</p>
                    )}
                  </>
                )}
              </div>
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

      {/* LTV da carteira */}
      <Dialog open={ltvOpen} onOpenChange={setLtvOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" /> LTV da carteira · {currentSquad?.name || "Squad"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            LTV = <strong>contrato mensal × meses de casa</strong> (da entrada até hoje, mês atual incluso).
            {ltvData.rows.length} de {clients.length} clientes com LTV calculado.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Maior LTV</p>
              <p className="text-lg font-bold mt-1 text-emerald-700 dark:text-emerald-300">{ltvData.rows[0] ? formatBRL(ltvData.rows[0].ltv) : "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{ltvData.rows[0]?.name || "sem dados"}</p>
            </div>
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Menor LTV</p>
              <p className="text-lg font-bold mt-1 text-rose-700 dark:text-rose-300">{ltvData.rows.length > 1 ? formatBRL(ltvData.rows[ltvData.rows.length - 1].ltv) : "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{ltvData.rows.length > 1 ? ltvData.rows[ltvData.rows.length - 1].name : "sem dados"}</p>
            </div>
            <div className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">LTV médio</p>
              <p className="text-lg font-bold mt-1 text-violet-700 dark:text-violet-300">{formatBRL(ltvData.avg)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{ltvData.rows.length} clientes · {ltvData.avgMonths.toFixed(1)} meses médios de contrato</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Contrato/mês</TableHead>
                  <TableHead className="text-right">Meses de casa</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ltvData.rows.map((r, i) => (
                  <TableRow key={r.name} className={`border-border/20 ${i === 0 ? "bg-emerald-500/5" : i === ltvData.rows.length - 1 && ltvData.rows.length > 1 ? "bg-rose-500/5" : ""}`}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}º</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{formatBRL(r.val)}</TableCell>
                    <TableCell className="text-right">{r.months}</TableCell>
                    <TableCell className={`text-right font-semibold ${i === 0 ? "text-emerald-700 dark:text-emerald-300" : i === ltvData.rows.length - 1 && ltvData.rows.length > 1 ? "text-rose-700 dark:text-rose-300" : ""}`}>{formatBRL(r.ltv)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {ltvData.sem.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1.5">{ltvData.sem.length} cliente(s) sem LTV — falta preencher no cadastro:</p>
              <div className="flex flex-wrap gap-1.5">
                {ltvData.sem.map((x) => (
                  <Badge key={x.name} variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-200">{x.name} · {x.motivo}</Badge>
                ))}
              </div>
            </div>
          )}
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
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
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
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1 font-semibold">
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
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
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
                  <div className="space-y-1.5">
                    <Label>Uso do CRM (1-5)</Label>
                    <Input type="number" min="1" max="5" placeholder="0" value={editingEng.crm_usage ?? ""} onChange={(e) => setEditingEng({ ...editingEng, crm_usage: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                </div>
              </section>

              {/* Meta & Vendas */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
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
                  <div className="space-y-1.5 col-span-2">
                    <Label className="flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5 text-emerald-500" /> Venda secundária <span className="text-[10px] font-normal text-muted-foreground">upsell do squad ao cliente · R$ no mês</span></Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">R$</span>
                      <Input type="number" min="0" step="50" className="pl-9" placeholder="ex: 500 (chatbot, CRM, tráfego extra...)" value={editingEng.venda_secundaria ?? ""} onChange={(e) => setEditingEng({ ...editingEng, venda_secundaria: e.target.value === "" ? null : Number(e.target.value) })} />
                    </div>
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

// ── FECHAMENTO OPERACIONAL ───────────────────────────────────────────────────
type DetailRow = { name: string; badge?: string; tone?: "ok" | "bad" | "warn"; doc?: { path: string; name: string } };
type DetailGroup = { title: string; rows: DetailRow[]; empty?: string };
type FechCard = {
  label: string; value: string; ok: boolean | null; hint?: string;
  onClick?: () => void;
  toggle?: () => void;
  detail?: { title: string; groups: DetailGroup[] };
};
// Reaproveita a MESMA lógica das outras abas (base D+30, churn, uso do CRM,
// mensais, vendido, produto secundário, meta x vendeu). Preenchimento manual
// (NPS, uso do CRM, plano estratégico, conversão comercial) acontece aqui mesmo.
function FechamentoPanel({
  clients, engagement, churns, agenda, squadId, squadName, isAdmin, onReload,
}: {
  clients: SquadClient[];
  engagement: Engagement[];
  churns: Churn[];
  agenda: Agenda[];
  squadId: string;
  squadName: string;
  isAdmin: boolean;
  onReload: () => void;
}) {
  const ymf = (d: string | null | undefined) => (d || "").slice(0, 7);
  const norm = (x: string | null | undefined) => (x || "").trim().toLowerCase();

  const months = useMemo(() => {
    const set = new Set<string>();
    engagement.forEach((e) => e.reference_month && set.add(ymf(e.reference_month)));
    agenda.forEach((a) => a.reference_month && set.add(ymf(a.reference_month)));
    set.add(new Date().toISOString().slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [engagement, agenda]);

  const [month, setMonth] = useState<string>(months[0] || new Date().toISOString().slice(0, 7));
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [uploadingRow, setUploadingRow] = useState<string | null>(null);
  const [docViewer, setDocViewer] = useState<{ url: string; name: string } | null>(null);
  const [detail, setDetail] = useState<null | { title: string; groups: DetailGroup[] }>(null);
  const [cplOpen, setCplOpen] = useState(false);
  const [cplLoading, setCplLoading] = useState(false);
  const [cplData, setCplData] = useState<null | {
    since: string; until: string; cpl: number; totalSpent: number; totalLeads: number;
    detalhe: { name: string; account: string | null; spent: number; leads: number }[];
    faltaram: { name: string; account: string | null }[];
  }>(null);
  const [cpmqlOpen, setCpmqlOpen] = useState(false);
  const [cpmqlLoading, setCpmqlLoading] = useState(false);
  const [cpmqlData, setCpmqlData] = useState<null | {
    since: string; until: string; cpmql: number; totalSpent: number; totalMqls: number;
    detalhe: { name: string; account: string | null; spent: number; mqls: number; fonte: "crm" | "planilha" }[];
    semMql: { name: string; spent: number }[];
    crmCount: number; planilhaCount: number;
  }>(null);
  const [crmRatesOpen, setCrmRatesOpen] = useState(false);
  const [crmRatesLoading, setCrmRatesLoading] = useState(false);
  const [crmRates, setCrmRates] = useState<null | {
    since: string; until: string; preAtendAvg: number; convAvg: number; preAtendN: number; convN: number;
    rows: { name: string; leads: number; sim: number; aprov: number; vendas: number; preAtend: number | null; conv: number | null }[];
  }>(null);
  useEffect(() => { setCplData(null); setCpmqlData(null); setCrmRates(null); }, [month, squadId]);

  // Documentos anexados na reunião mensal (para o atalho "ver documento" no card do plano).
  const [mensalDocs, setMensalDocs] = useState<Map<string, { path: string; name: string }>>(new Map());
  useEffect(() => {
    void (async () => {
      const m = new Map<string, { path: string; name: string }>();
      // legado (preenche primeiro; será sobrescrito pela fonte atual)
      const { data } = await (supabase as any).from("squad_monthly_sessions")
        .select("client_name, reference_month, projection_file_url, projection_file_name").eq("squad_id", squadId);
      (data || []).forEach((se: any) => {
        if ((se.reference_month || "").slice(0, 7) !== month) return;
        if (!se.projection_file_url) return;
        const nm = (se.client_name || "").trim().toLowerCase();
        if (nm) m.set(nm, { path: se.projection_file_url, name: se.projection_file_name || "documento" });
      });
      // fonte única (mesma do "Anexo do funil" e da Agenda): squad_engagement.plano_estrategico_link
      for (const e of (engagement || [])) {
        if ((e.reference_month || "").slice(0, 7) !== month) continue;
        const link = (e as any).plano_estrategico_link;
        if (!link) continue;
        const nm = (e.client_name || "").trim().toLowerCase();
        if (nm) m.set(nm, { path: link, name: String(link).split("/").pop() || "documento" });
      }
      setMensalDocs(m);
    })();
  }, [squadId, month, engagement]);
  const openMensalDoc = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("projecoes").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o documento da mensal."); return; }
    setDocViewer({ url: data.signedUrl, name });
  };

  // ── Tabela de metas por cliente (pontos fracos configuráveis + observações) ──
  const [weakPoints, setWeakPoints] = useState<{ id: string; label: string }[]>([]);
  const [goalNotes, setGoalNotes] = useState<Map<string, { weak_points: string[]; observacoes: string }>>(new Map());
  const [goalSupported, setGoalSupported] = useState(true);
  const [wpDialogOpen, setWpDialogOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [crmView, setCrmView] = useState<"pct" | "num">("pct");
  const [mensalView, setMensalView] = useState<"pct" | "num">("pct");
  const [weakFilters, setWeakFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [newWp, setNewWp] = useState("");
  const [wpMenuFor, setWpMenuFor] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data: wp, error: wpErr } = await (supabase as any).from("squad_weak_points").select("id, label").order("sort_order");
      if (wpErr) { setGoalSupported(false); return; }
      setGoalSupported(true);
      setWeakPoints(wp || []);
      const { data: notes } = await (supabase as any).from("squad_goal_notes")
        .select("client_name, weak_points, observacoes").eq("squad_id", squadId).eq("reference_month", month);
      const m = new Map<string, { weak_points: string[]; observacoes: string }>();
      (notes || []).forEach((n: any) => m.set((n.client_name || "").trim().toLowerCase(), { weak_points: n.weak_points || [], observacoes: n.observacoes || "" }));
      setGoalNotes(m);
    })();
  }, [squadId, month]);

  const persistGoalNote = async (clientName: string, wp: string[], obs: string) => {
    try {
      const { data: ex } = await (supabase as any).from("squad_goal_notes").select("id")
        .eq("squad_id", squadId).ilike("client_name", clientName).eq("reference_month", month).maybeSingle();
      if (ex?.id) {
        await (supabase as any).from("squad_goal_notes").update({ weak_points: wp, observacoes: obs, updated_at: new Date().toISOString() }).eq("id", ex.id);
      } else {
        await (supabase as any).from("squad_goal_notes").insert({ squad_id: squadId, client_name: clientName, reference_month: month, weak_points: wp, observacoes: obs });
      }
    } catch (e: any) { toast.error(e?.message || "Erro ao salvar"); }
  };
  const toggleWeak = (clientName: string, label: string) => {
    const key = clientName.trim().toLowerCase();
    const cur = goalNotes.get(key) || { weak_points: [], observacoes: "" };
    const next = cur.weak_points.includes(label) ? cur.weak_points.filter((x) => x !== label) : [...cur.weak_points, label];
    setGoalNotes(new Map(goalNotes).set(key, { ...cur, weak_points: next }));
    void persistGoalNote(clientName, next, cur.observacoes);
  };
  const setObs = (clientName: string, obs: string) => {
    const key = clientName.trim().toLowerCase();
    const cur = goalNotes.get(key) || { weak_points: [], observacoes: "" };
    setGoalNotes(new Map(goalNotes).set(key, { ...cur, observacoes: obs }));
  };
  const addWeakPoint = async () => {
    const label = newWp.trim(); if (!label) return;
    const { data, error } = await (supabase as any).from("squad_weak_points").insert({ label, sort_order: weakPoints.length + 1 }).select("id, label").single();
    if (error) { toast.error(/permission|policy|row-level/i.test(error.message || "") ? "Só administradores podem criar pontos fracos." : error.message); return; }
    setWeakPoints([...weakPoints, data]); setNewWp("");
  };
  const removeWeakPoint = async (id: string) => {
    const { error } = await (supabase as any).from("squad_weak_points").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setWeakPoints(weakPoints.filter((w) => w.id !== id));
  };
  const goalStatus = (pct: number | null) => {
    if (pct == null) return { label: "Sem meta", cls: "border-border/40 text-muted-foreground bg-card/40" };
    if (pct >= 100) return { label: "Atingido", cls: "border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-500/15" };
    if (pct >= 80) return { label: "Acima de 80%", cls: "border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/15" };
    if (pct >= 70) return { label: "70–80%", cls: "border-orange-500/50 text-orange-700 dark:text-orange-300 bg-orange-500/15" };
    return { label: "Não atingido", cls: "border-red-500/50 text-red-700 dark:text-red-300 bg-red-500/15" };
  };
  useEffect(() => {
    if (!months.includes(month) && months[0]) setMonth(months[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months.join(",")]);

  // ── sessão do fechamento (timer + anotações) ──
  const [presenting, setPresenting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [savingSession, setSavingSession] = useState(false);
  const timerRef = useRef<number>();
  // Trocar de squad encerra a sessão aberta: sem isso, "Salvar" gravaria as
  // anotações do squad anterior enquanto a tela já mostra outro squad.
  useEffect(() => {
    setPresenting(false); setSessionId(null); setStartedAt(null);
    setElapsed(0); setNotes(""); setDetail(null);
  }, [squadId]);
  useEffect(() => {
    if (startedAt) {
      timerRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
      return () => window.clearInterval(timerRef.current);
    }
  }, [startedAt]);
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const startFechamento = async () => {
    try {
      const { data, error } = await supabase
        .from("squad_fechamento_sessions")
        .insert({ squad_id: squadId, reference_month: `${month}-01`, started_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error) throw error;
      setSessionId((data as any)?.id ?? null);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível iniciar a sessão");
    }
    setStartedAt(Date.now());
    setElapsed(0);
    setNotes("");
    setPresenting(true);
  };

  const closeFechamento = () => {
    setPresenting(false);
    setStartedAt(null);
    setElapsed(0);
    setSessionId(null);
    setNotes("");
  };

  const saveSession = async (end: boolean) => {
    if (!sessionId) { if (end) closeFechamento(); return; }
    setSavingSession(true);
    try {
      const payload: any = { notes };
      if (end) payload.ended_at = new Date().toISOString();
      const { error } = await supabase.from("squad_fechamento_sessions").update(payload).eq("id", sessionId);
      if (error) throw error;
      toast.success(end ? "Fechamento encerrado!" : "Anotações salvas");
      if (end) closeFechamento();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSavingSession(false);
    }
  };

  const saveManual = async (clientName: string, patch: Record<string, any>) => {
    setSavingRow(clientName);
    try {
      const ref = `${month}-01`;
      const { data: existing } = await (supabase as any)
        .from("squad_engagement")
        .select("id")
        .eq("squad_id", squadId)
        .eq("reference_month", ref)
        .ilike("client_name", clientName)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await (supabase as any).from("squad_engagement").update(patch).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("squad_engagement")
          .insert({ squad_id: squadId, reference_month: ref, client_name: clientName, ...patch });
        if (error) throw error;
      }
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSavingRow(null);
    }
  };

  const openFunil = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from("projecoes").createSignedUrl(path, 3600);
      if (error) throw error;
      setDocViewer({ url: data.signedUrl, name: path.split("/").pop() || "funil" });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir o anexo");
    }
  };

  const uploadFunil = async (c: SquadClient, file: File) => {
    setUploadingRow(c.name);
    try {
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      const base = file.name.slice(0, file.name.length - ext.length)
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 60) || "funil";
      const safeName = `${base}${ext}`;
      const path = `fechamento/${squadId}/${month}/${c.id}-${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("projecoes").upload(path, file, { upsert: true });
      if (error) throw error;
      await saveManual(c.name, { plano_estrategico_link: path });
    } catch (e: any) {
      toast.error(e?.message || "Erro no upload");
    } finally {
      setUploadingRow(null);
    }
  };

  // CPL médio do squad = Σ investimento ÷ Σ leads de TODOS os clientes do squad
  // (dash de Criativos: clients.squad_id -> meta_campaigns), respeitando o filtro de campanhas.
  const calcCplMedio = async () => {
    setCplLoading(true);
    try {
      const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      const since = `${month}-01`;
      const until = `${month}-${String(last).padStart(2, "0")}`;

      const { data: crmClients, error: cErr } = await (supabase as any)
        .from("clients").select("id, name, meta_account_id")
        .eq("squad_id", squadId).is("deleted_at", null);
      if (cErr) throw cErr;
      const ids = (crmClients || []).map((c: any) => c.id);
      if (ids.length === 0) {
        setCplData({ since, until, cpl: 0, totalSpent: 0, totalLeads: 0, detalhe: [], faltaram: [] });
        setCplOpen(true); return;
      }

      const { data: filters } = await (supabase as any)
        .from("client_campaign_filters").select("client_id, excluded_campaigns").in("client_id", ids);
      const exclBy = new Map<string, Set<string>>();
      (filters || []).forEach((fl: any) => exclBy.set(fl.client_id, new Set(((fl.excluded_campaigns || []) as string[]).map((x) => (x || "").trim()))));

      const { data: camps } = await (supabase as any)
        .from("meta_campaigns").select("client_id, campaign_name, amount_spent, leads_total")
        .in("client_id", ids).gte("date", since).lte("date", until);

      const per = new Map<string, { spent: number; leads: number }>();
      (camps || []).forEach((cp: any) => {
        const excl = exclBy.get(cp.client_id);
        if (excl && excl.has((cp.campaign_name || "").trim())) return;
        const e = per.get(cp.client_id) || { spent: 0, leads: 0 };
        e.spent += Number(cp.amount_spent) || 0;
        e.leads += Number(cp.leads_total) || 0;
        per.set(cp.client_id, e);
      });

      const detalhe = (crmClients || []).map((c: any) => ({
        name: c.name, account: c.meta_account_id || null,
        ...(per.get(c.id) || { spent: 0, leads: 0 }),
      })).sort((a: any, b: any) => b.spent - a.spent);
      const totalSpent = detalhe.reduce((sum: number, d: any) => sum + d.spent, 0);
      const totalLeads = detalhe.reduce((sum: number, d: any) => sum + d.leads, 0);
      const faltaram = detalhe.filter((d: any) => d.spent === 0 && d.leads === 0).map((d: any) => ({ name: d.name, account: d.account }));

      setCplData({ since, until, cpl: totalLeads > 0 ? totalSpent / totalLeads : 0, totalSpent, totalLeads, detalhe, faltaram });
      setCplOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao calcular o CPL");
    } finally {
      setCplLoading(false);
    }
  };

  // CPMQL médio = Σ investimento ÷ Σ leads QUALIFICADOS (CPF aprovado) dos clientes do squad.
  const calcCpmqlMedio = async () => {
    setCpmqlLoading(true);
    try {
      const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      const since = `${month}-01`;
      const until = `${month}-${String(last).padStart(2, "0")}`;

      // Puxa os clientes do squad + credenciais do CRM (pra saber quem tem GHL).
      const { data: crmClients, error: cErr } = await (supabase as any)
        .from("clients").select("id, name, meta_account_id, ghl_api_key, ghl_location_id")
        .eq("squad_id", squadId).is("deleted_at", null);
      if (cErr) throw cErr;
      const ids = (crmClients || []).map((c: any) => c.id);
      if (ids.length === 0) {
        setCpmqlData({ since, until, cpmql: 0, totalSpent: 0, totalMqls: 0, detalhe: [], semMql: [], crmCount: 0, planilhaCount: 0 });
        setCpmqlOpen(true); return;
      }

      const { data: filters } = await (supabase as any)
        .from("client_campaign_filters").select("client_id, excluded_campaigns").in("client_id", ids);
      const exclBy = new Map<string, Set<string>>();
      (filters || []).forEach((fl: any) => exclBy.set(fl.client_id, new Set(((fl.excluded_campaigns || []) as string[]).map((x) => (x || "").trim()))));

      const { data: camps } = await (supabase as any)
        .from("meta_campaigns").select("client_id, campaign_name, amount_spent")
        .in("client_id", ids).gte("date", since).lte("date", until);
      const spentBy = new Map<string, number>();
      (camps || []).forEach((cp: any) => {
        const excl = exclBy.get(cp.client_id);
        if (excl && excl.has((cp.campaign_name || "").trim())) return;
        spentBy.set(cp.client_id, (spentBy.get(cp.client_id) || 0) + (Number(cp.amount_spent) || 0));
      });

      // Fallback: contagem de qualificados da PLANILHA (só usada quando o cliente não tem CRM).
      const { data: qls } = await (supabase as any)
        .from("qualified_leads").select("client_id")
        .eq("status", "cpf_approved").in("client_id", ids)
        .gte("lead_date", since).lte("lead_date", until);
      const planilhaBy = new Map<string, number>();
      (qls || []).forEach((q: any) => planilhaBy.set(q.client_id, (planilhaBy.get(q.client_id) || 0) + 1));

      // Fonte principal: leads qualificados do CRM (GHL cpf_aprovado), igual à dash de Criativos.
      // Chama a mesma edge function por cliente que tem credenciais de CRM.
      const ghlOf = async (cid: string): Promise<number | null> => {
        try {
          // Mesma estratégia do hook do Criativos: tenta a v2, cai pra v1 se falhar.
          let { data, error } = await (supabase as any).functions.invoke("fetch-ghl-pipeline-v2", { body: { client_id: cid, since, until } });
          if (error) {
            const fb = await (supabase as any).functions.invoke("fetch-ghl-pipeline", { body: { client_id: cid, since, until } });
            data = fb.data; error = fb.error;
          }
          if (error || !data || typeof data.cpf_aprovado !== "number") return null;
          return data.cpf_aprovado;
        } catch { return null; }
      };
      const comCrm = (crmClients || []).filter((c: any) => c.ghl_api_key && c.ghl_location_id);
      const ghlPairs = await Promise.all(comCrm.map(async (c: any) => [c.id, await ghlOf(c.id)] as const));
      const ghlBy = new Map<string, number | null>(ghlPairs);

      const detalhe = (crmClients || []).map((c: any) => {
        const ghlVal = ghlBy.has(c.id) ? ghlBy.get(c.id) : null;
        const fromCrm = ghlVal != null;
        const mqls = fromCrm ? (ghlVal as number) : (planilhaBy.get(c.id) || 0);
        return {
          name: c.name, account: c.meta_account_id || null,
          spent: spentBy.get(c.id) || 0, mqls, fonte: (fromCrm ? "crm" : "planilha") as "crm" | "planilha",
        };
      }).sort((a: any, b: any) => b.spent - a.spent);
      const totalSpent = detalhe.reduce((sum: number, d: any) => sum + d.spent, 0);
      const totalMqls = detalhe.reduce((sum: number, d: any) => sum + d.mqls, 0);
      const semMql = detalhe.filter((d: any) => d.spent > 0 && d.mqls === 0).map((d: any) => ({ name: d.name, spent: d.spent }));
      const crmCount = detalhe.filter((d: any) => d.fonte === "crm").length;
      const planilhaCount = detalhe.length - crmCount;

      setCpmqlData({ since, until, cpmql: totalMqls > 0 ? totalSpent / totalMqls : 0, totalSpent, totalMqls, detalhe, semMql, crmCount, planilhaCount });
      setCpmqlOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao calcular o CPMQL");
    } finally {
      setCpmqlLoading(false);
    }
  };

  // Taxa de pré-atendimento (Simulações ÷ Leads) e Conversão comercial (Vendas ÷ Aprovados),
  // ambas puxadas do CRM (GHL) por cliente — igual à dash de Criativos. Média dos clientes com dado.
  const calcCrmRates = async () => {
    setCrmRatesLoading(true);
    try {
      const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      const since = `${month}-01`;
      const until = `${month}-${String(last).padStart(2, "0")}`;

      const { data: crmClients, error: cErr } = await (supabase as any)
        .from("clients").select("id, name, ghl_api_key, ghl_location_id")
        .eq("squad_id", squadId).is("deleted_at", null);
      if (cErr) throw cErr;
      const ids = (crmClients || []).map((c: any) => c.id);
      if (ids.length === 0) {
        setCrmRates({ since, until, preAtendAvg: 0, convAvg: 0, preAtendN: 0, convN: 0, rows: [] });
        setCrmRatesOpen(true); return;
      }

      const { data: filters } = await (supabase as any)
        .from("client_campaign_filters").select("client_id, excluded_campaigns").in("client_id", ids);
      const exclBy = new Map<string, Set<string>>();
      (filters || []).forEach((fl: any) => exclBy.set(fl.client_id, new Set(((fl.excluded_campaigns || []) as string[]).map((x) => (x || "").trim()))));

      const { data: camps } = await (supabase as any)
        .from("meta_campaigns").select("client_id, campaign_name, leads_total")
        .in("client_id", ids).gte("date", since).lte("date", until);
      const leadsBy = new Map<string, number>();
      (camps || []).forEach((cp: any) => {
        const excl = exclBy.get(cp.client_id);
        if (excl && excl.has((cp.campaign_name || "").trim())) return;
        leadsBy.set(cp.client_id, (leadsBy.get(cp.client_id) || 0) + (Number(cp.leads_total) || 0));
      });

      const ghlOf = async (cid: string) => {
        try {
          let { data, error } = await (supabase as any).functions.invoke("fetch-ghl-pipeline-v2", { body: { client_id: cid, since, until } });
          if (error) {
            const fb = await (supabase as any).functions.invoke("fetch-ghl-pipeline", { body: { client_id: cid, since, until } });
            data = fb.data; error = fb.error;
          }
          if (error || !data) return null;
          return {
            sim: Number(data.simulacoes) || 0,
            aprov: Number(data.cpf_aprovado) || 0,
            vendas: (Number(data.vendas_financiamento) || 0) + (Number(data.vendas_consorcio) || 0),
          };
        } catch { return null; }
      };
      const comCrm = (crmClients || []).filter((c: any) => c.ghl_api_key && c.ghl_location_id);
      const ghlPairs = await Promise.all(comCrm.map(async (c: any) => [c.id, await ghlOf(c.id)] as const));
      const ghlBy = new Map<string, { sim: number; aprov: number; vendas: number } | null>(ghlPairs);

      const rows = (crmClients || []).map((c: any) => {
        const g = ghlBy.get(c.id) || null;
        const leads = leadsBy.get(c.id) || 0;
        const sim = g?.sim || 0, aprov = g?.aprov || 0, vendas = g?.vendas || 0;
        const preAtend = leads > 0 ? (sim / leads) * 100 : null;
        const conv = aprov > 0 ? (vendas / aprov) * 100 : null;
        return { name: c.name, leads, sim, aprov, vendas, preAtend, conv };
      });
      const preRows = rows.filter((r: any) => r.preAtend != null);
      const convRows = rows.filter((r: any) => r.conv != null);
      const preAtendAvg = preRows.length ? preRows.reduce((s: number, r: any) => s + r.preAtend, 0) / preRows.length : 0;
      const convAvg = convRows.length ? convRows.reduce((s: number, r: any) => s + r.conv, 0) / convRows.length : 0;

      setCrmRates({ since, until, preAtendAvg, convAvg, preAtendN: preRows.length, convN: convRows.length, rows });
      setCrmRatesOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao calcular as taxas do CRM");
    } finally {
      setCrmRatesLoading(false);
    }
  };



  const rowByName = useMemo(() => {
    const m = new Map<string, Engagement>();
    engagement.filter((e) => ymf(e.reference_month) === month).forEach((e) => m.set(norm(e.client_name), e));
    return m;
  }, [engagement, month]);

  const eligible = useMemo(() => clients.filter((c) => c.entry_date && ymf(c.entry_date) < month), [clients, month]);
  const missingEntry = clients.filter((c) => !!c.entry_date).length === 0;

  const metaOf = (c: SquadClient, r?: Engagement) => {
    const t = (r as any)?.meta_vendas_trafego ?? (c as any)?.meta_vendas_trafego ?? null;
    const l = (r as any)?.meta_vendas_loja ?? (c as any)?.meta_vendas_loja ?? null;
    const tot = (r as any)?.meta_vendas ?? ((t != null || l != null) ? (Number(t) || 0) + (Number(l) || 0) : null);
    return tot != null ? Number(tot) : null;
  };

  const f = useMemo(() => {
    const M = month;
    const elig = eligible;
    const ativos = clients.filter((c) => c.entry_date && ymf(c.entry_date) <= M);
    const novos = ativos.filter((c) => ymf(c.entry_date!) === M);
    const rows = elig.map((c) => rowByName.get(norm(c.name))).filter(Boolean) as Engagement[];
    const rOf = (c: SquadClient) => rowByName.get(norm(c.name));

    // NPS (vem do Engajamento do mês)
    const npsRespond = elig.filter((c) => { const r = rOf(c); return !!r && r.nps_individual != null; })
      .map((c) => ({ name: c.name, nota: Number(rOf(c)!.nps_individual) }))
      .sort((a, b) => b.nota - a.nota);
    const npsFaltam = elig.filter((c) => { const r = rOf(c); return !r || r.nps_individual == null; }).map((c) => c.name);
    const notaMedia = npsRespond.length ? npsRespond.reduce((s, x) => s + x.nota, 0) / npsRespond.length : 0;
    const pctResposta = elig.length ? (npsRespond.length / elig.length) * 100 : 0;

    // Churn (base D+30, mesma regra da aba Churn)
    const churnsEleg = churns.filter((ch) => ymf(ch.churn_month) === M && ymf(ch.entry_month) && ymf(ch.entry_month) < M);
    const churnsNaoEleg = churns.filter((ch) => ymf(ch.churn_month) === M && !(ymf(ch.entry_month) && ymf(ch.entry_month) < M));
    const activeBefore = clients.filter((c) => c.entry_date && ymf(c.entry_date) < M).length;
    const churnedLater = churns.filter((ch) => ymf(ch.entry_month) && ymf(ch.entry_month) < M && ymf(ch.churn_month) >= M).length;
    const churnBase = activeBefore + churnedLater;
    const churnRate = churnBase ? (churnsEleg.length / churnBase) * 100 : 0;

    // Uso do CRM (nota >= 4)
    const crmUsando = elig.filter((c) => { const r = rOf(c); return !!r && (r as any).crm_usage != null && Number((r as any).crm_usage) >= 4; })
      .map((c) => ({ name: c.name, nota: Number((rOf(c) as any).crm_usage) }));
    const crmNao = elig.filter((c) => { const r = rOf(c); return !r || (r as any).crm_usage == null || Number((r as any).crm_usage) < 4; })
      .map((c) => { const r = rOf(c); return { name: c.name, nota: r ? (r as any).crm_usage as number | null : null }; });
    const pctCrm = elig.length ? (crmUsando.length / elig.length) * 100 : 0;

    // Reuniões mensais
    const doneNames = new Set(agenda.filter((a) => ymf(a.reference_month) === M && a.done).map((a) => norm(a.client_name)));
    const mensalOk = elig.filter((c) => doneNames.has(norm(c.name))).map((c) => c.name);
    const mensalNao = elig.filter((c) => !doneNames.has(norm(c.name))).map((c) => c.name);
    const pctMensais = elig.length ? (mensalOk.length / elig.length) * 100 : 0;

    // Vendido
    const vendidoPor = elig.map((c) => ({ name: c.name, v: Number(rOf(c)?.faturamento) || 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const vendido = vendidoPor.reduce((s, x) => s + x.v, 0);

    // Venda secundária (upsell do squad ao cliente) — valor em R$, campo próprio por cliente/mês
    const secValorPor = elig.map((c) => ({ name: c.name, v: Number(rOf(c)?.venda_secundaria) || 0 }))
      .filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const secValor = secValorPor.reduce((s, x) => s + x.v, 0);
    const secOk = elig.filter((c) => (Number(rOf(c)?.venda_secundaria) || 0) > 0).map((c) => c.name);
    const secNao = elig.filter((c) => !((Number(rOf(c)?.venda_secundaria) || 0) > 0)).map((c) => c.name);
    const pctSec = elig.length ? (secOk.length / elig.length) * 100 : 0;

    // Meta x vendeu
    const comMetaArr = elig.map((c) => { const r = rOf(c); const m = metaOf(c, r); return { name: c.name, meta: m, vendas: Number(r?.vendas) || 0 }; })
      .filter((x) => x.meta != null && x.meta > 0);
    const metaBateu = comMetaArr.filter((x) => x.vendas >= (x.meta || 0));
    const metaNao = comMetaArr.filter((x) => x.vendas < (x.meta || 0));
    const pctMeta = comMetaArr.length ? (metaBateu.length / comMetaArr.length) * 100 : 0;

    // Planejamento estratégico
    const planoSim = elig.filter((c) => (rOf(c) as any)?.plano_estrategico === true).map((c) => c.name);
    const planoNao = elig.filter((c) => (rOf(c) as any)?.plano_estrategico === false).map((c) => c.name);
    const planoFalta = elig.filter((c) => (rOf(c) as any)?.plano_estrategico == null).map((c) => c.name);
    const pctPlano = elig.length ? (planoSim.length / elig.length) * 100 : 0;

    // Conversão comercial (só COM)
    const comClients = elig.filter((c) => parseServices(c.services).includes("COM"));
    const convOk = comClients.filter((c) => (rOf(c) as any)?.conversao_comercial != null)
      .map((c) => ({ name: c.name, v: Number((rOf(c) as any).conversao_comercial) })).sort((a, b) => b.v - a.v);
    const convFalta = comClients.filter((c) => (rOf(c) as any)?.conversao_comercial == null).map((c) => c.name);
    const convMedia = convOk.length ? convOk.reduce((s, x) => s + x.v, 0) / convOk.length : 0;

    const motivosMap = new Map<string, number>();
    churns.filter((ch) => ymf(ch.churn_month) === M).forEach((ch) => {
      const k = (ch.reason || "").trim() || "Sem motivo informado";
      motivosMap.set(k, (motivosMap.get(k) || 0) + 1);
    });

    return {
      ativosNames: ativos.map((c) => c.name), novosNames: novos.map((c) => c.name), eligNames: elig.map((c) => c.name),
      totalAtivos: ativos.length, eligCount: elig.length,
      npsRespond, npsFaltam, notaMedia, pctResposta,
      churnsEleg, churnsNaoEleg, churnBase, churnRate,
      crmUsando, crmNao, pctCrm,
      mensalOk, mensalNao, pctMensais,
      vendidoPor, vendido,
      secOk, secNao, pctSec, secValor, secValorPor,
      comMetaArr, metaBateu, metaNao, pctMeta,
      planoSim, planoNao, planoFalta, pctPlano,
      convOk, convFalta, convMedia, comTotal: comClients.length,
      motivos: Array.from(motivosMap.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [clients, engagement, churns, agenda, month, rowByName, eligible]);

  // Linhas da tabela de metas: cliente ativo, meta (R$ sales_goal) x atingimento (R$ faturamento do mês).
  const goalRows = useMemo(() => {
    // D+30: só clientes que entraram ANTES do mês analisado (mesma regra do resto do Fechamento).
    // Clientes novos do mês não entram — não faz sentido cobrar meta de quem acabou de chegar.
    const elig = clients.filter((c) => c.entry_date && ymf(c.entry_date) < month);
    return elig.map((c) => {
      const r = rowByName.get(norm(c.name));
      const meta = Number(c.sales_goal) || 0;
      const atingido = Number(r?.faturamento) || 0;
      const pct = meta > 0 ? (atingido / meta) * 100 : null;
      return { name: c.name, meta, atingido, pct };
    }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  }, [clients, rowByName, month]);

  // Filtro por pontos fracos (múltiplo): mostra projetos que têm QUALQUER um dos marcados.
  const goalRowsView = weakFilters.length === 0
    ? goalRows
    : goalRows.filter((row) => {
        const wps = goalNotes.get(row.name.trim().toLowerCase())?.weak_points || [];
        return weakFilters.some((fLabel) => wps.includes(fLabel));
      });

  // helper p/ montar os grupos do popup de detalhe
  const G = (title: string, rows: DetailRow[], empty?: string): DetailGroup => ({ title: `${title} (${rows.length})`, rows, empty });

  const cards: FechCard[] = [
    {
      label: "Clientes ativos no mês", value: `${f.eligCount}/${f.totalAtivos}`, ok: null, hint: `${f.eligCount} elegíveis (D+30) · ${f.totalAtivos - f.eligCount} novos`,
      detail: { title: "Clientes ativos no mês", groups: [
        G("Elegíveis (D+30) — entram nas metas", f.eligNames.map((n) => ({ name: n, badge: "elegível", tone: "ok" as const }))),
        G("Novos do mês — não entram (menos de 30 dias)", f.novosNames.map((n) => ({ name: n, badge: "novo", tone: "warn" as const })), "Nenhum cliente novo no mês"),
      ] },
    },
    {
      label: "NPS respondidos × ativos", value: `${f.npsRespond.length}/${f.eligCount}`, ok: null, hint: "sobre a base elegível",
      detail: { title: "NPS do mês", groups: [
        G("Responderam", f.npsRespond.map((x) => ({ name: x.name, badge: `Nota ${x.nota}`, tone: (x.nota >= 9 ? "ok" : x.nota < 7 ? "bad" : "warn") as "ok" | "bad" | "warn" }))),
        G("Faltam responder", f.npsFaltam.map((n) => ({ name: n, badge: "sem nota", tone: "bad" as const })), "Todos responderam 🎉"),
      ] },
    },
    {
      label: "% de resposta", value: `${f.pctResposta.toFixed(0)}%`, ok: f.pctResposta >= 80, hint: "meta ≥ 80%",
      detail: { title: "% de resposta do NPS", groups: [
        G("Responderam", f.npsRespond.map((x) => ({ name: x.name, badge: `Nota ${x.nota}`, tone: "ok" as const }))),
        G("Faltam responder", f.npsFaltam.map((n) => ({ name: n, badge: "sem nota", tone: "bad" as const })), "Todos responderam 🎉"),
      ] },
    },
    {
      label: "Nota média do NPS", value: f.notaMedia ? f.notaMedia.toFixed(1) : "—", ok: f.npsRespond.length ? f.notaMedia >= 9 : null, hint: "meta ≥ 9,0",
      detail: { title: "Notas do NPS", groups: [
        G("Notas coletadas", f.npsRespond.map((x) => ({ name: x.name, badge: `Nota ${x.nota}`, tone: (x.nota >= 9 ? "ok" : x.nota < 7 ? "bad" : "warn") as "ok" | "bad" | "warn" })), "Nenhuma nota no mês"),
      ] },
    },
    {
      label: "Taxa de churn", value: `${f.churnRate.toFixed(1)}%`, ok: f.churnRate < 5, hint: `${f.churnsEleg.length} de ${f.churnBase} · meta < 5%`,
      detail: { title: "Churn do mês", groups: [
        G("Contam na taxa (elegíveis, +30 dias)", f.churnsEleg.map((ch) => ({ name: ch.client_name, badge: (ch.reason || "sem motivo"), tone: "bad" as const })), "Nenhum churn elegível 🎉"),
        G("Não contam (novos do mês / sem data)", f.churnsNaoEleg.map((ch) => ({ name: ch.client_name, badge: (ch.reason || "sem motivo"), tone: "warn" as const })), "Nenhum"),
      ] },
    },
    {
      label: crmView === "pct" ? "% usando CRM" : "Clientes usando CRM",
      value: crmView === "pct" ? `${f.pctCrm.toFixed(0)}%` : `${f.crmUsando.length}/${f.eligCount}`,
      ok: f.pctCrm >= 80,
      hint: crmView === "pct" ? `${f.crmUsando.length} de ${f.eligCount} · clique p/ ver número` : `${f.crmNao.length} não usando · nota ≥ 4 · meta ≥ 80%`,
      toggle: () => setCrmView((v) => (v === "pct" ? "num" : "pct")),
      detail: { title: "Uso do CRM (D+30)", groups: [
        G("Usando (nota ≥ 4)", f.crmUsando.map((x) => ({ name: x.name, badge: `${x.nota}/5`, tone: "ok" as const }))),
        G("Não usando / sem nota", f.crmNao.map((x) => ({ name: x.name, badge: x.nota != null ? `${x.nota}/5` : "sem nota", tone: "bad" as const })), "Todos usando 🎉"),
      ] },
    },
    {
      label: mensalView === "pct" ? "% reunião mensal" : "Reuniões mensais feitas",
      value: mensalView === "pct" ? `${f.pctMensais.toFixed(0)}%` : `${f.mensalOk.length}/${f.eligCount}`,
      ok: f.pctMensais >= 80,
      hint: mensalView === "pct" ? `${f.mensalOk.length} de ${f.eligCount} · clique p/ ver número` : `${f.mensalNao.length} pendentes · meta ≥ 80%`,
      toggle: () => setMensalView((v) => (v === "pct" ? "num" : "pct")),
      detail: { title: "Reuniões mensais (D+30)", groups: [
        G("Realizadas", f.mensalOk.map((n) => ({ name: n, badge: "realizada", tone: "ok" as const }))),
        G("Não realizadas", f.mensalNao.map((n) => ({ name: n, badge: "pendente", tone: "bad" as const })), "Todas realizadas 🎉"),
      ] },
    },
    {
      label: "Faturamento geral (R$)", value: formatBRL(f.vendido), ok: f.vendido >= 10000, hint: "faturamento dos projetos D+30 · meta ≥ R$ 10k",
      detail: { title: "Faturamento geral dos projetos (D+30) — do maior ao menor", groups: [
        G("Por cliente", f.vendidoPor.map((x) => ({ name: x.name, badge: formatBRL(x.v), tone: "ok" as const })), "Nenhum faturamento lançado no mês"),
      ] },
    },
    {
      label: "Venda secundária (R$)", value: formatBRL(f.secValor), ok: null, hint: `${f.secOk.length} de ${f.eligCount} clientes com upsell no mês`,
      detail: { title: "Venda secundária — upsell do squad ao cliente (R$)", groups: [
        G("Tiveram venda secundária (R$)", f.secValorPor.map((x) => ({ name: x.name, badge: formatBRL(x.v), tone: "ok" as const })), "Nenhuma venda secundária registrada neste mês."),
        G("Sem venda secundária", f.secNao.map((n) => ({ name: n, badge: "não", tone: "warn" as const }))),
      ] },
    },
    {
      label: "CPL médio",
      value: cplLoading ? "Calculando..." : cplData ? formatBRL(cplData.cpl) : "Ver CPL do mês",
      ok: cplData ? cplData.cpl <= 8 : null,
      hint: cplData ? `${formatBRL(cplData.totalSpent)} ÷ ${cplData.totalLeads} leads · meta ≤ R$ 8` : "clique para calcular pelos clientes do squad",
      onClick: () => void calcCplMedio(),
    },
    {
      label: "CPMQL médio",
      value: cpmqlLoading ? "Calculando..." : cpmqlData ? formatBRL(cpmqlData.cpmql) : "Ver CPMQL do mês",
      ok: cpmqlData ? (cpmqlData.totalMqls > 0 && cpmqlData.cpmql < 45) : null,
      hint: cpmqlData
        ? `${formatBRL(cpmqlData.totalSpent)} ÷ ${cpmqlData.totalMqls} qualificados · meta < R$ 45`
        : "clique para calcular pelos clientes do squad",
      onClick: () => void calcCpmqlMedio(),
    },
    {
      label: "% bateram a meta projetada", value: `${f.pctMeta.toFixed(0)}%`, ok: f.comMetaArr.length ? f.pctMeta >= 70 : null,
      hint: `${f.metaBateu.length} de ${f.comMetaArr.length} com meta · meta ≥ 70%`,
      detail: { title: "Meta × Vendeu", groups: [
        G("Bateram a meta", f.metaBateu.map((x) => ({ name: x.name, badge: `${x.vendas} / ${x.meta}`, tone: "ok" as const })), "Ninguém bateu"),
        G("Não bateram", f.metaNao.map((x) => ({ name: x.name, badge: `${x.vendas} / ${x.meta}`, tone: "bad" as const })), "Todos bateram 🎉"),
      ] },
    },
    {
      label: "% plano estratégico documentado", value: `${f.pctPlano.toFixed(0)}%`, ok: f.pctPlano >= 90, hint: `${f.planoSim.length} de ${f.eligCount} · meta ≥ 90%`,
      detail: { title: "Está no planejamento estratégico?", groups: [
        G("Sim", f.planoSim.map((n) => ({ name: n, badge: "sim", tone: "ok" as const, doc: mensalDocs.get(n.trim().toLowerCase()) })), "Nenhum"),
        G("Não", f.planoNao.map((n) => ({ name: n, badge: "não", tone: "bad" as const, doc: mensalDocs.get(n.trim().toLowerCase()) })), "Nenhum"),
        G("Não respondido", f.planoFalta.map((n) => ({ name: n, badge: "—", tone: "warn" as const, doc: mensalDocs.get(n.trim().toLowerCase()) })), "Todos respondidos 🎉"),
      ] },
    },
    {
      label: "Taxa de pré-atendimento (média)",
      value: crmRatesLoading ? "Calculando..." : crmRates ? `${crmRates.preAtendAvg.toFixed(0)}%` : "Ver taxa do mês",
      ok: crmRates ? crmRates.preAtendAvg >= 60 : null,
      hint: crmRates ? `Simulações ÷ leads · média de ${crmRates.preAtendN} clientes · meta ≥ 60%` : "clique — média Simulações ÷ Leads (CRM)",
      onClick: () => void calcCrmRates(),
    },
    {
      label: "Conversão comercial média (COM)",
      value: crmRatesLoading ? "Calculando..." : crmRates ? `${crmRates.convAvg.toFixed(0)}%` : "Ver conversão do mês",
      ok: crmRates ? crmRates.convAvg >= 20 : null,
      hint: crmRates ? `Vendas ÷ aprovados · média de ${crmRates.convN} clientes · meta ≥ 20%` : "clique — média Vendas ÷ Aprovados (CRM)",
      onClick: () => void calcCrmRates(),
    },
  ];


  const faltaPreencher = eligible.filter((c) => {
    const r = rowByName.get(norm(c.name));
    return !r || r.nps_individual == null || (r as any).crm_usage == null
      || (r as any).plano_estrategico == null;
  }).length;

  const MetricsGrid = ({ compact }: { compact?: boolean }) => (
    <div className={`grid gap-3 ${compact ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"}`}>
      {cards.map((card) => {
        const clickable = !!card.onClick || !!card.toggle || !!card.detail;
        const cls = `rounded-2xl border p-4 ${card.ok === true ? "border-emerald-500/40 bg-emerald-500/10" : card.ok === false ? "border-red-500/40 bg-red-500/10" : "border-border/30 bg-card/40"} ${clickable ? "text-left cursor-pointer hover:ring-2 hover:ring-primary/40 transition" : ""}`;
        const inner = (
          <>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className={`font-bold mt-1 ${card.onClick && !cplData ? "text-base text-primary" : "text-2xl"} ${card.ok === true ? "text-emerald-700 dark:text-emerald-300" : card.ok === false ? "text-red-700 dark:text-red-300" : ""}`}>{card.value}</p>
            {card.hint && <p className="text-[10px] text-muted-foreground mt-0.5">{card.hint}</p>}
            {card.toggle && card.detail && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setDetail(card.detail!); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setDetail(card.detail!); } }}
                className="inline-block mt-1.5 text-[10px] font-semibold text-primary hover:underline cursor-pointer"
              >
                ver clientes →
              </span>
            )}
          </>
        );
        return clickable
          ? <button key={card.label} type="button" onClick={() => (card.onClick ? card.onClick() : card.toggle ? card.toggle() : setDetail(card.detail!))} className={cls}>{inner}</button>
          : <div key={card.label} className={cls}>{inner}</div>;
      })}
    </div>
  );

  const ChurnReasons = () => (
    <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
      <p className="text-sm font-semibold mb-2">Motivos de churn no mês</p>
      {f.motivos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum churn neste mês 🎉</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {f.motivos.map(([m, n]) => (
            <Badge key={m} variant="outline" className="gap-1.5 border-red-500/30 text-red-700 dark:text-red-300">
              {m} <span className="font-bold">{n}</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Cabeçalho: squad + mês + iniciar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="font-semibold">{squadName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">fechamento de</span>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-52 bg-card/40 backdrop-blur-sm"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m} className="capitalize">{formatMonth(`${m}-01`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={startFechamento} className="gap-2 bg-gradient-to-r from-primary to-fuchsia-600 hover:opacity-90 shadow-lg shadow-primary/30">
          <Play className="h-4 w-4" /> Apresentar fechamento de <span className="capitalize">{formatMonth(`${month}-01`)}</span>
        </Button>
      </div>

      {missingEntry ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          ⚠️ Preencha a <strong>Data de entrada</strong> dos clientes (aba Clientes) — o fechamento usa a base D+30.
        </div>
      ) : (
        <div className={`rounded-xl border p-3 text-xs ${faltaPreencher === 0 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"}`}>
          {faltaPreencher === 0
            ? "✓ Tudo preenchido — pode apresentar o fechamento."
            : `Faltam preencher ${faltaPreencher} de ${eligible.length} clientes (NPS, uso do CRM, plano estratégico e/ou conversão comercial).`}
        </div>
      )}

      {/* Métricas na própria tela */}
      <MetricsGrid />

      {/* Motivos de churn na própria tela */}
      <ChurnReasons />

      {/* Pasta: Preenchimento por cliente — abre em popup grande */}
      <button
        onClick={() => setFillOpen(true)}
        className="w-full flex items-center gap-4 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 text-left transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
      >
        <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Preenchimento por cliente</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {faltaPreencher === 0 ? "✓ Tudo preenchido neste mês" : `Faltam preencher ${faltaPreencher} de ${eligible.length} clientes`} · NPS, uso do CRM, plano estratégico, funil, conversão
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary shrink-0">
          Abrir <ChevronRight className="h-4 w-4" />
        </span>
      </button>

      {/* Metas dos projetos — meta x atingimento, pontos fracos, observações */}
      <Card className="bg-card/40 backdrop-blur-sm border-border/30">
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Metas dos projetos</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Meta × atingimento (R$) de cada cliente, pontos fracos e observações.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {goalSupported && weakPoints.length > 0 && (
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-8 gap-1.5 ${weakFilters.length ? "border-primary/50 text-primary" : ""}`}>
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {weakFilters.length === 0 ? "Filtrar pontos fracos" : weakFilters.length === 1 ? weakFilters[0] : `${weakFilters.length} filtros`}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 bg-card border-border/50" align="end">
                  <div className="flex items-center justify-between px-2 py-1 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">Projetos com algum destes:</span>
                    {weakFilters.length > 0 && (
                      <button onClick={() => setWeakFilters([])} className="text-[11px] text-primary font-medium hover:underline">limpar</button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {weakPoints.map((wp) => {
                      const checked = weakFilters.includes(wp.label);
                      return (
                        <label key={wp.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer text-sm">
                          <input type="checkbox" checked={checked} onChange={() => setWeakFilters((prev) => checked ? prev.filter((x) => x !== wp.label) : [...prev, wp.label])} className="accent-primary" />
                          {wp.label}
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {isAdmin && goalSupported && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setWpDialogOpen(true)}>
                <Settings className="h-3.5 w-3.5" /> Pontos fracos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!goalSupported ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              ⚠️ Esta tabela precisa da migração — peça ao Lovable para rodar <strong>squad_weak_points</strong> e <strong>squad_goal_notes</strong>.
            </div>
          ) : goalRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum cliente ativo neste mês.</p>
          ) : goalRowsView.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum projeto com {weakFilters.length === 1 ? <strong className="text-foreground">{weakFilters[0]}</strong> : "os pontos fracos selecionados"} neste mês.
              <button onClick={() => setWeakFilters([])} className="ml-2 text-primary font-medium hover:underline">limpar filtro</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/30">
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">Atingimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pontos fracos</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goalRowsView.map((row) => {
                    const note = goalNotes.get(row.name.trim().toLowerCase()) || { weak_points: [], observacoes: "" };
                    const st = goalStatus(row.pct);
                    return (
                      <TableRow key={row.name} className="border-border/20 align-top">
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.meta > 0 ? formatBRL(row.meta) : "—"}</TableCell>
                        <TableCell className="text-right">{formatBRL(row.atingido)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={st.cls}>
                            {st.label}{row.pct != null ? ` · ${row.pct.toFixed(0)}%` : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <Popover open={wpMenuFor === row.name} onOpenChange={(o) => setWpMenuFor(o ? row.name : null)}>
                            <PopoverTrigger asChild>
                              <button className="w-full flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5 text-xs hover:border-primary/40">
                                <span className="truncate text-muted-foreground">{note.weak_points.length ? `${note.weak_points.length} selecionado(s)` : "Selecionar"}</span>
                                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2 bg-card border-border/50" align="start">
                              {weakPoints.length === 0 ? (
                                <p className="text-xs text-muted-foreground px-2 py-1.5">Nenhum ponto fraco cadastrado{isAdmin ? " — use o botão 'Pontos fracos'." : "."}</p>
                              ) : weakPoints.map((wp) => {
                                const checked = note.weak_points.includes(wp.label);
                                return (
                                  <label key={wp.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer text-sm">
                                    <input type="checkbox" checked={checked} onChange={() => toggleWeak(row.name, wp.label)} className="accent-primary" />
                                    {wp.label}
                                  </label>
                                );
                              })}
                            </PopoverContent>
                          </Popover>
                          {note.weak_points.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {note.weak_points.map((w) => (
                                <Badge key={w} variant="outline" className="text-[10px] border-primary/30 text-primary dark:text-primary">{w}</Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <Input
                            value={note.observacoes}
                            onChange={(e) => setObs(row.name, e.target.value)}
                            onBlur={() => { const cur = goalNotes.get(row.name.trim().toLowerCase()) || { weak_points: [], observacoes: "" }; void persistGoalNote(row.name, cur.weak_points, cur.observacoes); }}
                            placeholder="Observações..."
                            className="h-8 text-xs bg-card/40"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gerenciar pontos fracos (admin) */}
      <Dialog open={wpDialogOpen} onOpenChange={setWpDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4 text-primary" /> Pontos fracos dos projetos</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Aparecem na caixa de seleção de cada cliente. Só administradores editam.</p>
          <div className="flex gap-2">
            <Input value={newWp} onChange={(e) => setNewWp(e.target.value)} placeholder="Novo ponto fraco (ex: Retenção)" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addWeakPoint(); } }} />
            <Button onClick={() => void addWeakPoint()} className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {weakPoints.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum ponto fraco cadastrado.</p>
            ) : weakPoints.map((wp) => (
              <div key={wp.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-card/40 px-3 py-2">
                <span className="text-sm">{wp.label}</span>
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive shrink-0 h-7" onClick={() => void removeWeakPoint(wp.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preenchimento — popup grande (quase tela cheia) */}
      <Dialog open={fillOpen} onOpenChange={setFillOpen}>
        <DialogContent className="max-w-[96vw] w-[96vw] sm:max-w-[96vw] max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Preenchimento por cliente · {squadName} · <span className="capitalize">{formatMonth(`${month}-01`)}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {faltaPreencher === 0 ? "· tudo preenchido" : `· faltam ${faltaPreencher} de ${eligible.length}`}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">NPS <span className="font-normal text-muted-foreground">(auto)</span></TableHead>
                  <TableHead className="text-center">Uso CRM (1-5)</TableHead>
                  <TableHead className="text-center">Está no planejamento estratégico?</TableHead>
                  <TableHead>Anexo do funil</TableHead>
                  <TableHead className="text-center">Conversão % (COM)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligible.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum cliente elegível (D+30) neste mês.</TableCell></TableRow>
                ) : eligible.map((c) => {
                  const r = rowByName.get(norm(c.name));
                  const isCom = parseServices(c.services).includes("COM");
                  const busy = savingRow === c.name;
                  const link = ((r as any)?.plano_estrategico_link || "") as string;
                  return (
                    <TableRow key={c.id} className="border-border/20">
                      <TableCell className="font-semibold">{c.name}</TableCell>
                      <TableCell className="text-center">
                        {r?.nps_individual != null ? (
                          <Badge variant="outline" className="font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-300">{r.nps_individual}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-500/40 text-red-700 dark:text-red-300" title="Preencha na aba Engajamento deste mês">falta no Engajamento</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input key={`crm-${c.id}-${(r as any)?.crm_usage ?? "x"}`} type="number" min="1" max="5" step="1" disabled={busy}
                          defaultValue={(r as any)?.crm_usage ?? ""} placeholder="—"
                          className={`h-8 w-20 text-xs text-center mx-auto ${(r as any)?.crm_usage == null ? "border-red-500/40" : ""}`}
                          onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== ((r as any)?.crm_usage ?? null)) void saveManual(c.name, { crm_usage: v }); }} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={(r as any)?.plano_estrategico === true ? "sim" : (r as any)?.plano_estrategico === false ? "nao" : ""}
                          onValueChange={(v) => void saveManual(c.name, { plano_estrategico: v === "sim" ? true : false })}
                        >
                          <SelectTrigger className={`h-8 w-24 mx-auto text-xs ${(r as any)?.plano_estrategico == null ? "border-red-500/40" : ""}`}>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {link ? (
                          <div className="flex items-center gap-1.5">
                            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                              onClick={() => void openFunil(link)}>
                              <FileText className="h-3.5 w-3.5" /> Ver funil
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Remover anexo"
                              onClick={() => void saveManual(c.name, { plano_estrategico_link: null })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Input type="file" accept="image/*" disabled={uploadingRow === c.name || busy} className="h-8 text-xs"
                            onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void uploadFunil(c, fl); e.currentTarget.value = ""; }} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isCom ? (
                          <Input key={`cv-${c.id}-${(r as any)?.conversao_comercial ?? "x"}`} type="number" min="0" max="100" step="0.1" disabled={busy}
                            defaultValue={(r as any)?.conversao_comercial ?? ""} placeholder="%"
                            className={`h-8 w-24 text-xs text-center mx-auto ${(r as any)?.conversao_comercial == null ? "border-red-500/40" : ""}`}
                            onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== (((r as any)?.conversao_comercial) ?? null)) void saveManual(c.name, { conversao_comercial: v }); }} />
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drill-down genérico dos cards */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail?.title} <span className="text-xs font-normal text-muted-foreground capitalize">· {formatMonth(`${month}-01`)}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {detail?.groups.map((g) => (
              <div key={g.title}>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">{g.title}</p>
                {g.rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">{g.empty || "Nenhum"}</p>
                ) : (
                  <div className="space-y-1">
                    {g.rows.map((r, i) => (
                      <div key={`${r.name}-${i}`} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-sm ${
                        r.tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5"
                        : r.tone === "bad" ? "border-red-500/30 bg-red-500/5"
                        : r.tone === "warn" ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border/30 bg-card/40"}`}>
                        <span className="font-medium min-w-0 break-words">{r.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {r.doc && (
                            <button onClick={() => openMensalDoc(r.doc!.path, r.doc!.name)} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20">
                              <FileText className="h-3 w-3" /> ver documento
                            </button>
                          )}
                          {r.badge && (
                            <Badge variant="outline" className={`text-[10px] ${
                              r.tone === "ok" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                              : r.tone === "bad" ? "border-red-500/40 text-red-700 dark:text-red-300"
                              : r.tone === "warn" ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                              : ""}`}>{r.badge}</Badge>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Taxas do CRM: pré-atendimento + conversão comercial */}
      <Dialog open={crmRatesOpen} onOpenChange={setCrmRatesOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Taxas do CRM · {squadName} · <span className="capitalize">{formatMonth(`${month}-01`)}</span>
            </DialogTitle>
          </DialogHeader>
          {crmRates && (
            <div className="space-y-5">
              <p className="text-xs text-muted-foreground">
                Puxado do <strong>CRM</strong> (igual à dash de Criativos), por cliente do squad. Média só dos clientes que têm o dado.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-2xl border p-4 ${crmRates.preAtendAvg >= 60 ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pré-atendimento médio</p>
                  <p className={`text-2xl font-bold mt-1 ${crmRates.preAtendAvg >= 60 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{crmRates.preAtendAvg.toFixed(0)}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Simulações ÷ Leads · {crmRates.preAtendN} clientes · meta ≥ 60%</p>
                </div>
                <div className={`rounded-2xl border p-4 ${crmRates.convAvg >= 20 ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Conversão comercial média</p>
                  <p className={`text-2xl font-bold mt-1 ${crmRates.convAvg >= 20 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{crmRates.convAvg.toFixed(0)}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Vendas ÷ Aprovados · {crmRates.convN} clientes · meta ≥ 20%</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/30">
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Simul.</TableHead>
                      <TableHead className="text-right">Aprov.</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Pré-atend.</TableHead>
                      <TableHead className="text-right">Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...crmRates.rows].sort((a, b) => (b.conv ?? -1) - (a.conv ?? -1)).map((r) => (
                      <TableRow key={r.name} className="border-border/20">
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{r.leads.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right">{r.sim.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right">{r.aprov.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right">{r.vendas.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className={`text-right font-semibold ${r.preAtend == null ? "text-muted-foreground" : r.preAtend >= 60 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{r.preAtend == null ? "—" : `${r.preAtend.toFixed(0)}%`}</TableCell>
                        <TableCell className={`text-right font-semibold ${r.conv == null ? "text-muted-foreground" : r.conv >= 20 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{r.conv == null ? "—" : `${r.conv.toFixed(0)}%`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalhe do CPMQL médio */}
      <Dialog open={cpmqlOpen} onOpenChange={setCpmqlOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> CPMQL médio · {squadName} · <span className="capitalize">{formatMonth(`${month}-01`)}</span>
            </DialogTitle>
          </DialogHeader>
          {cpmqlData && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Período <strong>{cpmqlData.since}</strong> a <strong>{cpmqlData.until}</strong> · investimento de <strong>todos os clientes deste squad</strong> ÷ <strong>leads qualificados</strong> (CPF aprovado). Os qualificados vêm do <strong>CRM</strong> (igual à dash de Criativos); só caem pra planilha quando o cliente não tem CRM configurado. Respeita o filtro de campanhas de cada cliente.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-2xl border p-4 ${cpmqlData.totalMqls > 0 && cpmqlData.cpmql < 45 ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">CPMQL médio</p>
                  <p className={`text-2xl font-bold mt-1 ${cpmqlData.totalMqls > 0 && cpmqlData.cpmql < 45 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                    {cpmqlData.totalMqls > 0 ? formatBRL(cpmqlData.cpmql) : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">meta &lt; R$ 45</p>
                </div>
                <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Investimento total</p>
                  <p className="text-2xl font-bold mt-1">{formatBRL(cpmqlData.totalSpent)}</p>
                </div>
                <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads qualificados</p>
                  <p className="text-2xl font-bold mt-1">{cpmqlData.totalMqls.toLocaleString("pt-BR")}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{cpmqlData.crmCount} via CRM · {cpmqlData.planilhaCount} via planilha</p>
                </div>
              </div>

              {cpmqlData.semMql.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1.5">
                    {cpmqlData.semMql.length} cliente(s) investiram e <strong>não geraram nenhum qualificado</strong> — puxam o CPMQL pra cima:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cpmqlData.semMql.map((d) => (
                      <Badge key={d.name} variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-200">
                        {d.name} · {formatBRL(d.spent)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/30">
                      <TableHead>Cliente</TableHead>
                      <TableHead>Conta de anúncio</TableHead>
                      <TableHead className="text-right">Investimento</TableHead>
                      <TableHead className="text-right">Qualificados</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead className="text-right">CPMQL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cpmqlData.detalhe.map((d) => (
                      <TableRow key={d.name} className={`border-border/20 ${d.spent === 0 && d.mqls === 0 ? "opacity-50" : ""}`}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{d.account || "—"}</TableCell>
                        <TableCell className="text-right">{formatBRL(d.spent)}</TableCell>
                        <TableCell className="text-right">{d.mqls.toLocaleString("pt-BR")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={d.fonte === "crm" ? "border-sky-500/40 text-sky-700 dark:text-sky-300" : "border-amber-500/40 text-amber-700 dark:text-amber-300"}>
                            {d.fonte === "crm" ? "CRM" : "Planilha"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${d.mqls > 0 && d.spent / d.mqls < 45 ? "text-emerald-700 dark:text-emerald-300" : d.mqls > 0 ? "text-red-700 dark:text-red-300" : ""}`}>
                          {d.mqls > 0 ? formatBRL(d.spent / d.mqls) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalhe do CPL médio */}
      <Dialog open={cplOpen} onOpenChange={setCplOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" /> CPL médio · {squadName} · <span className="capitalize">{formatMonth(`${month}-01`)}</span>
            </DialogTitle>
          </DialogHeader>
          {cplData && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Período <strong>{cplData.since}</strong> a <strong>{cplData.until}</strong> · soma o investimento e os leads de <strong>todos os clientes deste squad</strong> na dash de Criativos (respeitando o filtro de campanhas de cada cliente).
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-2xl border p-4 ${cplData.cpl <= 8 && cplData.totalLeads > 0 ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">CPL médio</p>
                  <p className={`text-2xl font-bold mt-1 ${cplData.cpl <= 8 && cplData.totalLeads > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                    {cplData.totalLeads > 0 ? formatBRL(cplData.cpl) : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">meta ≤ R$ 8</p>
                </div>
                <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Investimento total</p>
                  <p className="text-2xl font-bold mt-1">{formatBRL(cplData.totalSpent)}</p>
                </div>
                <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads totais</p>
                  <p className="text-2xl font-bold mt-1">{cplData.totalLeads.toLocaleString("pt-BR")}</p>
                </div>
              </div>

              {cplData.faltaram.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1.5">
                    {cplData.faltaram.length} cliente(s) sem dado no período (não entraram na conta):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cplData.faltaram.map((d) => (
                      <Badge key={d.name} variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-200">
                        {d.name}{!d.account ? " · sem conta Meta" : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/30">
                      <TableHead>Cliente</TableHead>
                      <TableHead>Conta de anúncio</TableHead>
                      <TableHead className="text-right">Investimento</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">CPL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cplData.detalhe.map((d) => (
                      <TableRow key={d.name} className={`border-border/20 ${d.spent === 0 && d.leads === 0 ? "opacity-50" : ""}`}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{d.account || "—"}</TableCell>
                        <TableCell className="text-right">{formatBRL(d.spent)}</TableCell>
                        <TableCell className="text-right">{d.leads.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-semibold">{d.leads > 0 ? formatBRL(d.spent / d.leads) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Visualizador do anexo do funil */}
      <Dialog open={!!docViewer} onOpenChange={(o) => { if (!o) setDocViewer(null); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Funil de projeção anexado</DialogTitle>
          </DialogHeader>
          {docViewer && (/\.pdf($|\?)/i.test(docViewer.url) || /\.pdf$/i.test(docViewer.name)
            ? <iframe src={docViewer.url} title={docViewer.name} className="w-full h-[75vh] rounded-lg border border-border/30" />
            : <img src={docViewer.url} alt={docViewer.name} className="w-full h-auto rounded-lg border border-border/30" />)}
        </DialogContent>
      </Dialog>

      {/* Apresentação do fechamento — timer + métricas + anotações */}
      <Dialog open={presenting} onOpenChange={(o) => { if (!o && !savingSession) closeFechamento(); }}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5 text-primary" />
              Fechamento Operacional · {squadName} · <span className="capitalize">{formatMonth(`${month}-01`)}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="text-center rounded-xl border border-border/30 bg-background/40 p-3">
            <p className="text-4xl font-black tabular-nums text-primary">{fmtTime(elapsed)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">tempo de reunião</p>
          </div>

          <MetricsGrid compact />
          <ChurnReasons />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pontos discutidos no fechamento</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="O que foi discutido, decisões, responsáveis e prazos..." />
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={savingSession} onClick={closeFechamento}>Fechar</Button>
            <Button variant="outline" disabled={savingSession} onClick={() => void saveSession(false)}>
              {savingSession ? "Salvando..." : "Salvar"}
            </Button>
            <Button disabled={savingSession} onClick={() => void saveSession(true)}
              className="gap-2 bg-gradient-to-r from-primary to-fuchsia-600">
              <CheckCircle2 className="h-4 w-4" /> Encerrar fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function StatCard({ label, value, icon: Icon, color, sub, delta, tint, subRaw }: { label: string; value: number | string; icon: any; color: string; sub?: string; delta?: number | null; tint?: "emerald" | "red"; subRaw?: boolean }) {
  const tintCls =
    tint === "emerald" ? "border-emerald-500/40 bg-emerald-500/10"
    : tint === "red" ? "border-red-500/40 bg-red-500/10"
    : "border-border/30 bg-card/40";
  return (
    <div className={`rounded-2xl border ${tintCls} backdrop-blur-sm p-4 shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {delta != null && delta !== 0 && (
            <p className={`text-[10px] font-semibold mt-0.5 ${delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-400"}`}>
              {delta > 0 ? "↑" : "↓"} {delta > 0 ? "+" : ""}{delta} vs mês anterior
            </p>
          )}
          {sub && <p className={`text-[10px] text-muted-foreground/70 mt-0.5 ${subRaw ? "" : "capitalize"}`}>{sub}</p>}
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
  agenda, sessions, engagement, clients, squadId, activeClientsCount, onNew, onEdit, onRemove, onToggleDone, onReload,
}: {
  agenda: Agenda[];
  sessions: any[];
  engagement: Engagement[];
  clients: SquadClient[];
  squadId: string;
  activeClientsCount: number;
  onNew: () => void;
  onEdit: (a: Agenda) => void;
  onRemove: (id: string) => void;
  onToggleDone: (a: Agenda) => void;
  onReload: () => void;
}) {
  const [uploadingAg, setUploadingAg] = useState<string | null>(null);
  const months = useMemo(() => {
    const set = new Set<string>();
    agenda.forEach((a) => a.reference_month && set.add(a.reference_month.slice(0, 7)));
    const cur = new Date().toISOString().slice(0, 7);
    set.add(cur);
    return Array.from(set).sort().reverse();
  }, [agenda]);

  const [month, setMonth] = useState<string>(months[0] || new Date().toISOString().slice(0, 7));
  const [agendaMissing, setAgendaMissing] = useState(false);
  const [docViewer, setDocViewer] = useState<{ url: string; name: string } | null>(null);
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

  // Documento (funil) da mensal por cliente — FONTE ÚNICA compartilhada com o Fechamento Operacional:
  // squad_engagement.plano_estrategico_link. Mantém fallback para o legado squad_monthly_sessions.projection_file_url
  // (dados antigos), mas todo anexo novo (aqui ou no Fechamento) grava no mesmo lugar → "só um para os dois".
  const docByClient = useMemo(() => {
    const m = new Map<string, { path: string; name: string }>();
    // legado (preenche primeiro; será sobrescrito pela fonte atual)
    for (const s of (sessions || [])) {
      if ((s.reference_month || "").slice(0, 7) !== month) continue;
      if (!s.projection_file_url) continue;
      const nm = (s.client_name || "").trim().toLowerCase();
      if (nm) m.set(nm, { path: s.projection_file_url, name: s.projection_file_name || "documento" });
    }
    // fonte atual (mesma do Fechamento) — sobrescreve o legado
    for (const e of (engagement || [])) {
      if ((e.reference_month || "").slice(0, 7) !== month) continue;
      const link = (e as any).plano_estrategico_link;
      if (!link) continue;
      const nm = (e.client_name || "").trim().toLowerCase();
      if (nm) m.set(nm, { path: link, name: String(link).split("/").pop() || "documento" });
    }
    return m;
  }, [sessions, engagement, month]);

  // Clientes com o funil da mensal anexado neste mês (mesma fonte única)
  const funilAnexado = docByClient.size;

  const openMensalDoc = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("projecoes").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o documento da mensal."); return; }
    setDocViewer({ url: data.signedUrl, name });
  };

  // Anexar/remover o documento da mensal PELA AGENDA — grava no MESMO campo do Fechamento
  // (squad_engagement.plano_estrategico_link), fazendo upsert da linha do mês se ainda não existir.
  const uploadFunilAgenda = async (clientName: string, file: File) => {
    setUploadingAg(clientName);
    try {
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      const base = file.name.slice(0, file.name.length - ext.length)
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 60) || "funil";
      const path = `fechamento/${squadId}/${month}/${Date.now()}-${base}${ext}`;
      const { error: upErr } = await supabase.storage.from("projecoes").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const ref = `${month}-01`;
      const { data: existing } = await (supabase as any).from("squad_engagement")
        .select("id").eq("squad_id", squadId).eq("reference_month", ref).ilike("client_name", clientName).is("deleted_at", null).maybeSingle();
      if (existing?.id) {
        const { error } = await (supabase as any).from("squad_engagement").update({ plano_estrategico_link: path }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("squad_engagement")
          .insert({ squad_id: squadId, reference_month: ref, client_name: clientName, plano_estrategico_link: path });
        if (error) throw error;
      }
      toast.success("Documento da mensal anexado!");
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Erro no upload");
    } finally {
      setUploadingAg(null);
    }
  };

  const removeFunilAgenda = async (clientName: string) => {
    try {
      const ref = `${month}-01`;
      const { data: existing } = await (supabase as any).from("squad_engagement")
        .select("id").eq("squad_id", squadId).eq("reference_month", ref).ilike("client_name", clientName).is("deleted_at", null).maybeSingle();
      if (existing?.id) {
        const { error } = await (supabase as any).from("squad_engagement").update({ plano_estrategico_link: null }).eq("id", existing.id);
        if (error) throw error;
      }
      toast.success("Documento removido.");
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover");
    }
  };

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
          onSaved={onReload}
          squadId={squadId}
          referenceMonth={month}
          clients={meetingOptions}
        />
        <Button onClick={onNew} className="gap-1.5 bg-gradient-to-r from-primary to-fuchsia-600 hover:opacity-90 shadow-lg shadow-primary/30"><Plus className="h-4 w-4" /> Novo Alinhamento Mensal</Button>
      </div>

      {stats.missingEntry ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
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
              <p className={`text-2xl font-black mt-0.5 ${stats.deliveryRate >= 80 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
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
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300"
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
              <p className="text-sm text-emerald-700 dark:text-emerald-300 text-center py-4">Todos os elegíveis tiveram a mensal entregue! 🎉</p>
            ) : (
              stats.missedEligible.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="outline" className="border-red-500/40 text-red-700 dark:text-red-300">sem mensal</Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Visualizador do documento da mensal — popup dentro da dash */}
      <Dialog open={!!docViewer} onOpenChange={(o) => { if (!o) setDocViewer(null); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Documento da mensal</DialogTitle>
          </DialogHeader>
          {docViewer && (
            /\.pdf(\?|$)/i.test(docViewer.name) ? (
              <iframe src={docViewer.url} title="Documento da mensal" className="w-full h-[75vh] rounded-lg border border-border/30 bg-white" />
            ) : (
              <img src={docViewer.url} alt="Documento da mensal" className="w-full h-auto rounded-lg border border-border/30" />
            )
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <SummaryStat label="Marcadas" value={stats.total} tone="primary" />
        <SummaryStat label="Realizadas" value={stats.done} tone="emerald" />
        <SummaryStat label="A fazer" value={stats.scheduled} tone="sky" />
        <SummaryStat label="Justificadas" value={stats.justified} tone="amber" />
        <SummaryStat label="% Calls" value={`${stats.pct}%`} tone="primary" />
        <SummaryStat label="Funil anexado" value={funilAnexado} tone="emerald" />
      </div>

      {stats.overdueUnjustified > 0 && (
        <div className="alert-blink rounded-xl border border-red-500/40 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-700 dark:text-red-300" />
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
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
                    <div className="flex flex-col items-start gap-1">
                      {a.done ? (
                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Realizada</Badge>
                      ) : a.not_done_reason ? (
                        <span className="text-amber-700 dark:text-amber-300" title={a.not_done_reason}>{a.not_done_reason}</span>
                      ) : (
                        <Badge className="bg-red-500/30 text-red-800 dark:text-red-200 border-red-500/40 gap-1"><AlertCircle className="h-3 w-3" /> Sem motivo</Badge>
                      )}
                      {(() => {
                        const nm = (a.client_name || "").trim().toLowerCase();
                        const doc = docByClient.get(nm);
                        return doc ? (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <button
                              onClick={() => openMensalDoc(doc.path, doc.name)}
                              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors shadow-sm"
                            >
                              <FileText className="h-4 w-4" /> Ver documento da mensal
                            </button>
                            <button
                              onClick={() => void removeFunilAgenda(a.client_name)}
                              title="Remover documento da mensal"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className={`mt-1.5 inline-flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors ${uploadingAg === a.client_name ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
                            <input type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                              onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void uploadFunilAgenda(a.client_name, fl); e.currentTarget.value = ""; }} />
                            <FileText className="h-4 w-4" /> {uploadingAg === a.client_name ? "Enviando..." : "Anexar documento da mensal"}
                          </label>
                        );
                      })()}
                    </div>
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
    2: { stroke: "295 70% 60%", from: "295 75% 65%", to: "295 80% 48%", tag: "text-fuchsia-700 dark:text-fuchsia-300" },
    3: { stroke: "160 70% 45%", from: "160 65% 52%", to: "160 75% 38%", tag: "text-emerald-700 dark:text-emerald-300" },
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
            Categorias: <strong className="text-emerald-700 dark:text-emerald-300">Acima de 8</strong> · <strong className="text-emerald-600 dark:text-emerald-400">Nota 10</strong> · <strong className="text-red-700 dark:text-red-300">Abaixo de 7</strong>. Meta: nota acima de <strong>8</strong>.
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
                  <p className="text-[11px] uppercase text-emerald-700/80 dark:text-emerald-300/80">Acima de 8</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{dist.above8} <span className="text-xs font-normal text-emerald-700/60 dark:text-emerald-300/60">({dist.pctAbove8}%)</span></p>
                </div>
                <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 p-3">
                  <p className="text-[11px] uppercase text-emerald-700/80 dark:text-emerald-300/80">Nota 10</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{dist.tens} <span className="text-xs font-normal text-emerald-700/60 dark:text-emerald-300/60">({dist.pctTen}%)</span></p>
                </div>
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-[11px] uppercase text-red-700/80 dark:text-red-300/80">Abaixo de 7</p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">{dist.below7} <span className="text-xs font-normal text-red-700/60 dark:text-red-300/60">({dist.pctBelow7}%)</span></p>
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
  // Filtro por mês de saída — começa no mês atual (o filtro serve pra ver os passados).
  const nowYM = new Date().toISOString().slice(0, 7);
  const [monthFilter, setMonthFilter] = useState<string>(nowYM);
  const [activeDetailOpen, setActiveDetailOpen] = useState(false);
  const [churnDetailList, setChurnDetailList] = useState<{ title: string; list: Churn[] } | null>(null);
  const monthOptions = useMemo(() => {
    const set = new Set(churns.map((c) => (c.churn_month || "").slice(0, 7)).filter(Boolean));
    set.add(nowYM);
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

  // Quebra dos churns por elegibilidade (mesma regra do NPS: entrou ANTES do mês da saída = ativo +30 dias)
  const churnElig = useMemo(() => {
    let eleg = 0, naoEleg = 0, semData = 0;
    for (const c of filteredChurns) {
      const em = ym(c.entry_month), cm = ym(c.churn_month);
      if (!em || !cm) { semData++; naoEleg++; continue; }
      if (em < cm) eleg++; else naoEleg++;
    }
    return { eleg, naoEleg, semData, total: filteredChurns.length };
  }, [filteredChurns]);

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

  // Clientes ativos: elegíveis (D+30, entraram antes do mês atual) / total — igual ao Fechamento
  const totalActive = activeClientsCount; // = clients.length (passado pela invocação)
  const eligList = clients.filter((c) => c.entry_date && ym(c.entry_date) < nowYM);
  const novosList = clients.filter((c) => !(c.entry_date && ym(c.entry_date) < nowYM));
  const eligActive = eligList.length;
  // meses ativos + elegibilidade + LTV de um churn (usado nos popups)
  const churnMonths = (c: Churn) => monthsBetween(c.entry_month, c.churn_month);
  const churnEligible = (c: Churn) => !!(ym(c.entry_month) && ym(c.churn_month) && ym(c.entry_month) < ym(c.churn_month));
  const churnLtv = (c: Churn) => { const m = churnMonths(c); return (c.contract_value != null && m != null && m >= 0) ? c.contract_value * m : null; };

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
        <button onClick={() => setActiveDetailOpen(true)} className="text-left rounded-2xl border border-border/30 bg-card/40 p-4 hover:ring-2 hover:ring-primary/40 transition">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Clientes ativos</p>
          <p className="text-3xl font-bold mt-1">{eligActive}/{totalActive}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{eligActive} elegíveis (D+30) · {totalActive - eligActive} novos · clique p/ ver</p>
        </button>
        <button onClick={() => setChurnDetailList({ title: `Churns · ${monthFilter === "all" ? "todos os meses" : formatMonth(`${monthFilter}-01`)}`, list: filteredChurns })} className="text-left rounded-2xl border border-red-500/30 bg-red-500/5 p-4 hover:ring-2 hover:ring-red-500/40 transition">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{monthFilter === "all" ? "Churns (todos)" : "Churns no mês"}</p>
          <p className="text-3xl font-bold text-red-700 dark:text-red-300 mt-1">{filteredChurns.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1 capitalize">{monthFilter === "all" ? "todos os meses" : formatMonth(`${monthFilter}-01`)} · clique p/ ver</p>
        </button>
        <button onClick={() => setChurnDetailList({ title: "Churns por elegibilidade (D+30)", list: filteredChurns })} className="text-left rounded-2xl border border-border/30 bg-card/40 p-4 hover:ring-2 hover:ring-primary/40 transition">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Elegibilidade (D+30)</p>
          <p className="text-2xl font-bold mt-1"><span className="text-red-700 dark:text-red-300">{churnElig.eleg}</span><span className="text-sm text-muted-foreground font-normal"> eleg</span> · <span className="text-sky-700 dark:text-sky-300">{churnElig.naoEleg}</span><span className="text-sm text-muted-foreground font-normal"> não</span></p>
          <p className="text-[10px] text-muted-foreground mt-1">saíram +30d vs novos/sem data · clique p/ ver</p>
        </button>
        <button onClick={() => setChurnDetailList({ title: "Tempo de casa dos churns (maior → menor)", list: [...filteredChurns].sort((a, b) => (churnMonths(b) ?? -1) - (churnMonths(a) ?? -1)) })} className="text-left rounded-2xl border border-border/30 bg-card/40 p-4 hover:ring-2 hover:ring-primary/40 transition">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Lifetime médio</p>
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{avgLifetime != null ? `${avgLifetime.toFixed(1)} ${avgLifetime === 1 ? "mês" : "meses"}` : "—"}</p>
          <p className="text-[10px] text-muted-foreground mt-1">média dos {lifetimes.length} churns com datas · clique p/ ver</p>
        </button>
        <button onClick={() => setChurnDetailList({ title: "LTV dos churns (contrato × meses, maior → menor)", list: [...filteredChurns].sort((a, b) => (churnLtv(b) ?? -1) - (churnLtv(a) ?? -1)) })} className="text-left rounded-2xl border border-border/30 bg-card/40 p-4 hover:ring-2 hover:ring-primary/40 transition">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">LTV médio</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{avgLtv != null ? formatBRL(avgLtv) : "—"}</p>
          <p className="text-[10px] text-muted-foreground mt-1">total {validLtvs.length ? formatBRL(totalLtv) : "—"} · {validLtvs.length} clientes · clique p/ ver</p>
        </button>
      </div>

      {/* Popup: clientes ativos (elegíveis x novos) */}
      <Dialog open={activeDetailOpen} onOpenChange={setActiveDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Clientes ativos · {eligActive}/{totalActive}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Elegíveis — D+30 ({eligList.length})</p>
              <div className="space-y-1">
                {eligList.length === 0 ? <p className="text-xs text-muted-foreground italic">Nenhum</p> : eligList.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">{c.entry_date ? formatMonth(c.entry_date) : "sem data"}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Novos do mês / sem data ({novosList.length})</p>
              <div className="space-y-1">
                {novosList.length === 0 ? <p className="text-xs text-muted-foreground italic">Nenhum</p> : novosList.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">{c.entry_date ? formatMonth(c.entry_date) : "sem data"}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Popup: detalhe completo dos churns */}
      <Dialog open={!!churnDetailList} onOpenChange={(o) => { if (!o) setChurnDetailList(null); }}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{churnDetailList?.title} ({churnDetailList?.list.length ?? 0})</DialogTitle></DialogHeader>
          {churnDetailList && (churnDetailList.list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma saída neste recorte.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/30">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead className="text-right">Meses</TableHead>
                    <TableHead>Elegível</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {churnDetailList.list.map((c) => {
                    const m = churnMonths(c); const lt = churnLtv(c); const el = churnEligible(c);
                    return (
                      <TableRow key={c.id} className="border-border/20">
                        <TableCell className="font-medium">{c.client_name}</TableCell>
                        <TableCell className="text-xs">{c.reason || "—"}</TableCell>
                        <TableCell className="text-xs">{c.entry_month ? formatMonth(c.entry_month) : "—"}</TableCell>
                        <TableCell className="text-xs">{c.churn_month ? formatMonth(c.churn_month) : "—"}</TableCell>
                        <TableCell className="text-right">{m != null ? m : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={el ? "text-[10px] border-red-500/40 text-red-700 dark:text-red-300" : "text-[10px] border-sky-500/40 text-sky-700 dark:text-sky-300"}>{el ? "Sim (D+30)" : "Não"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{lt != null ? formatBRL(lt) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
        </DialogContent>
      </Dialog>

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
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
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
                <p className={`text-3xl font-black mt-0.5 ${monthStats.withinTarget ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                  {monthStats.rate.toFixed(1)}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {monthStats.eligibleChurns} de {monthStats.eligibleBase} clientes elegíveis (ativos há +30 dias, sem os novos do mês)
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  monthStats.withinTarget
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300"
                }`}>
                  {monthStats.withinTarget ? "✓ Dentro da meta" : "⚠ Acima da meta"} · alvo ≤ 5%
                </span>
                {!monthStats.withinTarget && (
                  <p className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-1.5">
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
                  <span className="text-xs text-red-800 dark:text-red-200">{reason}</span>
                  <span className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-500/20 rounded px-1.5">{count}</span>
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
        const baseForMonth = activeClientsCount + churnsFromThisMonthOnward;
        const rate = baseForMonth > 0 ? (items.length / baseForMonth) * 100 : 0;
        const rateColor = rate >= 10 ? "text-red-700 dark:text-red-300 bg-red-500/15 border-red-500/30"
          : rate >= 5 ? "text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/30"
          : "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30";

        return (
          <div key={monthKey} className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/30 bg-muted/10">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold capitalize">{formatMonth(`${monthKey}-01`)}</span>
                <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30">
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
                        <TableCell className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{ltv != null ? formatBRL(ltv) : "-"}</TableCell>
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
