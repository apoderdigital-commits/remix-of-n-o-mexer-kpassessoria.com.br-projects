import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft, ChevronRight, Clock, Flag, Pause, Play, X, Save,
  AlertTriangle, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

type Client = {
  id: string;
  squad_id: string;
  name: string;
  niche: string | null;
  services: string | null;
  curve_abc: string | null;
  sprint: string | null;
  prioritization: string | null;
  priority_score: number;
  invested_tp: string | null;
  observations: string | null;
};

type DailyNote = {
  id: string;
  client_id: string;
  note_date: string;
  content: string;
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

const DAILY_DURATION_MS = 60 * 60 * 1000; // 1h

function pad(n: number) { return n.toString().padStart(2, "0"); }
function fmtDuration(ms: number) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Calcula atraso vs 09:00 horário de Brasília (UTC-3)
function getDelayFrom9AM(start: Date): number {
  // Brasília offset: UTC-3 fixo (sem horário de verão atualmente)
  const utcMs = start.getTime();
  const brasiliaMs = utcMs - 3 * 3600 * 1000;
  const d = new Date(brasiliaMs);
  const target = new Date(d);
  target.setUTCHours(9, 0, 0, 0);
  return brasiliaMs - target.getTime();
}

function fmtBrasiliaTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

function todayISO() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  const d = new Date(Date.now() - 3 * 3600 * 1000 - n * 86400000);
  return d.toISOString().slice(0, 10);
}

export function SquadDaily({
  open,
  onClose,
  squadId,
  clients,
  resumeSession,
}: {
  open: boolean;
  onClose: () => void;
  squadId: string;
  clients: Client[];
  resumeSession?: { id: string; started_at: string } | null;
}) {
  // Ordem: do maior para o menor nível de priorização (AA = mais crítico, começa por ele).
  // priority_score: AA=0 ... CC=8. "maior priorização" = score menor.
  const ordered = useMemo(
    () => [...clients].sort((a, b) => a.priority_score - b.priority_score || a.name.localeCompare(b.name)),
    [clients],
  );

  const [idx, setIdx] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [content, setContent] = useState("");
  const [history, setHistory] = useState<DailyNote[]>([]);
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState<number>(10);
  const [paused, setPaused] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const noteIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const clientStartRef = useRef<number>(Date.now());
  const closedRef = useRef<boolean>(false);

  const current = ordered[idx];

  // Reset when opening / handle resume
  useEffect(() => {
    if (!open) return;
    closedRef.current = false;
    setConfirmClose(false);
    if (resumeSession) {
      setIdx(0);
      const st = new Date(resumeSession.started_at);
      setStartedAt(st);
      clientStartRef.current = Date.now();
      sessionIdRef.current = resumeSession.id;
      setCountdown(0);
      setPaused(false);
    } else {
      setIdx(0);
      setStartedAt(null);
      sessionIdRef.current = null;
      setCountdown(10);
      setPaused(false);
    }
  }, [open, resumeSession?.id]);

  // Countdown tick
  useEffect(() => {
    if (!open || startedAt || paused) return;
    if (countdown <= 0) {
      void beginSession();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [open, startedAt, paused, countdown]);

  async function beginSession() {
    const start = new Date();
    setStartedAt(start);
    clientStartRef.current = start.getTime();
    const { data: u } = await supabase.auth.getUser();
    const delaySec = Math.max(0, Math.floor(getDelayFrom9AM(start) / 1000));
    const { data, error } = await (supabase as any)
      .from("squad_daily_sessions")
      .insert({
        squad_id: squadId,
        session_date: todayISO(),
        started_at: start.toISOString(),
        delay_seconds: delaySec,
        on_time: delaySec <= 5 * 60,
        created_by: u?.user?.id,
      })
      .select().single();
    if (!error && data) sessionIdRef.current = data.id;
  }

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  async function logClientTime(client: Client) {
    if (!sessionIdRef.current) return;
    const seconds = Math.max(0, Math.floor((Date.now() - clientStartRef.current) / 1000));
    if (seconds < 1) return;
    await (supabase as any).from("squad_daily_session_clients").insert({
      session_id: sessionIdRef.current,
      client_id: client.id,
      prioritization: client.prioritization,
      seconds_spent: seconds,
      position: ordered.findIndex((c) => c.id === client.id),
    });
    clientStartRef.current = Date.now();
  }

  // Carrega nota do dia + histórico (7 dias e do mês) para o cliente atual
  useEffect(() => {
    if (!open || !current) return;
    noteIdRef.current = null;
    setContent("");
    setHistory([]);
    const since = daysAgoISO(30);
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("squad_daily_notes")
        .select("*")
        .eq("client_id", current.id)
        .gte("note_date", since)
        .order("note_date", { ascending: false });
      if (error) return;
      const list = (data || []) as DailyNote[];
      setHistory(list);
      const today = list.find((n) => n.note_date === todayISO());
      if (today) {
        noteIdRef.current = today.id;
        setContent(today.content || "");
      }
    })();
  }, [open, current?.id]);

  async function saveNote(showToast = true) {
    if (!current) return;
    setSaving(true);
    const today = todayISO();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (noteIdRef.current) {
      const { error } = await (supabase as any)
        .from("squad_daily_notes")
        .update({ content })
        .eq("id", noteIdRef.current);
      if (error) toast.error("Erro ao salvar");
      else if (showToast) toast.success("Anotação salva");
    } else {
      const { data, error } = await (supabase as any)
        .from("squad_daily_notes")
        .insert({
          squad_id: squadId,
          client_id: current.id,
          note_date: today,
          content,
          created_by: userId,
        })
        .select()
        .single();
      if (error) toast.error("Erro ao salvar");
      else {
        noteIdRef.current = data.id;
        if (showToast) toast.success("Anotação salva");
      }
    }
    setSaving(false);
  }

  async function go(delta: number) {
    await saveNote(false);
    if (current) await logClientTime(current);
    const next = Math.min(Math.max(idx + delta, 0), ordered.length - 1);
    setIdx(next);
  }

  function requestClose() {
    if (closedRef.current) { onClose(); return; }
    // If still in countdown phase, just close without prompt
    if (!startedAt) { closedRef.current = true; onClose(); return; }
    setConfirmClose(true);
  }

  function pauseAndExit() {
    // Save state but DO NOT mark session as ended — allows resuming later
    if (closedRef.current) { onClose(); return; }
    closedRef.current = true;
    void (async () => {
      await saveNote(false);
      if (current) await logClientTime(current);
      onClose();
    })();
  }

  function finalizeClose() {
    if (closedRef.current) { onClose(); return; }
    closedRef.current = true;
    void (async () => {
      await saveNote(false);
      if (current) await logClientTime(current);
      if (sessionIdRef.current && startedAt) {
        const totalSec = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        await (supabase as any).from("squad_daily_sessions")
          .update({ ended_at: new Date().toISOString(), total_seconds: totalSec })
          .eq("id", sessionIdRef.current);
      }
      onClose();
    })();
  }

  if (!current) return null;

  // Timer info
  const elapsed = startedAt ? now.getTime() - startedAt.getTime() : 0;
  const remaining = DAILY_DURATION_MS - elapsed;
  const endAt = startedAt ? new Date(startedAt.getTime() + DAILY_DURATION_MS) : null;

  // Atraso vs 09:00 BRT
  const delayMs = startedAt ? Math.max(0, getDelayFrom9AM(startedAt)) : 0;

  const last7 = history.filter((n) => n.note_date >= daysAgoISO(7) && n.note_date !== todayISO());
  const monthStart = todayISO().slice(0, 7) + "-01";
  const monthNotes = history.filter((n) => n.note_date >= monthStart && n.note_date !== todayISO());

  // Countdown screen before daily begins
  if (open && !startedAt) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && (closedRef.current = true, onClose())}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-border/40">
          <div className="px-8 py-12 text-center bg-gradient-to-br from-primary/15 via-fuchsia-500/10 to-emerald-500/10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">A daily começa em</p>
            <div className={`mx-auto h-44 w-44 rounded-full flex items-center justify-center text-7xl font-black tabular-nums shadow-2xl border-4 transition-all ${paused ? "border-amber-500/60 bg-amber-500/10 text-amber-300" : "border-primary/60 bg-primary/10 text-primary animate-pulse"}`}>
              {countdown}
            </div>
            <p className="text-sm text-muted-foreground mt-5">
              Prepare-se. {paused ? "Contagem pausada." : "Iniciando automaticamente..."}
            </p>
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button variant="outline" onClick={() => setPaused((p) => !p)} className="gap-1.5">
                {paused ? <><Play className="h-4 w-4" /> Continuar</> : <><Pause className="h-4 w-4" /> Pausar</>}
              </Button>
              <Button variant="outline" onClick={() => { closedRef.current = true; onClose(); }} className="gap-1.5">
                <X className="h-4 w-4" /> Encerrar
              </Button>
              <Button onClick={() => { setCountdown(0); }} className="gap-1.5 bg-gradient-to-r from-primary to-fuchsia-600">
                <Play className="h-4 w-4" /> Começar agora
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={open && !confirmClose} onOpenChange={(o) => !o && requestClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-background border-border/40">
        {/* Header timer */}
        <div className="px-6 py-4 bg-gradient-to-r from-primary/15 via-fuchsia-500/10 to-emerald-500/10 border-b border-border/30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-fuchsia-600 flex items-center justify-center shadow-lg">
                <Play className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">Daily em andamento</h2>
                <p className="text-xs text-muted-foreground">
                  Cliente {idx + 1} de {ordered.length} · do maior para o menor nível de priorização
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={requestClose} className="gap-1.5">
                <X className="h-4 w-4" /> Encerrar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <TimerStat
              label="Tempo restante"
              value={fmtDuration(remaining)}
              icon={Clock}
              warn={remaining < 5 * 60 * 1000}
            />
            <TimerStat label="Decorrido" value={fmtDuration(elapsed)} icon={Pause} />
            <TimerStat
              label="Atraso (9h BRT)"
              value={delayMs > 0 ? fmtDuration(delayMs) : "00:00:00"}
              icon={AlertTriangle}
              warn={delayMs > 0}
            />
            <TimerStat
              label="Termina às"
              value={endAt ? fmtBrasiliaTime(endAt) : "--:--"}
              icon={Flag}
            />
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Card do cliente */}
          <Card className="bg-card/40 border-border/40">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg bg-gradient-to-br from-primary to-fuchsia-600"
                  >
                    {current.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{current.name}</h3>
                    <p className="text-xs text-muted-foreground">{current.niche || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {current.prioritization && (
                    <Badge
                      variant="outline"
                      className={PRIORITY_COLORS[current.prioritization] || "bg-muted/40"}
                    >
                      Prior. {current.prioritization}
                    </Badge>
                  )}
                  {current.curve_abc && (
                    <Badge variant="outline" className="bg-muted/40">ABC: {current.curve_abc}</Badge>
                  )}
                  {current.sprint && (
                    <Badge variant="outline" className="bg-muted/40">Sprint: {current.sprint}</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 text-sm">
                <InfoCell label="Investido (TP)" value={current.invested_tp || "—"} highlight />
                <InfoCell label="Serviços" value={current.services || "—"} />
                <InfoCell label="Observações" value={current.observations || "—"} />
              </div>
            </CardContent>
          </Card>

          {/* Anotação do dia */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-primary" />
                Anotação de hoje
              </label>
              <Button size="sm" variant="ghost" onClick={() => saveNote(true)} disabled={saving} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Salvar
              </Button>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O que vamos fazer hoje para este cliente?"
              rows={5}
              className="bg-card/40 border-border/40"
            />
          </div>

          {/* Histórico */}
          {(last7.length > 0 || monthNotes.length > 0) && (
            <div className="space-y-3">
              {last7.length > 0 && (
                <HistoryStrip title="Últimos 7 dias" notes={last7.slice(0, 7)} />
              )}
              {monthNotes.length > last7.length && (
                <HistoryStrip
                  title="Mês"
                  notes={monthNotes.filter((n) => !last7.find((x) => x.id === n.id))}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-border/30 bg-card/30 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => go(-1)}
            disabled={idx === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            {idx + 1} / {ordered.length}
          </span>
          {idx < ordered.length - 1 ? (
            <Button onClick={() => go(1)} className="gap-1.5">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finalizeClose} className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600">
              Finalizar daily
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmClose} onOpenChange={(o) => !o && setConfirmClose(false)}>
      <DialogContent className="max-w-md bg-background border-border/40">
        <div className="p-2">
          <h3 className="text-lg font-bold mb-1">Encerrar a daily?</h3>
          <p className="text-sm text-muted-foreground mb-5">
            A daily ainda está em andamento. O que deseja fazer?
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => { setConfirmClose(false); }} variant="outline" className="gap-1.5">
              <Play className="h-4 w-4" /> Continuar a daily
            </Button>
            <Button
              onClick={() => { setConfirmClose(false); pauseAndExit(); }}
              variant="outline"
              className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              <Pause className="h-4 w-4" /> Pausar e continuar depois
            </Button>
            <Button
              onClick={() => { setConfirmClose(false); finalizeClose(); }}
              className="gap-1.5 bg-gradient-to-r from-red-500 to-orange-600"
            >
              <X className="h-4 w-4" /> Encerrar daily agora
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function TimerStat({
  label, value, icon: Icon, warn,
}: { label: string; value: string; icon: any; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 backdrop-blur-sm ${warn ? "border-red-500/40 bg-red-500/10" : "border-border/40 bg-card/40"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`text-lg font-mono font-bold tabular-nums ${warn ? "text-red-300" : ""}`}>{value}</div>
    </div>
  );
}

function InfoCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${highlight ? "border-primary/40 bg-primary/10" : "border-border/30 bg-background/40"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 break-words">{value}</div>
    </div>
  );
}

function HistoryStrip({ title, notes }: { title: string; notes: DailyNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1.5">{title}</div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {notes.map((n) => (
          <div
            key={n.id}
            className="min-w-[220px] max-w-[260px] rounded-lg border border-border/40 bg-card/40 p-3"
          >
            <div className="text-[10px] uppercase tracking-wide text-primary font-semibold">
              {new Date(n.note_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </div>
            <p className="text-xs mt-1 line-clamp-4 whitespace-pre-wrap">{n.content || "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
