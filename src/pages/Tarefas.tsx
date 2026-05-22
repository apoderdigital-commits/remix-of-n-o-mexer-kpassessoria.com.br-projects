import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft, Plus, Search, CalendarIcon, Trash2, Pencil, LogOut, Settings2,
  ChevronDown, ChevronRight, ListChecks, AlertCircle, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Constants ----------
const LISTS = [
  { key: "jornada_inicial", label: "Jornada Inicial", cadence: "Única", function: null, color: "from-sky-500/20 to-sky-500/5 border-sky-500/30" },
  { key: "gt_semanal", label: "Gestor de Tráfego — Semanal", cadence: "Semanal", function: "gestor_trafego", color: "from-orange-500/20 to-orange-500/5 border-orange-500/30" },
  { key: "gt_mensal", label: "Gestor de Tráfego — Mensal", cadence: "Mensal", function: "gestor_trafego", color: "from-orange-500/20 to-orange-500/5 border-orange-500/30" },
  { key: "head_semanal", label: "Head — Semanal", cadence: "Semanal", function: "head", color: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30" },
  { key: "head_mensal", label: "Head — Mensal", cadence: "Mensal", function: "head", color: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30" },
  { key: "ep_semanal", label: "Ex. de Projetos — Semanal", cadence: "Semanal", function: "especialista_projetos", color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
  { key: "ep_mensal", label: "Ex. de Projetos — Mensal", cadence: "Mensal", function: "especialista_projetos", color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
  { key: "melhoria_continua", label: "Melhoria Contínua", cadence: "Avulso", function: null, color: "from-amber-500/20 to-amber-500/5 border-amber-500/30" },
] as const;

const SQUAD_FUNCTIONS = [
  { key: "gestor_trafego", label: "Gestor de Tráfego" },
  { key: "head", label: "Head" },
  { key: "especialista_projetos", label: "Especialista de Projetos" },
];

const PRIORITIES = [
  { key: "urgent", label: "Urgente", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  { key: "high", label: "Alta", color: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  { key: "normal", label: "Normal", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  { key: "low", label: "Baixa", color: "text-muted-foreground bg-muted/30 border-border/40" },
];

const STATUSES = [
  { key: "todo", label: "A fazer" },
  { key: "doing", label: "Em andamento" },
  { key: "done", label: "Concluído" },
];

interface Task {
  id: string;
  squad_client_id: string;
  list_key: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  squad_id: string;
}

interface Assignment {
  squad_client_id: string;
  function: string;
  user_id: string;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  email: string | null;
  squad_function: string | null;
}

const initials = (name: string | null | undefined, email: string | null | undefined) => {
  const n = (name || email?.split("@")[0] || "?").trim();
  return n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
};

export default function Tarefas() {
  const { user, isAdmin, signOut } = useAuth();
  const qc = useQueryClient();

  // Memberships → squads → clients
  const { data: memberships } = useQuery({
    queryKey: ["my_squads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isAdmin) {
        const { data } = await supabase.from("squads").select("id");
        return (data || []).map((s) => s.id);
      }
      const { data } = await supabase.from("squad_members").select("squad_id").eq("user_id", user!.id);
      return (data || []).map((m) => m.squad_id);
    },
  });

  const { data: clients } = useQuery<ClientRow[]>({
    queryKey: ["tarefas_clients", memberships],
    enabled: !!memberships,
    queryFn: async () => {
      if (!memberships?.length) return [];
      const { data } = await supabase
        .from("squad_clients")
        .select("id, name, squad_id")
        .in("squad_id", memberships)
        .order("name");
      return (data || []) as ClientRow[];
    },
  });

  // Profiles (for assignee resolution + display)
  const { data: profiles } = useQuery<ProfileLite[]>({
    queryKey: ["tarefas_profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, squad_function")
        .is("deleted_at", null);
      return (data || []) as any;
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    (profiles || []).forEach((p) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  // Members of each squad
  const { data: squadMembers } = useQuery({
    queryKey: ["all_squad_members", memberships],
    enabled: !!memberships?.length,
    queryFn: async () => {
      const { data } = await supabase.from("squad_members").select("squad_id, user_id");
      return data || [];
    },
  });

  // Selected client
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!selectedClientId && clients?.length) setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

  const selectedClient = clients?.find((c) => c.id === selectedClientId) || null;

  // Tasks for selected client
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["tasks", selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("squad_tasks")
        .select("*")
        .eq("squad_client_id", selectedClientId!)
        .order("created_at", { ascending: false });
      return (data || []) as Task[];
    },
  });

  // All-clients open-task counts (for sidebar badges)
  const { data: openCounts } = useQuery({
    queryKey: ["open_counts", clients?.map((c) => c.id).join(",")],
    enabled: !!clients?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from("squad_tasks")
        .select("squad_client_id, status")
        .in("squad_client_id", clients!.map((c) => c.id))
        .neq("status", "done");
      const map: Record<string, number> = {};
      (data || []).forEach((t: any) => { map[t.squad_client_id] = (map[t.squad_client_id] || 0) + 1; });
      return map;
    },
  });

  // Assignments for selected client
  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["assignments", selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("squad_client_assignments")
        .select("squad_client_id, function, user_id")
        .eq("squad_client_id", selectedClientId!);
      return (data || []) as Assignment[];
    },
  });

  // Resolve responsible per function for the selected client
  const resolveAssignee = (fn: string | null): string | null => {
    if (!fn || !selectedClient) return null;
    const override = assignments?.find((a) => a.function === fn);
    if (override) return override.user_id;
    // Fallback: any member of this squad whose profile has matching squad_function
    const squadUserIds = (squadMembers || []).filter((m) => m.squad_id === selectedClient.squad_id).map((m) => m.user_id);
    const match = squadUserIds.find((uid) => profileMap.get(uid)?.squad_function === fn);
    return match || null;
  };

  // Filter "mine"
  const [onlyMine, setOnlyMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Task dialog
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    listKey: string;
    editing: Task | null;
  }>({ open: false, listKey: "melhoria_continua", editing: null });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assignee_id: "",
    priority: "normal",
    status: "todo",
    due_date: null as Date | null,
  });

  const openNewTask = (listKey: string) => {
    const cfg = LISTS.find((l) => l.key === listKey)!;
    const defaultAssignee = resolveAssignee(cfg.function) || user?.id || "";
    setTaskForm({
      title: "",
      description: "",
      assignee_id: defaultAssignee,
      priority: "normal",
      status: "todo",
      due_date: null,
    });
    setTaskDialog({ open: true, listKey, editing: null });
  };

  const openEditTask = (t: Task) => {
    setTaskForm({
      title: t.title,
      description: t.description || "",
      assignee_id: t.assignee_id || "",
      priority: t.priority,
      status: t.status,
      due_date: t.due_date ? new Date(t.due_date + "T00:00:00") : null,
    });
    setTaskDialog({ open: true, listKey: t.list_key, editing: t });
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) { toast.error("Título obrigatório"); return; }
    if (!selectedClientId) return;

    const payload: any = {
      squad_client_id: selectedClientId,
      list_key: taskDialog.listKey,
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      assignee_id: taskForm.assignee_id || null,
      priority: taskForm.priority,
      status: taskForm.status,
      due_date: taskForm.due_date ? format(taskForm.due_date, "yyyy-MM-dd") : null,
      completed_at: taskForm.status === "done" ? new Date().toISOString() : null,
    };

    if (taskDialog.editing) {
      const { error } = await supabase.from("squad_tasks").update(payload).eq("id", taskDialog.editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Tarefa atualizada");
    } else {
      payload.created_by = user!.id;
      const { error } = await supabase.from("squad_tasks").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Tarefa criada");
    }
    qc.invalidateQueries({ queryKey: ["tasks", selectedClientId] });
    qc.invalidateQueries({ queryKey: ["open_counts"] });
    setTaskDialog({ open: false, listKey: "melhoria_continua", editing: null });
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    const { error } = await supabase.from("squad_tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída");
    qc.invalidateQueries({ queryKey: ["tasks", selectedClientId] });
    qc.invalidateQueries({ queryKey: ["open_counts"] });
  };

  const toggleStatus = async (t: Task) => {
    const next = t.status === "done" ? "todo" : "done";
    const { error } = await supabase
      .from("squad_tasks")
      .update({ status: next, completed_at: next === "done" ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tasks", selectedClientId] });
    qc.invalidateQueries({ queryKey: ["open_counts"] });
  };

  // ---------- Admin: assignment override ----------
  const [assignOpen, setAssignOpen] = useState(false);
  const saveAssignment = async (fn: string, userId: string) => {
    if (!selectedClientId) return;
    if (!userId) {
      await supabase.from("squad_client_assignments").delete()
        .eq("squad_client_id", selectedClientId).eq("function", fn);
    } else {
      await supabase.from("squad_client_assignments").upsert({
        squad_client_id: selectedClientId, function: fn, user_id: userId,
      }, { onConflict: "squad_client_id,function" });
    }
    qc.invalidateQueries({ queryKey: ["assignments", selectedClientId] });
    toast.success("Responsável atualizado");
  };

  // Squad-scoped member list for assignee pickers
  const selectableMembers = useMemo(() => {
    if (!selectedClient) return [];
    const memberIds = new Set((squadMembers || []).filter((m) => m.squad_id === selectedClient.squad_id).map((m) => m.user_id));
    return (profiles || []).filter((p) => memberIds.has(p.user_id));
  }, [selectedClient, squadMembers, profiles]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let list = tasks || [];
    if (onlyMine) list = list.filter((t) => t.assignee_id === user?.id);
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    return list;
  }, [tasks, onlyMine, statusFilter, user]);

  const tasksByList = useMemo(() => {
    const map: Record<string, Task[]> = {};
    LISTS.forEach((l) => (map[l.key] = []));
    filteredTasks.forEach((t) => { (map[t.list_key] ||= []).push(t); });
    return map;
  }, [filteredTasks]);

  const filteredClients = (clients || []).filter((c) =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 h-14 flex items-center justify-between border-b border-border/30 bg-card/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" /> Plataforma de Tarefas
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={onlyMine} onCheckedChange={(v) => setOnlyMine(!!v)} /> Apenas minhas
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-r border-border/30 bg-card/20 backdrop-blur p-3 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-7 h-8 text-sm"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredClients.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-6">
                {clients?.length === 0 ? "Nenhum cliente no seu squad" : "Nenhum cliente encontrado"}
              </p>
            ) : filteredClients.map((c) => {
              const count = openCounts?.[c.id] || 0;
              const active = c.id === selectedClientId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClientId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md flex items-center justify-between text-sm transition",
                    active ? "bg-primary/15 text-foreground border border-primary/40" : "hover:bg-secondary/40 text-muted-foreground"
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  {count > 0 && (
                    <span className="ml-2 text-[10px] font-semibold rounded-full bg-primary/20 text-primary px-1.5 py-0.5 min-w-[1.4rem] text-center">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {!selectedClient ? (
            <div className="text-center text-muted-foreground mt-20">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Selecione um cliente para ver as tarefas.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedClient.name}</h2>
                  <p className="text-xs text-muted-foreground">{filteredTasks.length} tarefas visíveis</p>
                </div>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" /> Responsáveis
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {LISTS.map((l) => {
                  const list = tasksByList[l.key] || [];
                  const total = (tasks || []).filter((t) => t.list_key === l.key).length;
                  const open = (tasks || []).filter((t) => t.list_key === l.key && t.status !== "done").length;
                  const respId = resolveAssignee(l.function);
                  const respProfile = respId ? profileMap.get(respId) : null;
                  return (
                    <ListBlock
                      key={l.key}
                      cfg={l}
                      tasks={list}
                      total={total}
                      open={open}
                      respName={respProfile?.full_name || respProfile?.email?.split("@")[0] || (l.function ? "Não definido" : "Qualquer um")}
                      onAdd={() => openNewTask(l.key)}
                      onEdit={openEditTask}
                      onDelete={deleteTask}
                      onToggle={toggleStatus}
                      profileMap={profileMap}
                      currentUserId={user?.id}
                      isAdmin={isAdmin}
                    />
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Task Dialog */}
      <Dialog open={taskDialog.open} onOpenChange={(o) => setTaskDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {taskDialog.editing ? "Editar tarefa" : "Nova tarefa"} ·{" "}
              <span className="text-muted-foreground text-sm font-normal">
                {LISTS.find((l) => l.key === taskDialog.listKey)?.label}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                autoFocus
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Otimizar campanhas META"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Detalhes da tarefa..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select
                  value={taskForm.assignee_id || "none"}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, assignee_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {selectableMembers.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name || p.email?.split("@")[0] || "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={taskForm.status} onValueChange={(v) => setTaskForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start font-normal", !taskForm.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskForm.due_date ? format(taskForm.due_date, "dd/MM/yyyy") : "Sem data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={taskForm.due_date || undefined}
                      onSelect={(d) => setTaskForm((f) => ({ ...f, due_date: d || null }))}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {taskForm.due_date && (
              <Button variant="ghost" size="sm" onClick={() => setTaskForm((f) => ({ ...f, due_date: null }))}>
                Remover data
              </Button>
            )}
            <Button variant="ghost" onClick={() => setTaskDialog((d) => ({ ...d, open: false }))}>Cancelar</Button>
            <Button onClick={saveTask}>{taskDialog.editing ? "Salvar" : "Criar tarefa"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignments Dialog (admin) */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="bg-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle>Responsáveis · {selectedClient?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              Sobrescreve o responsável padrão (definido por função na tela de Usuários) só para este cliente.
            </p>
            {SQUAD_FUNCTIONS.map((sf) => {
              const current = assignments?.find((a) => a.function === sf.key);
              return (
                <div key={sf.key} className="space-y-1.5">
                  <Label className="text-xs">{sf.label}</Label>
                  <Select
                    value={current?.user_id || "none"}
                    onValueChange={(v) => saveAssignment(sf.key, v === "none" ? "" : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Usar padrão" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Usar padrão da função</SelectItem>
                      {selectableMembers.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.full_name || p.email?.split("@")[0] || "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- ListBlock ----------
function ListBlock({
  cfg, tasks, total, open, respName, onAdd, onEdit, onDelete, onToggle, profileMap, currentUserId, isAdmin,
}: {
  cfg: typeof LISTS[number];
  tasks: Task[];
  total: number;
  open: number;
  respName: string;
  onAdd: () => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onToggle: (t: Task) => void;
  profileMap: Map<string, ProfileLite>;
  currentUserId: string | undefined;
  isAdmin: boolean;
}) {
  const [openState, setOpenState] = useState(true);
  return (
    <Card className={cn("bg-gradient-to-r border", cfg.color)}>
      <Collapsible open={openState} onOpenChange={setOpenState}>
        <CollapsibleTrigger className="w-full p-3 flex items-center gap-3">
          {openState ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{cfg.label}</span>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-background/40 border border-border/30 rounded px-1.5 py-0.5">
                {cfg.cadence}
              </span>
              <span className="text-[10px] font-semibold rounded-full bg-background/40 border border-border/30 px-2 py-0.5">
                {open}/{total}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Responsável padrão: {respName}</p>
          </div>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
          >
            <span><Plus className="h-3.5 w-3.5 mr-1" />Nova</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border/30 rounded-md">
              Sem tarefas
            </p>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((t) => {
                const canEdit = isAdmin || t.assignee_id === currentUserId || t.created_by === currentUserId;
                const assignee = t.assignee_id ? profileMap.get(t.assignee_id) : null;
                const prio = PRIORITIES.find((p) => p.key === t.priority)!;
                const overdue = t.due_date && t.status !== "done" && new Date(t.due_date) < new Date(new Date().toDateString());
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 px-2 py-2 rounded-md bg-background/40 border border-border/30 hover:border-border/60 transition"
                  >
                    <Checkbox
                      checked={t.status === "done"}
                      onCheckedChange={() => canEdit && onToggle(t)}
                      disabled={!canEdit}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm truncate", t.status === "done" && "line-through text-muted-foreground")}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="text-[11px] text-muted-foreground truncate">{t.description}</div>
                      )}
                    </div>
                    <span className={cn("text-[10px] font-semibold border rounded px-1.5 py-0.5 inline-flex items-center gap-1", prio.color)}>
                      <Flag className="h-2.5 w-2.5" /> {prio.label}
                    </span>
                    {t.due_date && (
                      <span className={cn(
                        "text-[10px] font-medium border rounded px-1.5 py-0.5 inline-flex items-center gap-1",
                        overdue ? "text-red-300 border-red-500/40 bg-red-500/10" : "text-muted-foreground border-border/40"
                      )}>
                        <CalendarIcon className="h-2.5 w-2.5" />
                        {format(new Date(t.due_date + "T00:00:00"), "dd/MM")}
                      </span>
                    )}
                    {assignee && (
                      <span
                        title={assignee.full_name || assignee.email || ""}
                        className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center"
                      >
                        {initials(assignee.full_name, assignee.email)}
                      </span>
                    )}
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(t)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(t.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
