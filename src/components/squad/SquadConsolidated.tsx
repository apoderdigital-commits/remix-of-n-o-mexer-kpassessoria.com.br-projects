import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, X, Save, CalendarDays, Megaphone,
  Users, Target, UserCheck, ClipboardList, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

type Client = {
  id: string;
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

type ConsolidatedNote = {
  id: string;
  client_id: string;
  week_start: string;
  week_summary: string;
  problem_area: string | null;
  problem_description: string | null;
  action_plan: string | null;
  assignee: string | null;
  deadline: string | null;
  status: string;
  observations: string | null;
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

// Início da semana (segunda-feira) em ISO
function currentWeekStartISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=dom..6=sab
  const diff = (day + 6) % 7; // dias desde segunda
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function nextTuesdayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (9 - day) % 7 || 7; // próxima terça
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const EMPTY: Omit<ConsolidatedNote, "id" | "client_id" | "week_start"> = {
  week_summary: "",
  problem_area: "",
  problem_description: "",
  action_plan: "",
  assignee: "",
  deadline: "",
  status: "pendente",
  observations: "",
};

export function SquadConsolidated({
  open, onClose, squadId, clients,
}: {
  open: boolean;
  onClose: () => void;
  squadId: string;
  clients: Client[];
}) {
  const ordered = useMemo(
    () => [...clients].sort((a, b) => a.priority_score - b.priority_score || a.name.localeCompare(b.name)),
    [clients],
  );

  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [history, setHistory] = useState<ConsolidatedNote[]>([]);
  const [saving, setSaving] = useState(false);
  const noteIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  const current = ordered[idx];
  const weekStart = currentWeekStartISO();

  useEffect(() => {
    if (!open) return;
    setIdx(0);
    void beginSession();
  }, [open]);

  async function beginSession() {
    const start = new Date();
    setStartedAt(start);
    const { data: u } = await supabase.auth.getUser();
    const { data } = await (supabase as any)
      .from("squad_consolidated_sessions")
      .insert({
        squad_id: squadId,
        week_start: weekStart,
        started_at: start.toISOString(),
        created_by: u?.user?.id,
      })
      .select().single();
    if (data) sessionIdRef.current = data.id;
  }

  // Carrega anotação da semana atual + histórico
  useEffect(() => {
    if (!open || !current) return;
    noteIdRef.current = null;
    setForm({ ...EMPTY, deadline: nextTuesdayISO() });
    setHistory([]);
    void (async () => {
      const { data } = await (supabase as any)
        .from("squad_consolidated_notes")
        .select("*")
        .eq("client_id", current.id)
        .order("week_start", { ascending: false })
        .limit(12);
      const list = (data || []) as ConsolidatedNote[];
      setHistory(list);
      const thisWeek = list.find((n) => n.week_start === weekStart);
      if (thisWeek) {
        noteIdRef.current = thisWeek.id;
        setForm({
          week_summary: thisWeek.week_summary || "",
          problem_area: thisWeek.problem_area || "",
          problem_description: thisWeek.problem_description || "",
          action_plan: thisWeek.action_plan || "",
          assignee: thisWeek.assignee || "",
          deadline: thisWeek.deadline || nextTuesdayISO(),
          status: thisWeek.status || "pendente",
          observations: thisWeek.observations || "",
        });
      }
    })();
  }, [open, current?.id]);

  function setField<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function saveNote(showToast = true) {
    if (!current) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload: any = {
      squad_id: squadId,
      client_id: current.id,
      week_start: weekStart,
      week_summary: form.week_summary,
      problem_area: form.problem_area || null,
      problem_description: form.problem_description || null,
      action_plan: form.action_plan || null,
      assignee: form.assignee || null,
      deadline: form.deadline || null,
      status: form.status || "pendente",
      observations: form.observations || null,
      created_by: userData?.user?.id,
    };
    if (noteIdRef.current) {
      const { error } = await (supabase as any)
        .from("squad_consolidated_notes")
        .update(payload)
        .eq("id", noteIdRef.current);
      if (error) toast.error("Erro ao salvar");
      else if (showToast) toast.success("Consolidado salvo");
    } else {
      const { data, error } = await (supabase as any)
        .from("squad_consolidated_notes")
        .insert(payload)
        .select().single();
      if (error) toast.error("Erro ao salvar");
      else {
        noteIdRef.current = data.id;
        if (showToast) toast.success("Consolidado salvo");
      }
    }
    setSaving(false);
  }

  async function go(delta: number) {
    await saveNote(false);
    const next = Math.min(Math.max(idx + delta, 0), ordered.length - 1);
    setIdx(next);
  }

  async function finalize() {
    await saveNote(false);
    if (sessionIdRef.current && startedAt) {
      const totalSec = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      await (supabase as any).from("squad_consolidated_sessions")
        .update({ ended_at: new Date().toISOString(), total_seconds: totalSec })
        .eq("id", sessionIdRef.current);
    }
    onClose();
  }

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-background border-border/40">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-primary/10 border-b border-border/30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">Consolidado Semanal</h2>
                <p className="text-xs text-muted-foreground">
                  Cliente {idx + 1} de {ordered.length} · semana de {new Date(weekStart + "T12:00:00").toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
              <X className="h-4 w-4" /> Encerrar
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Card cliente */}
          <Card className="bg-card/40 border-border/40">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                    {current.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{current.name}</h3>
                    <p className="text-xs text-muted-foreground">{current.niche || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {current.prioritization && (
                    <Badge variant="outline" className={PRIORITY_COLORS[current.prioritization] || "bg-muted/40"}>
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
            </CardContent>
          </Card>

          {/* Análise da semana */}
          <Section icon={CalendarDays} title="Análise da última semana" color="from-primary to-fuchsia-600">
            <Textarea
              value={form.week_summary}
              onChange={(e) => setField("week_summary", e.target.value)}
              placeholder="O que aconteceu com este cliente na última semana? Resultados, dificuldades, vitórias..."
              rows={4}
              className="bg-card/40 border-border/40"
            />
          </Section>

          {/* Onde está o problema */}
          <Section icon={AlertCircle} title="Onde está o problema?" color="from-amber-500 to-orange-600">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Área do problema</Label>
                <Select value={form.problem_area || ""} onValueChange={(v) => setField("problem_area", v)}>
                  <SelectTrigger className="bg-card/40 border-border/40">
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketing">📣 Marketing / Tráfego</SelectItem>
                    <SelectItem value="comercial">💼 Comercial / CRM</SelectItem>
                    <SelectItem value="ambos">⚠️ Ambos (Marketing + Comercial)</SelectItem>
                    <SelectItem value="operacional">🔧 Operacional / Cliente</SelectItem>
                    <SelectItem value="nenhum">✅ Sem problema relevante</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger className="bg-card/40 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">🟠 Pendente</SelectItem>
                    <SelectItem value="em_andamento">🔵 Em andamento</SelectItem>
                    <SelectItem value="resolvido">🟢 Resolvido</SelectItem>
                    <SelectItem value="bloqueado">🔴 Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              value={form.problem_description}
              onChange={(e) => setField("problem_description", e.target.value)}
              placeholder="Descreva o problema identificado em detalhes..."
              rows={3}
              className="bg-card/40 border-border/40 mt-3"
            />
          </Section>

          {/* Plano de ação */}
          <Section icon={Target} title="Plano de Ação" color="from-emerald-500 to-teal-600">
            <Textarea
              value={form.action_plan}
              onChange={(e) => setField("action_plan", e.target.value)}
              placeholder="O que vamos fazer até o próximo consolidado para resolver?"
              rows={4}
              className="bg-card/40 border-border/40"
            />
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" /> Responsável
                </Label>
                <Input
                  value={form.assignee}
                  onChange={(e) => setField("assignee", e.target.value)}
                  placeholder="Quem fica responsável?"
                  className="bg-card/40 border-border/40"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Prazo (próx. consolidado)</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setField("deadline", e.target.value)}
                  className="bg-card/40 border-border/40"
                />
              </div>
            </div>
          </Section>

          {/* Observações */}
          <Section icon={Megaphone} title="Observações adicionais" color="from-sky-500 to-blue-600">
            <Textarea
              value={form.observations}
              onChange={(e) => setField("observations", e.target.value)}
              placeholder="Qualquer outro detalhe importante..."
              rows={2}
              className="bg-card/40 border-border/40"
            />
          </Section>

          {/* Histórico */}
          {history.filter((h) => h.week_start !== weekStart).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Consolidados anteriores
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {history.filter((h) => h.week_start !== weekStart).map((n) => (
                  <div key={n.id} className="min-w-[260px] max-w-[300px] rounded-lg border border-border/40 bg-card/40 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                        {new Date(n.week_start + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                      <Badge variant="outline" className="text-[9px]">{n.status}</Badge>
                    </div>
                    {n.problem_area && (
                      <Badge variant="outline" className="text-[9px] bg-amber-500/10 border-amber-500/30 text-amber-300 mb-1">
                        {n.problem_area}
                      </Badge>
                    )}
                    {n.action_plan && (
                      <p className="text-xs mt-1 line-clamp-3 whitespace-pre-wrap text-foreground/80">
                        <strong className="text-foreground">Plano:</strong> {n.action_plan}
                      </p>
                    )}
                    {n.assignee && (
                      <p className="text-[10px] mt-1 text-muted-foreground">👤 {n.assignee}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/30 bg-card/30 flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => go(-1)} disabled={idx === 0} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => saveNote(true)} disabled={saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salvar
            </Button>
            <span className="text-xs text-muted-foreground">{idx + 1} / {ordered.length}</span>
          </div>
          {idx < ordered.length - 1 ? (
            <Button onClick={() => go(1)} className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finalize} className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600">
              Finalizar consolidado
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon, title, color, children,
}: { icon: any; title: string; color: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card/40 border-border/40">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`h-7 w-7 rounded-md bg-gradient-to-br ${color} flex items-center justify-center shadow`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
