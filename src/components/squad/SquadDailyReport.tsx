import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2, Clock, AlertTriangle, CalendarX, FileText, Save,
} from "lucide-react";
import { toast } from "sonner";

type Session = {
  id: string;
  squad_id: string;
  session_date: string;
  started_at: string;
  ended_at: string | null;
  delay_seconds: number;
  on_time: boolean;
  total_seconds: number | null;
};
type SessionClient = {
  id: string;
  session_id: string;
  client_id: string;
  prioritization: string | null;
  seconds_spent: number;
};
type Skip = { id: string; squad_id: string; skip_date: string; reason: string };

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
function monthRange() {
  const today = brtToday();
  const start = today.slice(0, 7) + "-01";
  return { start, end: today };
}
function isWeekday(iso: string) {
  // 0=sun, 6=sat — base local doesn't matter for day-of-week
  const d = new Date(iso + "T12:00:00Z").getUTCDay();
  return d >= 1 && d <= 5;
}
function listWeekdays(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  while (d <= e) {
    const iso = d.toISOString().slice(0, 10);
    if (isWeekday(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function SquadDailyReport({
  open, onClose, squadId,
}: { open: boolean; onClose: () => void; squadId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [scs, setScs] = useState<SessionClient[]>([]);
  const [skips, setSkips] = useState<Skip[]>([]);
  const [loading, setLoading] = useState(false);
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !squadId) return;
    void load();
  }, [open, squadId]);

  async function load() {
    setLoading(true);
    const { start, end } = monthRange();
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
      const ids = sList.map((s) => s.id);
      const { data } = await (supabase as any).from("squad_daily_session_clients")
        .select("*").in("session_id", ids);
      setScs((data || []) as SessionClient[]);
    } else {
      setScs([]);
    }
    setLoading(false);
  }

  const stats = useMemo(() => {
    const { start, end } = monthRange();
    const weekdays = listWeekdays(start, end);
    const doneDates = new Set(sessions.map((s) => s.session_date));
    const skippedDates = new Set(skips.map((s) => s.skip_date));
    const done = weekdays.filter((d) => doneDates.has(d));
    const missing = weekdays.filter((d) => !doneDates.has(d) && d <= end);
    const onTime = sessions.filter((s) => s.on_time).length;
    const late = sessions.filter((s) => !s.on_time).length;
    const totalDelay = sessions.reduce((a, s) => a + (s.delay_seconds || 0), 0);
    const avgDelay = sessions.length ? Math.floor(totalDelay / sessions.length) : 0;
    const avgDuration = sessions.filter((s) => s.total_seconds).length
      ? Math.floor(
          sessions.filter((s) => s.total_seconds).reduce((a, s) => a + (s.total_seconds || 0), 0) /
          sessions.filter((s) => s.total_seconds).length,
        )
      : 0;

    // by priority
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
      skippedDates,
      onTime,
      late,
      avgDelay,
      avgDuration,
      prioRows,
    };
  }, [sessions, scs, skips]);

  async function saveSkip(date: string) {
    const reason = (reasonDraft[date] || "").trim();
    if (!reason) { toast.error("Informe o motivo"); return; }
    const { data: u } = await supabase.auth.getUser();
    const existing = skips.find((s) => s.skip_date === date);
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Relatório de Dailys — Mês atual
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Realizadas no mês" value={`${stats.done}`} sub={`de ${stats.weekdaysCount} dias úteis`} icon={CheckCircle2} color="from-emerald-500 to-teal-600" />
              <Stat label="Faltando" value={`${stats.missing.length}`} sub="dias úteis" icon={CalendarX} color="from-red-500 to-orange-600" warn={stats.missing.filter((d) => !stats.skippedDates.has(d)).length > 0} />
              <Stat label="No horário" value={`${stats.onTime}`} sub={`atrasadas: ${stats.late}`} icon={Clock} color="from-primary to-fuchsia-600" />
              <Stat label="Duração média" value={fmtMinSec(stats.avgDuration)} sub={`atraso médio: ${fmtMinSec(stats.avgDelay)}`} icon={AlertTriangle} color="from-amber-500 to-orange-600" />
            </div>

            {/* Faltando — pisca */}
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
                      const skip = skips.find((s) => s.skip_date === d);
                      const justified = !!skip;
                      return (
                        <div
                          key={d}
                          className={`rounded-lg border p-3 flex items-start gap-3 flex-wrap ${justified ? "border-border/40 bg-background/40" : "border-red-500/40 bg-red-500/10 animate-pulse"}`}
                        >
                          <div className="flex items-center gap-2 min-w-[140px]">
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

            {/* Tempo médio por priorização */}
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

            {/* Histórico recente */}
            <Card className="bg-card/40 border-border/40">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold mb-3">Sessões do mês</h3>
                {sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma daily registrada.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md bg-background/40 border border-border/30 px-3 py-2 text-xs">
                        <span className="font-semibold">
                          {new Date(s.session_date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                        <span className="text-muted-foreground">
                          Início {new Date(s.started_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <Badge variant="outline" className={s.on_time ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-red-500/15 text-red-300 border-red-500/40"}>
                          {s.on_time ? "No horário" : `Atraso ${fmtMinSec(s.delay_seconds)}`}
                        </Badge>
                        <span className="font-mono tabular-nums">{s.total_seconds ? fmtMinSec(s.total_seconds) : "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
