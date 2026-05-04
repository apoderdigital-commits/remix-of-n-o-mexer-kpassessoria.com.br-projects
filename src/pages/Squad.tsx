import { useEffect, useState } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ArrowLeft, Settings, Users } from "lucide-react";
import { toast } from "sonner";

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
  bm_verified: boolean | null;
  invested_tp: string | null;
  observations: string | null;
};

const empty: Partial<SquadClient> = {
  name: "", niche: "", services: "", curve_abc: "", sprint: "",
  prioritization: "", invested_tp: "", observations: "",
  renewal_60d: false, bm_verified: false,
};

const PRIO_ORDER = ["AA","AB","AC","BA","BB","BC","CA","CB","CC"];
const PRIO_LABELS: Record<string,string> = {
  AA: "Prioridade absoluta",
  AB: "Prioridade, mas pode esperar",
  AC: "Prioridade, mas o resultado já tá validado",
  BA: "Prioridade mediana, mas está em validação",
  BB: "Prioridade mediana, mas pode melhorar",
  BC: "Prioridade mediana, mas a gente sabe do resultado",
  CA: "Prioridade mínima, está em validação",
  CB: "Prioridade mínima, mas pode melhorar",
  CC: "Prioridade mínima, só que foda-se",
};
const PRIO_COLORS: Record<string,string> = {
  AA: "bg-red-500/20 text-red-300 border-red-500/40",
  AB: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  AC: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  BA: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  BB: "bg-lime-500/20 text-lime-300 border-lime-500/40",
  BC: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  CA: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  CB: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  CC: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

function computePrio(curve?: string | null, sprint?: string | null): string | null {
  if (!curve || !sprint) return null;
  const p = `${curve}${sprint}`.toUpperCase();
  return PRIO_ORDER.includes(p) ? p : null;
}

function sortByPrio<T extends { prioritization: string | null; name: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ai = a.prioritization ? PRIO_ORDER.indexOf(a.prioritization) : 99;
    const bi = b.prioritization ? PRIO_ORDER.indexOf(b.prioritization) : 99;
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.name.localeCompare(b.name);
  });
}

export default function Squad() {
  const { isAdmin } = useAuth();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadId, setSquadId] = useState<string>("");
  const [clients, setClients] = useState<SquadClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<SquadClient> | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void loadSquads();
  }, []);

  useEffect(() => {
    if (squadId) void loadClients(squadId);
  }, [squadId]);

  async function loadSquads() {
    setLoading(true);
    const { data } = await supabase.from("squads").select("*").order("name");
    setSquads(data || []);
    if (data && data.length && !squadId) setSquadId(data[0].id);
    setLoading(false);
  }

  async function loadClients(sid: string) {
    const { data } = await supabase
      .from("squad_clients")
      .select("*")
      .eq("squad_id", sid);
    setClients(sortByPrio(data || []));
  }

  function openNew() {
    setEditing({ ...empty, squad_id: squadId });
    setOpen(true);
  }
  function openEdit(c: SquadClient) {
    setEditing({ ...c });
    setOpen(true);
  }

  async function save() {
    if (!editing?.name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const payload = {
      squad_id: squadId,
      name: editing.name?.trim(),
      niche: editing.niche || null,
      services: editing.services || null,
      entry_date: editing.entry_date || null,
      due_date: editing.due_date || null,
      renewal_60d: !!editing.renewal_60d,
      curve_abc: editing.curve_abc || null,
      sprint: editing.sprint || null,
      prioritization: computePrio(editing.curve_abc, editing.sprint),
      bm_verified: !!editing.bm_verified,
      invested_tp: editing.invested_tp || null,
      observations: editing.observations || null,
    };
    const res = editing.id
      ? await supabase.from("squad_clients").update(payload).eq("id", editing.id)
      : await supabase.from("squad_clients").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Salvo");
    setOpen(false);
    void loadClients(squadId);
  }

  async function remove(id: string) {
    if (!confirm("Remover este cliente do squad?")) return;
    const { error } = await supabase.from("squad_clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    void loadClients(squadId);
  }

  const currentSquad = squads.find((s) => s.id === squadId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/30 px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button size="icon" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Dash do Squad
            </h1>
            {currentSquad && (
              <p className="text-xs text-muted-foreground">{currentSquad.description || currentSquad.name}</p>
            )}
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
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Select value={squadId} onValueChange={setSquadId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Selecione um squad" /></SelectTrigger>
            <SelectContent>
              {squads.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button onClick={openNew} disabled={!squadId} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : squads.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/40 rounded-xl">
            <p className="text-muted-foreground">Nenhum squad disponível.</p>
            {isAdmin && (
              <Link to="/squad/admin"><Button className="mt-4">Criar squad</Button></Link>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Nicho</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead>ABC</TableHead>
                  <TableHead>Sprint</TableHead>
                  <TableHead>Prioriz.</TableHead>
                  <TableHead>BM</TableHead>
                  <TableHead>Investido TP</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum cliente neste squad.</TableCell></TableRow>
                ) : clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.niche}</TableCell>
                    <TableCell className="text-muted-foreground">{c.services}</TableCell>
                    <TableCell><Badge variant="outline">{c.curve_abc || "-"}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{c.sprint || "-"}</Badge></TableCell>
                    <TableCell>
                      {c.prioritization ? (
                        <Badge title={PRIO_LABELS[c.prioritization]} className={PRIO_COLORS[c.prioritization] + " border"}>
                          {c.prioritization}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell>
                      {c.bm_verified
                        ? <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Sim</Badge>
                        : <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Não</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.invested_tp}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Cliente *</Label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div><Label>Nicho</Label><Input value={editing.niche || ""} onChange={(e) => setEditing({ ...editing, niche: e.target.value })} /></div>
              <div><Label>Serviços</Label><Input placeholder="TP, CRM, COM" value={editing.services || ""} onChange={(e) => setEditing({ ...editing, services: e.target.value })} /></div>
              <div><Label>Data entrada</Label><Input type="date" value={editing.entry_date || ""} onChange={(e) => setEditing({ ...editing, entry_date: e.target.value })} /></div>
              <div><Label>Data vencimento</Label><Input type="date" value={editing.due_date || ""} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} /></div>
              <div><Label>Curva ABC</Label><Input value={editing.curve_abc || ""} onChange={(e) => setEditing({ ...editing, curve_abc: e.target.value })} /></div>
              <div><Label>Sprint</Label><Input value={editing.sprint || ""} onChange={(e) => setEditing({ ...editing, sprint: e.target.value })} /></div>
              <div><Label>Priorização</Label><Input value={editing.prioritization || ""} onChange={(e) => setEditing({ ...editing, prioritization: e.target.value })} /></div>
              <div><Label>Valor investido TP</Label><Input value={editing.invested_tp || ""} onChange={(e) => setEditing({ ...editing, invested_tp: e.target.value })} /></div>
              <div className="flex items-center gap-2 mt-6">
                <input id="bm" type="checkbox" checked={!!editing.bm_verified} onChange={(e) => setEditing({ ...editing, bm_verified: e.target.checked })} />
                <Label htmlFor="bm">BM Verificada</Label>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input id="ren" type="checkbox" checked={!!editing.renewal_60d} onChange={(e) => setEditing({ ...editing, renewal_60d: e.target.checked })} />
                <Label htmlFor="ren">Renovação 60d</Label>
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={editing.observations || ""} onChange={(e) => setEditing({ ...editing, observations: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
