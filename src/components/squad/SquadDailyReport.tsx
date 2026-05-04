import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2, Clock, AlertTriangle, CalendarX, FileText, Save,
  Trash2, RotateCcw, Ban, ChevronLeft, ChevronRight, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { ActionVerificationDialog } from "@/components/ActionVerificationDialog";

type Session = {
  id: string;
  squad_id: string;
  session_date: string;
  started_at: string;
  ended_at: string | null;
  delay_seconds: number;
  on_time: boolean;
  total_seconds: number | null;
  deleted_at: string | null;
};
type SessionClient = {
  id: string;
  session_id: string;
  client_id: string;
  prioritization: string | null;
  seconds_spent: number;
};
type Skip = { id: string; squad_id: string; skip_date: string; reason: string };

const ON_TIME_THRESHOLD = 5 * 60; // <= 5min delay = on time

function pad(n: number) { return n.toString().padStart(2, "0"); }
function fmtMinSec(sec: number) {
  if (!sec) return "0min";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}min ${pad(s)}s`;
}
function brtToday() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
function isWeekday(iso: string) {
  const d = new Date(iso + "T12:00:00Z").getUTCDay();
  return d >= 1 && d <= 5;
}
function isWeekend(iso: string) {
  const d = new Date(iso + "T12:00:00Z").getUTCDay();
  return d === 0 || d === 6;
}
function listAllDays(year: number, month0: number): string[] {
  const out: string[] = [];
  const last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    out.push(`${year}-${pad(month0 + 1)}-${pad(d)}`);
  }
  return out;
}

export function SquadDailyReport({
  open, onClose, squadId,
}: { open: boolean; onClose: () => void; squadId: string }) {
  const today = brtToday();
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [scs, setScs] = useState<SessionClient[]>([]);
  const [skips, setSkips] = useState<Skip[]>([]);
  const [loading, setLoading] = useState(false);
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});
  const [showTrash, setShowTrash] = useState(false);
  const [verif, setVerif] = useState<{ id: string; date: string } | null>(null);

  useEffect(() => {
    if (!open || !squadId) return;
    void load();
  }, [open, squadId, cursor]);

  async function load() {
    setLoading(true);
    const start = `${cursor.y}-${pad(cursor.m + 1)}-01`;
    const lastDay = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const end = `${cursor.y}-${pad(cursor.m + 1)}-${pad(lastDay)}`;

    const [sRes, skRes] = await Promise.all([
      (supabase as any).from("squad_daily_sessions")
        .select("*").eq("squad_id", squadId)
        .gte("session_date", start).lte("session_date", end)
        .order("session_date", { ascending: false }),
      (supabase as any).from("squad_daily_skips")
        .select("*").eq("squad_id", squadId)
        .gte("skip_date", start).lte("skip_date", end),
    ]);
    const sList = (sRes.data || []) as Session[];
    setSessions(sList);
    setSkips((skRes.data || []) as Skip[]);
    if (sList.length > 0) {
      const ids = sList.filter((s) => !s.deleted_at).map((s) => s.id);
      if (ids.length) {
        const { data } = await (supabase as any).from("squad_daily_session_clients")
          .select("*").in("session_id", ids);
        setScs((data || []) as SessionClient[]);
      } else {
        setScs([]);
      }
    } else {
      setScs([]);
    }
    setLoading(false);
  }

  const monthLabel = useMemo(
    () => new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [cursor],
  );

  const allDays = useMemo(() => listAllDays(cursor.y, cursor.m), [cursor]);
  const activeSessions = useMemo(() => sessions.filter((s) => !s.deleted_at), [sessions]);
  const trashedSessions = useMemo(() => sessions.filter((s) => s.deleted_at), [sessions]);

  // Map date -> best session (active, latest-started)
  const sessionByDate = useMemo(() => {
    const m = new Map<string, Session>();
    activeSessions.forEach((s) => {
      const cur = m.get(s.session_date);
      if (!cur || new Date(s.started_at) > new Date(cur.started_at)) m.set(s.session_date, s);
    });
    return m;
  }, [activeSessions]);
  const skipByDate = useMemo(() => new Map(skips.map((s) => [s.skip_date, s])), [skips]);

  const stats = useMemo(() => {
    const weekdays = allDays.filter(isWeekday);
    const upToToday = weekdays.filter((d) => d <= today);
    const done = upToToday.filter((d) => sessionByDate.has(d));
    const missing = upToToday.filter((d) => !sessionByDate.has(d));
    const sessList = Array.from(sessionByDate.values());
    const onTime = sessList.filter((s) => (s.delay_seconds || 0) <= ON_TIME_THRESHOLD).length;
    const late = sessList.length - onTime;
    const totalDelay = sessList.reduce((a, s) => a + (s.delay_seconds || 0), 0);
    const avgDelay = sessList.length ? Math.floor(totalDelay / sessList.length) : 0;
    const finished = sessList.filter((s) => s.total_seconds);
    const avgDuration = finished.length
      ? Math.floor(finished.reduce((a, s) => a + (s.total_seconds || 0), 0) / finished.length)
      : 0;

    const byPrio: Record<string, { total: number; count: number }> = {};
    scs.forEach((c) => {
      const k = c.prioritization || "—";
      if (!byPrio[k]) byPrio[k] = { total: 0, count: 0 };
      byPrio[k].total += c.seconds_spent || 0;
      byPrio[k].count += 1;
    });
    const prioRows = Object.entries(byPrio)
      .map(([k, v]) => ({ key: k, avg: Math.floor(v.total / v.count), count: v.count }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return {
      weekdaysCount: weekdays.length,
      done: done.length,
      missing,
      onTime,
      late,
      avgDelay,
      avgDuration,
      prioRows,
    };
  }, [allDays, sessionByDate, scs, today]);

  async function saveSkip(date: string) {
    const reason = (reasonDraft[date] || "").trim();
    if (!reason) { toast.error("Informe o motivo"); return; }
    const { data: u } = await supabase.auth.getUser();
    const existing = skipByDate.get(date);
    if (existing) {
      await (supabase as any).from("squad_daily_skips").update({ reason }).eq("id", existing.id);
    } else {
      await (supabase as any).from("squad_daily_skips").insert({
        squad_id: squadId, skip_date: date, reason, created_by: u?.user?.id,
      });
    }
    toast.success("Justificativa salva");
    void load();
  }

  async function trashSession(id: string) {
    if (!confirm("Mover esta daily para a lixeira? (será excluída em 30 dias)")) return;
    const { error } = await (supabase as any)
      .from("squad_daily_sessions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Movida para lixeira");
    void load();
  }
  async function restoreSession(id: string) {
    const { error } = await (supabase as any)
      .from("squad_daily_sessions").update({ deleted_at: null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Restaurada");
    void load();
  }
  function askPurge(s: Session) {
    setVerif({ id: s.id, date: s.session_date });
  }

  function dayClass(d: string): { bg: string; label: string; tooltip: string } {
    if (isWeekend(d)) return { bg: "bg-muted/20 text-muted-foreground/50", label: "—", tooltip: "Bloqueado (fim de semana)" };
    const sess = sessionByDate.get(d);
    if (sess) {
      if ((sess.delay_seconds || 0) <= ON_TIME_THRESHOLD) {
        return { bg: "bg-emerald-500/30 text-emerald-200 border-emerald-500/50", label: "✓", tooltip: `Feita no horário · ${fmtMinSec(sess.total_seconds || 0)}` };
      }
      return { bg: "bg-amber-500/30 text-amber-200 border-amber-500/50", label: "⏱", tooltip: `Atraso ${fmtMinSec(sess.delay_seconds)} · ${fmtMinSec(sess.total_seconds || 0)}` };
    }
    if (d > today) return { bg: "bg-card/40 text-muted-foreground border-border/30", label: "", tooltip: "Futuro" };
    const skip = skipByDate.get(d);
    if (skip) return { bg: "bg-sky-500/20 text-sky-200 border-sky-500/40", label: "!", tooltip: `Justificada: ${skip.reason}` };
    return { bg: "bg-red-500/30 text-red-200 border-red-500/50 animate-pulse", label: "✕", tooltip: "Não realizada — sem justificativa" };
  }

  // Calendar grid (Mon-Sun)
  const firstDow = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay(); // 0=Sun
  const padStart = (firstDow + 6) % 7; // shift so Mon=0

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Relatório de Dailys
          </DialogTitle>
        </DialogHeader>

        {/* Month navigator */}
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: c.m === 0 ? 11 : c.m - 1 }))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-bold capitalize">{monthLabel}</div>
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Realizadas" value={`${stats.done}`} sub={`de ${stats.weekdaysCount} dias úteis`} icon={CheckCircle2} color="from-emerald-500 to-teal-600" />
              <Stat label="Faltando" value={`${stats.missing.length}`} sub="dias úteis" icon={CalendarX} color="from-red-500 to-orange-600" warn={stats.missing.some((d) => !skipByDate.has(d))} />
              <Stat label="No horário" value={`${stats.onTime}`} sub={`atrasadas: ${stats.late}`} icon={Clock} color="from-primary to-fuchsia-600" />
              <Stat label="Duração média" value={fmtMinSec(stats.avgDuration)} sub={`atraso médio: ${fmtMinSec(stats.avgDelay)}`} icon={AlertTriangle} color="from-amber-500 to-orange-600" />
            </div>

            {/* Calendar */}
            <Card className="bg-card/40 border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-bold">Calendário do mês</h3>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    <Legend color="bg-emerald-500/40 border-emerald-500/60" label="Feita no horário" />
                    <Legend color="bg-amber-500/40 border-amber-500/60" label="Feita com atraso" />
                    <Legend color="bg-red-500/40 border-red-500/60" label="Não feita" />
                    <Legend color="bg-sky-500/30 border-sky-500/60" label="Justificada" />
                    <Legend color="bg-muted/30 border-muted/60" label="Bloqueado" />
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                    <div key={d} className="text-[10px] text-muted-foreground font-semibold py-1">{d}</div>
                  ))}
                  {Array.from({ length: padStart }).map((_, i) => <div key={`p${i}`} />)}
                  {allDays.map((d) => {
                    const c = dayClass(d);
                    const day = Number(d.slice(8));
                    const isToday = d === today;
                    const blocked = isWeekend(d);
                    return (
                      <div
                        key={d}
                        title={c.tooltip}
                        className={`relative rounded-lg border p-1.5 min-h-[52px] flex flex-col items-center justify-center text-xs ${c.bg} ${isToday ? "ring-2 ring-primary" : ""}`}
                      >
                        <div className="text-[11px] font-bold">{day}</div>
                        <div className="text-base leading-none">{c.label}</div>
                        {blocked && <Lock className="absolute top-1 right-1 h-2.5 w-2.5 opacity-50" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Faltando — justificar */}
            <Card className="bg-card/40 border-border/40">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <CalendarX className="h-4 w-4 text-red-400" />
                  Dias úteis sem daily
                </h3>
                {stats.missing.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tudo em dia! 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {stats.missing.map((d) => {
                      const skip = skipByDate.get(d);
                      const justified = !!skip;
                      return (
                        <div
                          key={d}
                          className={`rounded-lg border p-3 flex items-start gap-3 flex-wrap ${justified ? "border-border/40 bg-background/40" : "border-red-500/40 bg-red-500/10 animate-pulse"}`}
                        >
                          <div className="flex items-center gap-2 min-w-[160px]">
                            {!justified && <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-ping" />}
                            <span className="text-sm font-semibold">
                              {new Date(d + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                            </span>
                            {justified && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40">Justificada</Badge>}
                          </div>
                          <div className="flex-1 min-w-[240px] flex gap-2">
                            <Textarea
                              rows={1}
                              defaultValue={skip?.reason || ""}
                              onChange={(e) => setReasonDraft((p) => ({ ...p, [d]: e.target.value }))}
                              placeholder="Motivo..."
                              className="bg-background/60 border-border/40 text-sm min-h-[40px]"
                            />
                            <Button size="sm" variant="outline" onClick={() => saveSkip(d)} className="gap-1.5">
                              <Save className="h-3.5 w-3.5" /> Salvar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Por priorização */}
            <Card className="bg-card/40 border-border/40">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold mb-3">Tempo médio por nível de priorização</h3>
                {stats.prioRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {stats.prioRows.map((r) => (
                      <div key={r.key} className="rounded-lg border border-border/40 bg-background/40 p-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="bg-muted/40">{r.key}</Badge>
                          <span className="text-[10px] text-muted-foreground">{r.count} passagens</span>
                        </div>
                        <div className="text-lg font-bold mt-1 font-mono tabular-nums">{fmtMinSec(r.avg)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sessões + lixeira */}
            <Card className="bg-card/40 border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-bold">{showTrash ? "Lixeira (auto-exclusão em 30 dias)" : "Sessões do mês"}</h3>
                  <Button size="sm" variant="outline" onClick={() => setShowTrash((v) => !v)} className="gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    {showTrash ? `Ver ativas (${activeSessions.length})` : `Ver lixeira (${trashedSessions.length})`}
                  </Button>
                </div>
                {(showTrash ? trashedSessions : activeSessions).length === 0 ? (
                  <p className="text-xs text-muted-foreground">{showTrash ? "Lixeira vazia." : "Nenhuma daily registrada."}</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {(showTrash ? trashedSessions : activeSessions).map((s) => {
                      const onTime = (s.delay_seconds || 0) <= ON_TIME_THRESHOLD;
                      return (
                        <div key={s.id} className="flex items-center justify-between gap-2 rounded-md bg-background/40 border border-border/30 px-3 py-2 text-xs flex-wrap">
                          <span className="font-semibold min-w-[80px]">
                            {new Date(s.session_date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </span>
                          <span className="text-muted-foreground">
                            Início {new Date(s.started_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Badge variant="outline" className={onTime ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}>
                            {onTime ? "No horário" : `Atraso ${fmtMinSec(s.delay_seconds)}`}
                          </Badge>
                          <span className="font-mono tabular-nums">{s.total_seconds ? fmtMinSec(s.total_seconds) : "—"}</span>
                          <div className="flex gap-1">
                            {showTrash ? (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => restoreSession(s.id)} className="h-7 gap-1">
                                  <RotateCcw className="h-3 w-3" /> Restaurar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => askPurge(s)} className="h-7 gap-1 text-red-400 hover:text-red-300">
                                  <Ban className="h-3 w-3" /> Excluir definitivo
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => trashSession(s.id)} className="h-7 gap-1 text-red-400 hover:text-red-300">
                                <Trash2 className="h-3 w-3" /> Excluir
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {verif && (
      <ActionVerificationDialog
        open={!!verif}
        onOpenChange={(o) => !o && setVerif(null)}
        action="purge_squad_daily_session"
        payload={{ session_id: verif.id }}
        targetLabel={`Daily de ${verif.date}`}
        title="Excluir definitivamente"
        successMessage="Daily excluída"
        onSuccess={() => { setVerif(null); void load(); }}
      />
    )}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded border ${color}`} /> {label}
    </span>
  );
}

function Stat({
  label, value, sub, icon: Icon, color, warn,
}: { label: string; value: string; sub?: string; icon: any; color: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 backdrop-blur-sm ${warn ? "border-red-500/40 bg-red-500/10 animate-pulse" : "border-border/40 bg-card/40"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
          {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
        <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
    </div>
  );
}
