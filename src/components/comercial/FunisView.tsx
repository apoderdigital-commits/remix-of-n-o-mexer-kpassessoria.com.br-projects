import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Target, CalendarClock, CalendarCheck2, CheckCircle2, Percent,
  Phone, UserCheck, RotateCcw, TrendingUp, UserCog,
} from "lucide-react";

// ---------- Tipos ----------
export type LeadCat = "A" | "B" | "C" | "Outro" | "Geral";
export type CatCounts = Record<LeadCat, number>;

export interface FunisData {
  trafego: { leads: CatCounts; mqls: CatCounts; agendamentos: CatCounts; comparecimentos: CatCounts };
  recuperacao: { agendamentos: CatCounts; comparecimentos: CatCounts };
  prospeccao: { prospeccoes: CatCounts; agendadas: CatCounts; comparecidas: CatCounts; noshow: CatCounts };
  geral: { agendamentos: number; comparecimentos: number; noshows: number; vendas: number };
}

export interface SdrFunil {
  user: { id: string; name: string; email?: string };
  trafego: { agendamentos: CatCounts; comparecimentos: CatCounts; vendas: CatCounts };
  recuperacao: { agendamentos: CatCounts; comparecimentos: CatCounts };
  prospeccao: { prospeccoes: CatCounts; agendadas: CatCounts; comparecidas: CatCounts };
}

const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;
const pick = (c: CatCounts | undefined, f: LeadCat) => (c ? c[f] ?? 0 : 0);

// ---------- Filtro de categoria de lead ----------
const CATS: { key: LeadCat; label: string }[] = [
  { key: "Geral", label: "Todos" },
  { key: "A", label: "Lead A" },
  { key: "B", label: "Lead B" },
  { key: "C", label: "Lead C" },
  { key: "Outro", label: "Sem tag" },
];

export function LeadCategoryFilter({ value, onChange }: { value: LeadCat; onChange: (v: LeadCat) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 bg-background/40 border border-white/10 rounded-xl p-1">
      {CATS.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
            value === c.key
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Funil visual genérico ----------
interface Stage {
  icon: any;
  label: string;
  count: number;
  grad: string;
  iconBg: string;
}

function FunnelChart({ stages }: { stages: Stage[] }) {
  const top = stages[0]?.count || 0;
  return (
    <div className="relative space-y-2 flex flex-col items-center">
      {stages.map((s, i) => {
        const width = Math.max(34, 100 - i * 14);
        const prev = i > 0 ? stages[i - 1].count : 0;
        const pctTop = top > 0 ? (s.count / top) * 100 : 0;
        const pctPrev = prev > 0 ? (s.count / prev) * 100 : 0;
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
                <div className="text-lg font-bold text-white drop-shadow-sm tracking-tight">{fmtNum(s.count)}</div>
                <div className="flex items-center gap-2 text-[11px] text-white/95">
                  <span className="bg-black/25 rounded-full px-2 py-0.5 backdrop-blur-sm font-semibold">
                    {fmtPct(pctTop)} do topo
                  </span>
                  {i > 0 && (
                    <span className="hidden md:inline bg-white/20 rounded-full px-2 py-0.5 backdrop-blur-sm">
                      ↓ {fmtPct(pctPrev)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FunnelCard({ title, subtitle, badge, stages }: { title: string; subtitle: string; badge?: string; stages: Stage[] }) {
  return (
    <Card className="relative overflow-hidden p-6 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-black/20">
      <div className="pointer-events-none absolute -top-20 right-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{subtitle}</div>
          <div className="text-lg font-semibold mt-0.5">{title}</div>
        </div>
        {badge && (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
            {badge}
          </Badge>
        )}
      </div>
      <FunnelChart stages={stages} />
    </Card>
  );
}

// Mini cards de resumo por categoria
function CatSummary({ counts }: { counts: CatCounts }) {
  const items: { k: LeadCat; l: string; c: string }[] = [
    { k: "A", l: "Lead A", c: "text-emerald-300" },
    { k: "B", l: "Lead B", c: "text-blue-300" },
    { k: "C", l: "Lead C", c: "text-amber-300" },
    { k: "Outro", l: "Sem tag", c: "text-muted-foreground" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <Card key={it.k} className="p-4 bg-card/30 backdrop-blur-xl border border-white/5 rounded-xl">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.l}</div>
          <div className={`text-2xl font-bold mt-1 ${it.c}`}>{fmtNum(counts[it.k])}</div>
        </Card>
      ))}
    </div>
  );
}

// ---------- Tráfego ----------
export function TrafegoFunnel({ funis, filter }: { funis: FunisData; filter: LeadCat }) {
  const t = funis.trafego;
  const stages: Stage[] = [
    { icon: Users, label: "Leads gerados", count: pick(t.leads, filter), grad: "from-blue-500/80 to-blue-600/40", iconBg: "bg-blue-500/20 text-blue-200" },
    { icon: Target, label: "MQLs", count: pick(t.mqls, filter), grad: "from-cyan-500/80 to-cyan-600/40", iconBg: "bg-cyan-500/20 text-cyan-200" },
    { icon: CalendarClock, label: "Agendamentos", count: pick(t.agendamentos, filter), grad: "from-violet-500/80 to-violet-600/40", iconBg: "bg-violet-500/20 text-violet-200" },
    { icon: CalendarCheck2, label: "Comparecimentos", count: pick(t.comparecimentos, filter), grad: "from-fuchsia-500/80 to-fuchsia-600/40", iconBg: "bg-fuchsia-500/20 text-fuchsia-200" },
  ];
  return (
    <div className="space-y-4">
      <FunnelCard
        title="Funil de Tráfego"
        subtitle="Atribuição pela data de criação do MQL no período"
        badge={filter === "Geral" ? "Todos os leads" : `Lead ${filter === "Outro" ? "sem tag" : filter}`}
        stages={stages}
      />
      <CatSummary counts={t.mqls} />
    </div>
  );
}

// ---------- Prospecção ----------
export function ProspeccaoFunnel({ funis, filter }: { funis: FunisData; filter: LeadCat }) {
  const p = funis.prospeccao;
  const stages: Stage[] = [
    { icon: Phone, label: "Prospecções", count: pick(p.prospeccoes, filter), grad: "from-indigo-500/80 to-indigo-600/40", iconBg: "bg-indigo-500/20 text-indigo-200" },
    { icon: CalendarClock, label: "Agendadas", count: pick(p.agendadas, filter), grad: "from-violet-500/80 to-violet-600/40", iconBg: "bg-violet-500/20 text-violet-200" },
    { icon: CalendarCheck2, label: "Comparecidas", count: pick(p.comparecidas, filter), grad: "from-fuchsia-500/80 to-fuchsia-600/40", iconBg: "bg-fuchsia-500/20 text-fuchsia-200" },
  ];
  const totalProsp = pick(p.prospeccoes, "Geral");
  return (
    <div className="space-y-4">
      <FunnelCard
        title="Funil de Prospecção"
        subtitle="Eventos recebidos da Stevo via webhook (n8n)"
        badge={filter === "Geral" ? "Todas as origens" : `Lead ${filter === "Outro" ? "sem tag" : filter}`}
        stages={stages}
      />
      {totalProsp === 0 && (
        <Card className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-200/80">
          Nenhum evento de prospecção no período. Os eventos chegam pelo webhook da Stevo (cada mensagem disparada conta como 1 prospecção).
        </Card>
      )}
      <CatSummary counts={p.prospeccoes} />
    </div>
  );
}

// ---------- Recuperação ----------
export function RecuperacaoFunnel({ funis, filter }: { funis: FunisData; filter: LeadCat }) {
  const r = funis.recuperacao;
  const stages: Stage[] = [
    { icon: RotateCcw, label: "Agendamentos", count: pick(r.agendamentos, filter), grad: "from-orange-500/80 to-orange-600/40", iconBg: "bg-orange-500/20 text-orange-200" },
    { icon: CalendarCheck2, label: "Comparecimentos", count: pick(r.comparecimentos, filter), grad: "from-amber-500/80 to-amber-600/40", iconBg: "bg-amber-500/20 text-amber-200" },
  ];
  return (
    <div className="space-y-4">
      <FunnelCard
        title="Funil de Recuperação"
        subtitle="Leads de tráfego criados antes do período, mas marcados dentro dele"
        badge={filter === "Geral" ? "Todos os leads" : `Lead ${filter === "Outro" ? "sem tag" : filter}`}
        stages={stages}
      />
      <Card className="p-4 bg-card/30 border border-white/5 rounded-xl text-xs text-muted-foreground">
        Recuperação = lead chegou em um período anterior e a reunião foi marcada para o período selecionado.
      </Card>
      <CatSummary counts={r.agendamentos} />
    </div>
  );
}

// ---------- Geral ----------
export function GeralFunis({ funis }: { funis: FunisData }) {
  const g = funis.geral;
  const cards = [
    { icon: CalendarClock, label: "Agendamentos (todos)", value: g.agendamentos, iconBg: "bg-violet-500/15 text-violet-300", ring: "ring-violet-500/20" },
    { icon: CalendarCheck2, label: "Comparecimentos", value: g.comparecimentos, iconBg: "bg-fuchsia-500/15 text-fuchsia-300", ring: "ring-fuchsia-500/20" },
    { icon: Percent, label: "No-shows", value: g.noshows, iconBg: "bg-rose-500/15 text-rose-300", ring: "ring-rose-500/20" },
    { icon: CheckCircle2, label: "Vendas", value: g.vendas, iconBg: "bg-emerald-500/15 text-emerald-300", ring: "ring-emerald-500/20" },
  ];
  const taxaComp = g.agendamentos > 0 ? (g.comparecimentos / g.agendamentos) * 100 : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className={`relative overflow-hidden p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-lg shadow-black/20 ring-1 ${c.ring}`}>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${c.iconBg}`}>
              <c.icon className="h-4 w-4" />
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground leading-tight">{c.label}</div>
            <div className="text-2xl font-bold mt-1.5">{fmtNum(c.value)}</div>
          </Card>
        ))}
      </div>
      <Card className="p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl">
        <div className="text-sm font-semibold flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-primary" /> Taxa de comparecimento consolidada
        </div>
        <div className="text-3xl font-bold text-primary">{fmtPct(taxaComp)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          Consolida calendário (tráfego + recuperação) e prospecção da Stevo.
        </div>
      </Card>
    </div>
  );
}

// ---------- SDR por funil ----------
export function SdrFunisTable({ sdrFunis, filter }: { sdrFunis: SdrFunil[]; filter: LeadCat }) {
  const [block, setBlock] = useState<"trafego" | "recuperacao" | "prospeccao">("trafego");

  const blocks = [
    { key: "trafego" as const, label: "Tráfego" },
    { key: "recuperacao" as const, label: "Recuperação" },
    { key: "prospeccao" as const, label: "Prospecção" },
  ];

  const rows = sdrFunis
    .map((s) => {
      if (block === "trafego") {
        const ag = pick(s.trafego.agendamentos, filter);
        const co = pick(s.trafego.comparecimentos, filter);
        const ve = pick(s.trafego.vendas, filter);
        return { name: s.user.name, c1: ag, c2: co, c3: ve, rate: ag > 0 ? (co / ag) * 100 : 0, total: ag + co + ve };
      }
      if (block === "recuperacao") {
        const ag = pick(s.recuperacao.agendamentos, filter);
        const co = pick(s.recuperacao.comparecimentos, filter);
        return { name: s.user.name, c1: ag, c2: co, c3: null as number | null, rate: ag > 0 ? (co / ag) * 100 : 0, total: ag + co };
      }
      const pr = pick(s.prospeccao.prospeccoes, filter);
      const ag = pick(s.prospeccao.agendadas, filter);
      const co = pick(s.prospeccao.comparecidas, filter);
      return { name: s.user.name, c1: pr, c2: ag, c3: co, rate: pr > 0 ? (ag / pr) * 100 : 0, total: pr + ag + co };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const headers =
    block === "trafego"
      ? ["SDR", "Agendados", "Comparecidos", "Vendas", "% Comp."]
      : block === "recuperacao"
      ? ["SDR", "Agendados", "Comparecidos", "% Comp."]
      : ["SDR", "Prospecções", "Agendadas", "Comparecidas", "% Agend."];

  return (
    <Card className="p-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="text-sm font-semibold flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" /> Performance por SDR
        </div>
        <div className="inline-flex gap-1 bg-background/40 border border-white/10 rounded-xl p-1">
          {blocks.map((b) => (
            <button
              key={b.key}
              onClick={() => setBlock(b.key)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                block === b.key
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Sem dados para este bloco no período.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              {headers.map((h, i) => (
                <TableHead key={h} className={i === 0 ? "" : "text-right"}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name} className="border-white/5">
                <TableCell className="font-medium flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground" /> {r.name}
                </TableCell>
                <TableCell className="text-right">{fmtNum(r.c1)}</TableCell>
                <TableCell className="text-right">{fmtNum(r.c2)}</TableCell>
                {r.c3 !== null && <TableCell className="text-right">{fmtNum(r.c3)}</TableCell>}
                <TableCell className="text-right">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">{fmtPct(r.rate)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
