import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, getISOWeek, getISOWeekYear, addDays } from "date-fns";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Search, CalendarIcon, Trash2, Pencil, LogOut, Settings2,
  ChevronDown, ChevronRight, ListChecks, AlertCircle, Flag, RefreshCw,
  FileText, Paperclip, MessageSquare, Send, Download, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Constants ----------
const LISTS = [
  { key: "jornada_inicial", label: "Jornada Inicial", cadence: "Única", recurrence: null as null | "weekly" | "monthly", function: null as string | null, color: "from-sky-500/20 to-sky-500/5 border-sky-500/30" },
  { key: "gt_semanal", label: "Gestor de Tráfego — Semanal", cadence: "Semanal", recurrence: "weekly", function: "gestor_trafego", color: "from-orange-500/20 to-orange-500/5 border-orange-500/30" },
  { key: "gt_mensal", label: "Gestor de Tráfego — Mensal", cadence: "Mensal", recurrence: "monthly", function: "gestor_trafego", color: "from-orange-500/20 to-orange-500/5 border-orange-500/30" },
  { key: "head_semanal", label: "Head — Semanal", cadence: "Semanal", recurrence: "weekly", function: "head", color: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30" },
  { key: "head_mensal", label: "Head — Mensal", cadence: "Mensal", recurrence: "monthly", function: "head", color: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30" },
  { key: "ep_semanal", label: "Ex. de Projetos — Semanal", cadence: "Semanal", recurrence: "weekly", function: "especialista_projetos", color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
  { key: "ep_mensal", label: "Ex. de Projetos — Mensal", cadence: "Mensal", recurrence: "monthly", function: "especialista_projetos", color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
  { key: "melhoria_continua", label: "Melhoria Contínua", cadence: "Avulso", recurrence: null, function: null, color: "from-amber-500/20 to-amber-500/5 border-amber-500/30" },
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
  cycle_key: string | null;
}
interface ClientRow { id: string; name: string; squad_id: string; }
interface Assignment { squad_client_id: string; function: string; user_id: string; }
interface ProfileLite { user_id: string; full_name: string | null; email: string | null; squad_function: string | null; }
interface Template { id: string; squad_id: string; list_key: string; title: string; description: string | null; priority: string; due_days_offset: number | null; }
interface Subtask { id: string; task_id: string; title: string; done: boolean; position: number; }
interface Comment { id: string; task_id: string; user_id: string; body: string; created_at: string; }
interface Attachment { id: string; task_id: string; user_id: string; file_path: string; file_name: string; mime_type: string | null; size_bytes: number | null; created_at: string; }

const initials = (name: string | null | undefined, email: string | null | undefined) => {
  const n = (name || email?.split("@")[0] || "?").trim();
  return n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
};

const currentCycleKey = (rec: "weekly" | "monthly" | null): string | null => {
  if (!rec) return null;
  const d = new Date();
  if (rec === "weekly") return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
  return format(d, "yyyy-MM");
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

  const clientMap = useMemo(() => {
    const m = new Map<string, ClientRow>();
    (clients || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

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

  const { data: squadMembers } = useQuery({
    queryKey: ["all_squad_members", memberships],
    enabled: !!memberships?.length,
    queryFn: async () => {
      const { data } = await supabase.from("squad_members").select("squad_id, user_id");
      return data || [];
    },
  });

  // Main view tab
  const [view, setView] = useState<"client" | "mine" | "cadence">("client");

  // Selected client
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!selectedClientId && clients?.length) setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

  const selectedClient = selectedClientId ? clientMap.get(selectedClientId) : null;

  // Tasks for selected client
  const { data: clientTasks } = useQuery<Task[]>({
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

  // All tasks across my squads (for mine / cadence views and counts)
  const { data: allTasks } = useQuery<Task[]>({
    queryKey: ["all_tasks", clients?.map((c) => c.id).join(",")],
    enabled: !!clients?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from("squad_tasks")
        .select("*")
        .in("squad_client_id", clients!.map((c) => c.id))
        .order("created_at", { ascending: false });
      return (data || []) as Task[];
    },
  });

  const openCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (allTasks || []).forEach((t) => { if (t.status !== "done") map[t.squad_client_id] = (map[t.squad_client_id] || 0) + 1; });
    return map;
  }, [allTasks]);

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

  // Templates for the selected client's squad
  const { data: templates } = useQuery<Template[]>({
    queryKey: ["templates", selectedClient?.squad_id],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data } = await supabase
        .from("squad_task_templates")
        .select("*")
        .eq("squad_id", selectedClient!.squad_id)
        .order("created_at");
      return (data || []) as Template[];
    },
  });

  const resolveAssignee = (fn: string | null): string | null => {
    if (!fn || !selectedClient) return null;
    const override = assignments?.find((a) => a.function === fn);
    if (override) return override.user_id;
    const squadUserIds = (squadMembers || []).filter((m) => m.squad_id === selectedClient.squad_id).map((m) => m.user_id);
    const match = squadUserIds.find((uid) => profileMap.get(uid)?.squad_function === fn);
    return match || null;
  };

  // Filters
  const [onlyMine, setOnlyMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ---- Task dialog ----
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; listKey: string; editing: Task | null; }>({ open: false, listKey: "melhoria_continua", editing: null });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", assignee_id: "", priority: "normal", status: "todo", due_date: null as Date | null });

  const openNewTask = (listKey: string) => {
    const cfg = LISTS.find((l) => l.key === listKey)!;
    const defaultAssignee = resolveAssignee(cfg.function) || user?.id || "";
    setTaskForm({ title: "", description: "", assignee_id: defaultAssignee, priority: "normal", status: "todo", due_date: null });
    setTaskDialog({ open: true, listKey, editing: null });
  };

  const openEditTask = (t: Task) => {
    setTaskForm({
      title: t.title, description: t.description || "", assignee_id: t.assignee_id || "",
      priority: t.priority, status: t.status,
      due_date: t.due_date ? new Date(t.due_date + "T00:00:00") : null,
    });
    setTaskDialog({ open: true, listKey: t.list_key, editing: t });
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) { toast.error("Título obrigatório"); return; }
    if (!selectedClientId && !taskDialog.editing) return;

    const payload: any = {
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
      payload.squad_client_id = selectedClientId;
      payload.created_by = user!.id;
      const { error } = await supabase.from("squad_tasks").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Tarefa criada");
    }
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["all_tasks"] });
    setTaskDialog({ open: false, listKey: "melhoria_continua", editing: null });
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    const { error } = await supabase.from("squad_tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída");
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["all_tasks"] });
  };

  const toggleStatus = async (t: Task) => {
    const next = t.status === "done" ? "todo" : "done";
    const { error } = await supabase
      .from("squad_tasks")
      .update({ status: next, completed_at: next === "done" ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["all_tasks"] });
  };

  // ---- Assignments override ----
  const [assignOpen, setAssignOpen] = useState(false);
  const saveAssignment = async (fn: string, userId: string) => {
    if (!selectedClientId) return;
    if (!userId) {
      await supabase.from("squad_client_assignments").delete().eq("squad_client_id", selectedClientId).eq("function", fn);
    } else {
      await supabase.from("squad_client_assignments").upsert({ squad_client_id: selectedClientId, function: fn, user_id: userId }, { onConflict: "squad_client_id,function" });
    }
    qc.invalidateQueries({ queryKey: ["assignments", selectedClientId] });
    toast.success("Responsável atualizado");
  };

  // ---- Templates ----
  const [templatesDialog, setTemplatesDialog] = useState<{ open: boolean; listKey: string | null }>({ open: false, listKey: null });
  const openTemplates = (listKey: string) => setTemplatesDialog({ open: true, listKey });

  // ---- Generate cycle ----
  const generateCycle = async (listKey: string, scope: "client" | "squad") => {
    const cfg = LISTS.find((l) => l.key === listKey)!;
    const cycleKey = currentCycleKey(cfg.recurrence);
    if (!cycleKey) { toast.error("Esta lista não tem recorrência"); return; }
    if (!selectedClient) return;

    const targetClients = scope === "client" ? [selectedClient] : (clients || []).filter((c) => c.squad_id === selectedClient.squad_id);
    const tpls = (templates || []).filter((t) => t.list_key === listKey);
    if (!tpls.length) { toast.error("Cadastre templates antes"); return; }

    // Existing cycle tasks
    const { data: existing } = await supabase
      .from("squad_tasks")
      .select("squad_client_id, title")
      .in("squad_client_id", targetClients.map((c) => c.id))
      .eq("list_key", listKey)
      .eq("cycle_key", cycleKey);
    const existSet = new Set((existing || []).map((e: any) => `${e.squad_client_id}::${e.title}`));

    const toInsert: any[] = [];
    for (const c of targetClients) {
      // resolve assignee per client (override > function)
      const { data: aRows } = await supabase.from("squad_client_assignments").select("function,user_id").eq("squad_client_id", c.id);
      const override = (aRows || []).find((a: any) => a.function === cfg.function)?.user_id;
      let assigneeId: string | null = override || null;
      if (!assigneeId && cfg.function) {
        const sUsers = (squadMembers || []).filter((m) => m.squad_id === c.squad_id).map((m) => m.user_id);
        assigneeId = sUsers.find((uid) => profileMap.get(uid)?.squad_function === cfg.function) || null;
      }

      for (const tpl of tpls) {
        if (existSet.has(`${c.id}::${tpl.title}`)) continue;
        const due = tpl.due_days_offset != null ? format(addDays(new Date(), tpl.due_days_offset), "yyyy-MM-dd") : null;
        toInsert.push({
          squad_client_id: c.id,
          list_key: listKey,
          title: tpl.title,
          description: tpl.description,
          assignee_id: assigneeId,
          priority: tpl.priority,
          status: "todo",
          due_date: due,
          created_by: user!.id,
          cycle_key: cycleKey,
        });
      }
    }

    if (!toInsert.length) { toast.info("Nenhuma nova tarefa — ciclo já gerado"); return; }
    const { error } = await supabase.from("squad_tasks").insert(toInsert);
    if (error) { toast.error(error.message); return; }
    toast.success(`${toInsert.length} tarefas geradas (${cycleKey})`);
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["all_tasks"] });
  };

  // Squad-scoped member list for assignee pickers
  const selectableMembers = useMemo(() => {
    if (!selectedClient) return [];
    const memberIds = new Set((squadMembers || []).filter((m) => m.squad_id === selectedClient.squad_id).map((m) => m.user_id));
    return (profiles || []).filter((p) => memberIds.has(p.user_id));
  }, [selectedClient, squadMembers, profiles]);

  // Filter helper
  const applyFilters = (list: Task[]) => {
    let r = list;
    if (onlyMine) r = r.filter((t) => t.assignee_id === user?.id);
    if (statusFilter !== "all") r = r.filter((t) => t.status === statusFilter);
    return r;
  };

  // Client view tasks
  const filteredClientTasks = useMemo(() => applyFilters(clientTasks || []), [clientTasks, onlyMine, statusFilter, user]);
  const tasksByList = useMemo(() => {
    const map: Record<string, Task[]> = {};
    LISTS.forEach((l) => (map[l.key] = []));
    filteredClientTasks.forEach((t) => { (map[t.list_key] ||= []).push(t); });
    return map;
  }, [filteredClientTasks]);

  // Mine view: across all squads, only my tasks
  const myTasks = useMemo(() => {
    let r = (allTasks || []).filter((t) => t.assignee_id === user?.id);
    if (statusFilter !== "all") r = r.filter((t) => t.status === statusFilter);
    return r;
  }, [allTasks, user, statusFilter]);

  // Cadence view: group by list_key
  const tasksByCadence = useMemo(() => {
    const list = applyFilters(allTasks || []);
    const map: Record<string, Task[]> = {};
    LISTS.forEach((l) => (map[l.key] = []));
    list.forEach((t) => { (map[t.list_key] ||= []).push(t); });
    return map;
  }, [allTasks, onlyMine, statusFilter, user]);

  const filteredClients = (clients || []).filter((c) =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 h-14 flex items-center justify-between border-b border-border/30 bg-card/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" /> Plataforma de Tarefas
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="client" className="text-xs">Por cliente</TabsTrigger>
              <TabsTrigger value="mine" className="text-xs">Minhas tarefas</TabsTrigger>
              <TabsTrigger value="cadence" className="text-xs">Por cadência</TabsTrigger>
            </TabsList>
          </Tabs>
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
        {view === "client" && (
          <aside className="w-72 shrink-0 border-r border-border/30 bg-card/20 backdrop-blur p-3 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7 h-8 text-sm" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredClients.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center mt-6">
                  {clients?.length === 0 ? "Nenhum cliente no seu squad" : "Nenhum cliente encontrado"}
                </p>
              ) : filteredClients.map((c) => {
                const count = openCounts[c.id] || 0;
                const active = c.id === selectedClientId;
                return (
                  <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                    className={cn("w-full text-left px-3 py-2 rounded-md flex items-center justify-between text-sm transition",
                      active ? "bg-primary/15 text-foreground border border-primary/40" : "hover:bg-secondary/40 text-muted-foreground")}>
                    <span className="truncate">{c.name}</span>
                    {count > 0 && (
                      <span className="ml-2 text-[10px] font-semibold rounded-full bg-primary/20 text-primary px-1.5 py-0.5 min-w-[1.4rem] text-center">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {view === "client" && (
            !selectedClient ? (
              <div className="text-center text-muted-foreground mt-20">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Selecione um cliente para ver as tarefas.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedClient.name}</h2>
                    <p className="text-xs text-muted-foreground">{filteredClientTasks.length} tarefas visíveis</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" /> Responsáveis
                  </Button>
                </div>

                <div className="space-y-3">
                  {LISTS.map((l) => {
                    const list = tasksByList[l.key] || [];
                    const total = (clientTasks || []).filter((t) => t.list_key === l.key).length;
                    const open = (clientTasks || []).filter((t) => t.list_key === l.key && t.status !== "done").length;
                    const respId = resolveAssignee(l.function);
                    const respProfile = respId ? profileMap.get(respId) : null;
                    const tplCount = (templates || []).filter((t) => t.list_key === l.key).length;
                    return (
                      <ListBlock
                        key={l.key} cfg={l} tasks={list} total={total} open={open} tplCount={tplCount}
                        respName={respProfile?.full_name || respProfile?.email?.split("@")[0] || (l.function ? "Não definido" : "Qualquer um")}
                        onAdd={() => openNewTask(l.key)} onEdit={openEditTask} onDelete={deleteTask} onToggle={toggleStatus}
                        onTemplates={() => openTemplates(l.key)} onGenerate={() => generateCycle(l.key, "client")}
                        onGenerateSquad={() => generateCycle(l.key, "squad")}
                        profileMap={profileMap} currentUserId={user?.id} isAdmin={isAdmin}
                      />
                    );
                  })}
                </div>
              </>
            )
          )}

          {view === "mine" && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold">Minhas tarefas</h2>
                <p className="text-xs text-muted-foreground">{myTasks.length} tarefas em todos os clientes</p>
              </div>
              <FlatTaskTable tasks={myTasks} clientMap={clientMap} profileMap={profileMap} onEdit={openEditTask} onToggle={toggleStatus} currentUserId={user?.id} isAdmin={isAdmin} onDelete={deleteTask} />
            </div>
          )}

          {view === "cadence" && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold">Por cadência</h2>
                <p className="text-xs text-muted-foreground">Todas as tarefas dos seus squads agrupadas por lista</p>
              </div>
              <div className="space-y-3">
                {LISTS.map((l) => {
                  const list = tasksByCadence[l.key] || [];
                  if (list.length === 0) return null;
                  return (
                    <Card key={l.key} className={cn("bg-gradient-to-r border", l.color)}>
                      <div className="p-3 border-b border-border/30 flex items-center gap-2">
                        <span className="font-semibold text-sm">{l.label}</span>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-background/40 border border-border/30 rounded px-1.5 py-0.5">{l.cadence}</span>
                        <span className="text-[10px] font-semibold rounded-full bg-background/40 border border-border/30 px-2 py-0.5">{list.length}</span>
                      </div>
                      <div className="p-3">
                        <FlatTaskTable tasks={list} clientMap={clientMap} profileMap={profileMap} onEdit={openEditTask} onToggle={toggleStatus} currentUserId={user?.id} isAdmin={isAdmin} onDelete={deleteTask} />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Task Dialog */}
      <TaskDialogContent
        open={taskDialog.open}
        onOpenChange={(o) => setTaskDialog((d) => ({ ...d, open: o }))}
        editing={taskDialog.editing}
        listKey={taskDialog.listKey}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        selectableMembers={selectableMembers}
        onSave={saveTask}
        currentUserId={user?.id}
        profileMap={profileMap}
      />

      {/* Assignments Dialog */}
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
                  <Select value={current?.user_id || "none"} onValueChange={(v) => saveAssignment(sf.key, v === "none" ? "" : v)}>
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

      {/* Templates dialog */}
      <TemplatesDialog
        open={templatesDialog.open}
        onOpenChange={(o) => setTemplatesDialog((d) => ({ ...d, open: o }))}
        listKey={templatesDialog.listKey}
        squadId={selectedClient?.squad_id || null}
        currentUserId={user?.id}
      />
    </div>
  );
}

// ---------- ListBlock ----------
function ListBlock({
  cfg, tasks, total, open, respName, tplCount, onAdd, onEdit, onDelete, onToggle, onTemplates, onGenerate, onGenerateSquad, profileMap, currentUserId, isAdmin,
}: {
  cfg: typeof LISTS[number]; tasks: Task[]; total: number; open: number; respName: string; tplCount: number;
  onAdd: () => void; onEdit: (t: Task) => void; onDelete: (id: string) => void; onToggle: (t: Task) => void;
  onTemplates: () => void; onGenerate: () => void; onGenerateSquad: () => void;
  profileMap: Map<string, ProfileLite>; currentUserId: string | undefined; isAdmin: boolean;
}) {
  const [openState, setOpenState] = useState(true);
  const recurrent = cfg.recurrence !== null;
  return (
    <Card className={cn("bg-gradient-to-r border", cfg.color)}>
      <Collapsible open={openState} onOpenChange={setOpenState}>
        <div className="w-full p-3 flex items-center gap-3">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left min-w-0">
            {openState ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{cfg.label}</span>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-background/40 border border-border/30 rounded px-1.5 py-0.5">{cfg.cadence}</span>
                <span className="text-[10px] font-semibold rounded-full bg-background/40 border border-border/30 px-2 py-0.5">{open}/{total}</span>
                {recurrent && tplCount > 0 && (
                  <span className="text-[10px] font-semibold rounded-full bg-primary/15 text-primary px-2 py-0.5">{tplCount} templates</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Responsável padrão: {respName}</p>
            </div>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onTemplates} title="Templates">
              <FileText className="h-3.5 w-3.5 mr-1" />Templates
            </Button>
            {recurrent && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="Gerar ciclo">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />Gerar ciclo
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="end">
                  <button onClick={onGenerate} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary/50">Só este cliente</button>
                  <button onClick={onGenerateSquad} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary/50">Todos os clientes do squad</button>
                </PopoverContent>
              </Popover>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5 mr-1" />Nova
            </Button>
          </div>
        </div>
        <CollapsibleContent className="px-3 pb-3">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border/30 rounded-md">Sem tarefas</p>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} profileMap={profileMap} currentUserId={currentUserId} isAdmin={isAdmin}
                  onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ---------- TaskRow (compact) ----------
function TaskRow({ task: t, profileMap, currentUserId, isAdmin, onEdit, onDelete, onToggle, clientName }: {
  task: Task; profileMap: Map<string, ProfileLite>; currentUserId: string | undefined; isAdmin: boolean;
  onEdit: (t: Task) => void; onDelete: (id: string) => void; onToggle: (t: Task) => void; clientName?: string;
}) {
  const canEdit = isAdmin || t.assignee_id === currentUserId || t.created_by === currentUserId;
  const assignee = t.assignee_id ? profileMap.get(t.assignee_id) : null;
  const prio = PRIORITIES.find((p) => p.key === t.priority)!;
  const overdue = t.due_date && t.status !== "done" && new Date(t.due_date) < new Date(new Date().toDateString());
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-background/40 border border-border/30 hover:border-border/60 transition">
      <Checkbox checked={t.status === "done"} onCheckedChange={() => canEdit && onToggle(t)} disabled={!canEdit} />
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm truncate", t.status === "done" && "line-through text-muted-foreground")}>
          {clientName && <span className="text-[10px] uppercase mr-2 text-muted-foreground">{clientName}</span>}
          {t.title}
        </div>
        {t.description && <div className="text-[11px] text-muted-foreground truncate">{t.description}</div>}
      </div>
      <span className={cn("text-[10px] font-semibold border rounded px-1.5 py-0.5 inline-flex items-center gap-1", prio.color)}>
        <Flag className="h-2.5 w-2.5" /> {prio.label}
      </span>
      {t.due_date && (
        <span className={cn("text-[10px] font-medium border rounded px-1.5 py-0.5 inline-flex items-center gap-1",
          overdue ? "text-red-300 border-red-500/40 bg-red-500/10" : "text-muted-foreground border-border/40")}>
          <CalendarIcon className="h-2.5 w-2.5" />
          {format(new Date(t.due_date + "T00:00:00"), "dd/MM")}
        </span>
      )}
      {assignee && (
        <span title={assignee.full_name || assignee.email || ""} className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
          {initials(assignee.full_name, assignee.email)}
        </span>
      )}
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(t)} title="Abrir">
        <Pencil className="h-3 w-3" />
      </Button>
      {canEdit && (
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(t.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ---------- Flat task table (mine / cadence views) ----------
function FlatTaskTable({ tasks, clientMap, profileMap, onEdit, onToggle, onDelete, currentUserId, isAdmin }: {
  tasks: Task[]; clientMap: Map<string, ClientRow>; profileMap: Map<string, ProfileLite>;
  onEdit: (t: Task) => void; onToggle: (t: Task) => void; onDelete: (id: string) => void;
  currentUserId: string | undefined; isAdmin: boolean;
}) {
  if (tasks.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa</p>;
  }
  return (
    <div className="space-y-1.5">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} profileMap={profileMap} currentUserId={currentUserId} isAdmin={isAdmin}
          onEdit={onEdit} onDelete={onDelete} onToggle={onToggle}
          clientName={clientMap.get(t.squad_client_id)?.name} />
      ))}
    </div>
  );
}

// ---------- Task dialog with subtasks / comments / attachments ----------
function TaskDialogContent({
  open, onOpenChange, editing, listKey, taskForm, setTaskForm, selectableMembers, onSave, currentUserId, profileMap,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  editing: Task | null; listKey: string;
  taskForm: any; setTaskForm: any;
  selectableMembers: ProfileLite[];
  onSave: () => void;
  currentUserId: string | undefined;
  profileMap: Map<string, ProfileLite>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar tarefa" : "Nova tarefa"} ·{" "}
            <span className="text-muted-foreground text-sm font-normal">
              {LISTS.find((l) => l.key === listKey)?.label}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input autoFocus value={taskForm.title} onChange={(e) => setTaskForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Ex: Otimizar campanhas META" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea value={taskForm.description} onChange={(e) => setTaskForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Detalhes da tarefa..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Responsável</Label>
              <Select value={taskForm.assignee_id || "none"} onValueChange={(v) => setTaskForm((f: any) => ({ ...f, assignee_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {selectableMembers.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email?.split("@")[0] || "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade</Label>
              <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f: any) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={taskForm.status} onValueChange={(v) => setTaskForm((f: any) => ({ ...f, status: v }))}>
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
                  <Calendar mode="single" selected={taskForm.due_date || undefined} onSelect={(d) => setTaskForm((f: any) => ({ ...f, due_date: d || null }))} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {editing && (
            <>
              <SubtasksSection taskId={editing.id} currentUserId={currentUserId} />
              <AttachmentsSection taskId={editing.id} currentUserId={currentUserId} />
              <CommentsSection taskId={editing.id} currentUserId={currentUserId} profileMap={profileMap} />
            </>
          )}
        </div>
        <DialogFooter className="gap-2 mt-4">
          {taskForm.due_date && (
            <Button variant="ghost" size="sm" onClick={() => setTaskForm((f: any) => ({ ...f, due_date: null }))}>Remover data</Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={onSave}>{editing ? "Salvar" : "Criar tarefa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Subtasks ----------
function SubtasksSection({ taskId, currentUserId }: { taskId: string; currentUserId: string | undefined }) {
  const qc = useQueryClient();
  const { data: subtasks } = useQuery<Subtask[]>({
    queryKey: ["subtasks", taskId],
    queryFn: async () => {
      const { data } = await supabase.from("squad_subtasks").select("*").eq("task_id", taskId).order("position").order("created_at");
      return (data || []) as Subtask[];
    },
  });
  const [newTitle, setNewTitle] = useState("");
  const add = async () => {
    if (!newTitle.trim() || !currentUserId) return;
    const { error } = await supabase.from("squad_subtasks").insert({
      task_id: taskId, title: newTitle.trim(), created_by: currentUserId, position: (subtasks?.length || 0),
    });
    if (error) { toast.error(error.message); return; }
    setNewTitle("");
    qc.invalidateQueries({ queryKey: ["subtasks", taskId] });
  };
  const toggle = async (s: Subtask) => {
    await supabase.from("squad_subtasks").update({ done: !s.done }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["subtasks", taskId] });
  };
  const remove = async (id: string) => {
    await supabase.from("squad_subtasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["subtasks", taskId] });
  };
  const done = subtasks?.filter((s) => s.done).length || 0;
  return (
    <div className="space-y-2 border-t border-border/30 pt-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Subtarefas {subtasks && subtasks.length > 0 && <span className="text-muted-foreground">({done}/{subtasks.length})</span>}</Label>
      </div>
      <div className="space-y-1">
        {subtasks?.map((s) => (
          <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-background/40 border border-border/30">
            <Checkbox checked={s.done} onCheckedChange={() => toggle(s)} />
            <span className={cn("text-sm flex-1", s.done && "line-through text-muted-foreground")}>{s.title}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => remove(s.id)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Adicionar subtarefa..." className="h-8 text-sm" />
        <Button size="sm" onClick={add} className="h-8">Adicionar</Button>
      </div>
    </div>
  );
}

// ---------- Attachments ----------
function AttachmentsSection({ taskId, currentUserId }: { taskId: string; currentUserId: string | undefined }) {
  const qc = useQueryClient();
  const { data: attachments } = useQuery<Attachment[]>({
    queryKey: ["attachments", taskId],
    queryFn: async () => {
      const { data } = await supabase.from("squad_task_attachments").select("*").eq("task_id", taskId).order("created_at");
      return (data || []) as Attachment[];
    },
  });
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!currentUserId) return;
    setUploading(true);
    const path = `${currentUserId}/${taskId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error } = await supabase.from("squad_task_attachments").insert({
      task_id: taskId, user_id: currentUserId, file_path: path, file_name: file.name,
      mime_type: file.type || null, size_bytes: file.size,
    });
    if (error) toast.error(error.message); else toast.success("Anexo enviado");
    qc.invalidateQueries({ queryKey: ["attachments", taskId] });
    setUploading(false);
  };

  const download = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(a.file_path, 60);
    if (error || !data) { toast.error("Falha ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (a: Attachment) => {
    await supabase.storage.from("task-attachments").remove([a.file_path]);
    await supabase.from("squad_task_attachments").delete().eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["attachments", taskId] });
  };

  return (
    <div className="space-y-2 border-t border-border/30 pt-3">
      <Label className="text-xs flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Anexos</Label>
      <div className="space-y-1">
        {attachments?.map((a) => (
          <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-background/40 border border-border/30">
            <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs flex-1 truncate">{a.file_name}</span>
            {a.size_bytes != null && <span className="text-[10px] text-muted-foreground">{(a.size_bytes / 1024).toFixed(0)} KB</span>}
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => download(a)} title="Baixar"><Download className="h-3 w-3" /></Button>
            {a.user_id === currentUserId && (
              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => remove(a)}><X className="h-3 w-3" /></Button>
            )}
          </div>
        ))}
      </div>
      <label className="flex items-center justify-center gap-2 text-xs text-muted-foreground border border-dashed border-border/40 rounded-md py-2 cursor-pointer hover:bg-secondary/30">
        <Paperclip className="h-3.5 w-3.5" /> {uploading ? "Enviando..." : "Clique para anexar arquivo"}
        <input type="file" className="hidden" disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </label>
    </div>
  );
}

// ---------- Comments ----------
function CommentsSection({ taskId, currentUserId, profileMap }: { taskId: string; currentUserId: string | undefined; profileMap: Map<string, ProfileLite> }) {
  const qc = useQueryClient();
  const { data: comments } = useQuery<Comment[]>({
    queryKey: ["comments", taskId],
    queryFn: async () => {
      const { data } = await supabase.from("squad_task_comments").select("*").eq("task_id", taskId).order("created_at");
      return (data || []) as Comment[];
    },
  });
  const [text, setText] = useState("");
  const send = async () => {
    if (!text.trim() || !currentUserId) return;
    const { error } = await supabase.from("squad_task_comments").insert({ task_id: taskId, user_id: currentUserId, body: text.trim() });
    if (error) { toast.error(error.message); return; }
    setText("");
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
  };
  const remove = async (id: string) => {
    await supabase.from("squad_task_comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
  };
  return (
    <div className="space-y-2 border-t border-border/30 pt-3">
      <Label className="text-xs flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Comentários</Label>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {comments?.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum comentário ainda</p>}
        {comments?.map((c) => {
          const p = profileMap.get(c.user_id);
          return (
            <div key={c.id} className="flex gap-2">
              <span className="shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                {initials(p?.full_name, p?.email)}
              </span>
              <div className="flex-1 bg-background/40 border border-border/30 rounded px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold">{p?.full_name || p?.email?.split("@")[0] || "Usuário"}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "dd/MM HH:mm")}</span>
                    {c.user_id === currentUserId && (
                      <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground" onClick={() => remove(c.id)}><X className="h-2.5 w-2.5" /></Button>
                    )}
                  </div>
                </div>
                <p className="text-xs mt-0.5 whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Escreva um comentário..." className="text-sm" />
        <Button size="icon" onClick={send} title="Enviar"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

// ---------- Templates dialog ----------
function TemplatesDialog({ open, onOpenChange, listKey, squadId, currentUserId }: {
  open: boolean; onOpenChange: (o: boolean) => void; listKey: string | null; squadId: string | null; currentUserId: string | undefined;
}) {
  const qc = useQueryClient();
  const { data: templates } = useQuery<Template[]>({
    queryKey: ["templates_dialog", squadId, listKey],
    enabled: open && !!squadId && !!listKey,
    queryFn: async () => {
      const { data } = await supabase.from("squad_task_templates").select("*").eq("squad_id", squadId!).eq("list_key", listKey!).order("created_at");
      return (data || []) as Template[];
    },
  });

  const [form, setForm] = useState({ title: "", description: "", priority: "normal", due_days_offset: "" });
  const reset = () => setForm({ title: "", description: "", priority: "normal", due_days_offset: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { if (open) { reset(); setEditingId(null); } }, [open, listKey]);

  const save = async () => {
    if (!form.title.trim() || !squadId || !listKey || !currentUserId) return;
    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_days_offset: form.due_days_offset.trim() === "" ? null : Number(form.due_days_offset),
    };
    if (editingId) {
      const { error } = await supabase.from("squad_task_templates").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
    } else {
      payload.squad_id = squadId; payload.list_key = listKey; payload.created_by = currentUserId;
      const { error } = await supabase.from("squad_task_templates").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    reset(); setEditingId(null);
    qc.invalidateQueries({ queryKey: ["templates_dialog"] });
    qc.invalidateQueries({ queryKey: ["templates"] });
    toast.success("Template salvo");
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setForm({ title: t.title, description: t.description || "", priority: t.priority, due_days_offset: t.due_days_offset?.toString() || "" });
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir template?")) return;
    await supabase.from("squad_task_templates").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["templates_dialog"] });
    qc.invalidateQueries({ queryKey: ["templates"] });
  };

  const listLabel = LISTS.find((l) => l.key === listKey)?.label;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Templates · <span className="text-muted-foreground text-sm font-normal">{listLabel}</span></DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Cadastre os modelos de tarefa que se repetem a cada ciclo. Use o botão "Gerar ciclo" da lista para criar essas tarefas para o cliente (ou para todos os clientes do squad).
        </p>
        <div className="space-y-2 mt-2">
          {templates?.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum template cadastrado</p>}
          {templates?.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-2 py-2 rounded bg-background/40 border border-border/30">
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{t.title}</div>
                {t.description && <div className="text-[11px] text-muted-foreground truncate">{t.description}</div>}
              </div>
              <span className={cn("text-[10px] font-semibold border rounded px-1.5 py-0.5", PRIORITIES.find((p) => p.key === t.priority)?.color)}>
                {PRIORITIES.find((p) => p.key === t.priority)?.label}
              </span>
              {t.due_days_offset != null && (
                <span className="text-[10px] text-muted-foreground border border-border/40 rounded px-1.5 py-0.5">+{t.due_days_offset}d</span>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(t)}><Pencil className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove(t.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>

        <div className="border-t border-border/30 pt-3 mt-3 space-y-3">
          <h4 className="text-sm font-semibold">{editingId ? "Editar template" : "Novo template"}</h4>
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Revisar campanhas da semana" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vencimento (dias após gerar)</Label>
              <Input type="number" value={form.due_days_offset} onChange={(e) => setForm((f) => ({ ...f, due_days_offset: e.target.value }))} placeholder="Ex: 7" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingId && <Button variant="ghost" onClick={() => { reset(); setEditingId(null); }}>Cancelar</Button>}
            <Button onClick={save}>{editingId ? "Salvar" : "Adicionar template"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
