import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  NotebookPen, Search, CalendarDays, User, ChevronDown, ChevronRight, FileText,
} from "lucide-react";

type Note = {
  id: string;
  client_id: string;
  squad_id: string;
  note_date: string;
  content: string;
  created_at: string;
};

type Client = { id: string; name: string };

function pad(n: number) { return n.toString().padStart(2, "0"); }
function parseISO(d: string) {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(d);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function fmtDateBR(d: string) {
  return parseISO(d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}
function fmtMonthLabel(key: string) {
  // key = YYYY-MM
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
// ISO week within month — "Semana 1..5" baseado no domingo da semana
function weekOfMonth(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const dayOffset = first.getDay(); // 0=dom
  return Math.floor((d.getDate() + dayOffset - 1) / 7) + 1;
}
function weekRangeLabel(d: Date): string {
  const day = d.getDay(); // 0=dom..6=sab
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const f = (x: Date) => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
  return `${f(monday)} – ${f(sunday)}`;
}

export function SquadNotesReport({
  open, onClose, squadId, clients,
}: { open: boolean; onClose: () => void; squadId: string; clients: Client[] }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !squadId) return;
    void load();
  }, [open, squadId]);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("squad_daily_notes")
      .select("*")
      .eq("squad_id", squadId)
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false });
    setNotes((data || []) as Note[]);
    setLoading(false);
  }

  const clientById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  // Distinct months present in the data
  const months = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => set.add(n.note_date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [notes]);

  // Filtered notes
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (!n.content || !n.content.trim()) return false;
      if (clientFilter !== "all" && n.client_id !== clientFilter) return false;
      if (monthFilter !== "all" && !n.note_date.startsWith(monthFilter)) return false;
      if (s) {
        const name = (clientById.get(n.client_id) || "").toLowerCase();
        if (!n.content.toLowerCase().includes(s) && !name.includes(s)) return false;
      }
      return true;
    });
  }, [notes, search, clientFilter, monthFilter, clientById]);

  // Group: Month -> Week -> Notes
  const grouped = useMemo(() => {
    const out: Record<string, Record<string, Note[]>> = {};
    for (const n of filtered) {
      const d = parseISO(n.note_date);
      const monthKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const wk = `S${weekOfMonth(d)} · ${weekRangeLabel(d)}`;
      out[monthKey] ??= {};
      out[monthKey][wk] ??= [];
      out[monthKey][wk].push(n);
    }
    return out;
  }, [filtered]);

  const monthKeys = useMemo(() => Object.keys(grouped).sort().reverse(), [grouped]);

  // Stats
  const stats = useMemo(() => {
    const totalNotes = filtered.length;
    const uniqueClients = new Set(filtered.map((n) => n.client_id)).size;
    const uniqueDays = new Set(filtered.map((n) => n.note_date)).size;
    const byClient: Record<string, number> = {};
    filtered.forEach((n) => { byClient[n.client_id] = (byClient[n.client_id] || 0) + 1; });
    const top = Object.entries(byClient)
      .map(([id, count]) => ({ id, name: clientById.get(id) || "—", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { totalNotes, uniqueClients, uniqueDays, top };
  }, [filtered, clientById]);

  function toggle(key: string) {
    setExpanded((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-primary" /> Relatório de Anotações
          </DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente ou texto..."
              className="pl-8 bg-card/40 border-border/40"
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="bg-card/40 border-border/40">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="bg-card/40 border-border/40">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{fmtMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
          <Stat label="Anotações" value={String(stats.totalNotes)} icon={FileText} color="from-primary to-fuchsia-600" />
          <Stat label="Clientes" value={String(stats.uniqueClients)} icon={User} color="from-emerald-500 to-teal-600" />
          <Stat label="Dias com daily" value={String(stats.uniqueDays)} icon={CalendarDays} color="from-sky-500 to-blue-600" />
          <Card className="bg-card/40 border-border/40">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Top clientes</div>
              {stats.top.length === 0 ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : (
                <div className="space-y-0.5">
                  {stats.top.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <span className="truncate">{t.name}</span>
                      <span className="font-mono text-primary">{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lista agrupada */}
        <div className="space-y-3 mt-3">
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : monthKeys.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/40 rounded-xl">
              <NotebookPen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhuma anotação encontrada.</p>
            </div>
          ) : monthKeys.map((mk) => {
            const weeks = grouped[mk];
            const weekKeys = Object.keys(weeks).sort().reverse();
            const monthCount = Object.values(weeks).reduce((a, w) => a + w.length, 0);
            const isOpen = expanded[mk] !== false; // default open
            return (
              <Card key={mk} className="bg-card/40 border-border/40 overflow-hidden">
                <button
                  onClick={() => toggle(mk)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-primary/15 via-fuchsia-500/10 to-transparent hover:from-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="text-sm font-bold capitalize">{fmtMonthLabel(mk)}</span>
                  </div>
                  <Badge variant="outline" className="bg-primary/15 border-primary/40 text-primary">
                    {monthCount} {monthCount === 1 ? "anotação" : "anotações"}
                  </Badge>
                </button>

                {isOpen && (
                  <CardContent className="p-4 space-y-4">
                    {weekKeys.map((wk) => {
                      const items = weeks[wk];
                      // group by date inside week
                      const byDate: Record<string, Note[]> = {};
                      items.forEach((n) => { (byDate[n.note_date] ??= []).push(n); });
                      const dates = Object.keys(byDate).sort().reverse();
                      return (
                        <div key={wk}>
                          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border/30">
                            <CalendarDays className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary">{wk}</span>
                            <span className="text-[10px] text-muted-foreground">· {items.length} anot.</span>
                          </div>
                          <div className="space-y-3 pl-1">
                            {dates.map((dt) => (
                              <div key={dt}>
                                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                                  {fmtDateBR(dt)}
                                </div>
                                <div className="grid sm:grid-cols-2 gap-2">
                                  {byDate[dt].map((n) => (
                                    <div
                                      key={n.id}
                                      className="rounded-lg border border-border/40 bg-background/60 p-3 hover:border-primary/40 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-fuchsia-600 flex items-center justify-center text-[10px] font-bold text-white">
                                          {(clientById.get(n.client_id) || "?").slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-xs font-semibold truncate">
                                          {clientById.get(n.client_id) || "Cliente removido"}
                                        </span>
                                      </div>
                                      <p className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/90">
                                        {n.content}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xl font-bold mt-0.5">{value}</div>
        </div>
        <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
    </div>
  );
}
