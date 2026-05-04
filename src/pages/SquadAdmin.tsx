import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

type Squad = { id: string; name: string; color: string | null; description: string | null };
type Profile = { user_id: string; email: string | null; full_name: string | null };
type Member = { id: string; squad_id: string; user_id: string; profile?: Profile };

export default function SquadAdmin() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Squad> | null>(null);
  const [memberDialog, setMemberDialog] = useState<Squad | null>(null);
  const [addUserId, setAddUserId] = useState("");

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    const [s, p, m] = await Promise.all([
      supabase.from("squads").select("*").order("name"),
      supabase.from("profiles").select("user_id,email,full_name").order("full_name"),
      supabase.from("squad_members").select("*"),
    ]);
    setSquads(s.data || []);
    setProfiles(p.data || []);
    const profMap = new Map((p.data || []).map((x) => [x.user_id, x]));
    setMembers((m.data || []).map((mm) => ({ ...mm, profile: profMap.get(mm.user_id) })));
  }

  async function saveSquad() {
    if (!editing?.name?.trim()) return toast.error("Nome obrigatório");
    const payload = {
      name: editing.name!.trim(),
      color: editing.color || "#8B5CF6",
      description: editing.description || null,
    };
    const res = editing.id
      ? await supabase.from("squads").update(payload).eq("id", editing.id)
      : await supabase.from("squads").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo");
    setOpen(false);
    void loadAll();
  }

  async function deleteSquad(id: string) {
    if (!confirm("Excluir squad e todos seus dados?")) return;
    const { error } = await supabase.from("squads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    void loadAll();
  }

  async function addMember(sid: string) {
    if (!addUserId) return;
    const { error } = await supabase.from("squad_members").insert({
      squad_id: sid, user_id: addUserId,
    });
    if (error) return toast.error(error.message);
    setAddUserId("");
    toast.success("Membro adicionado");
    void loadAll();
  }

  async function removeMember(id: string) {
    const { error } = await supabase.from("squad_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void loadAll();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/30 px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/squad"><Button size="icon" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-lg font-bold">Gerenciar Squads</h1>
        </div>
        <Button onClick={() => { setEditing({ name: "", color: "#8B5CF6", description: "" }); setOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo squad
        </Button>
      </header>

      <main className="px-4 sm:px-8 py-6 max-w-5xl mx-auto grid gap-4">
        {squads.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Nenhum squad criado.</p>
        )}
        {squads.map((s) => {
          const sMembers = members.filter((m) => m.squad_id === s.id);
          return (
            <Card key={s.id} className="bg-card/40 backdrop-blur-sm border-border/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: s.color || "#8B5CF6" }} />
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(s); setOpen(true); }}>Editar</Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteSquad(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2">Membros ({sMembers.length})</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {sMembers.length === 0 && <span className="text-xs text-muted-foreground">Nenhum membro</span>}
                  {sMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-1.5 bg-muted/40 rounded-full pl-3 pr-1 py-1 text-xs">
                      <span>{m.profile?.full_name || m.profile?.email || m.user_id.slice(0, 8)}</span>
                      <button onClick={() => removeMember(m.id)} className="hover:bg-destructive/20 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select value={memberDialog?.id === s.id ? addUserId : ""} onValueChange={(v) => { setMemberDialog(s); setAddUserId(v); }}>
                    <SelectTrigger className="w-72"><SelectValue placeholder="Adicionar colaborador..." /></SelectTrigger>
                    <SelectContent>
                      {profiles
                        .filter((p) => !sMembers.some((m) => m.user_id === p.user_id))
                        .map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.full_name || p.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => addMember(s.id)} disabled={!addUserId || memberDialog?.id !== s.id} className="gap-1.5">
                    <UserPlus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar squad" : "Novo squad"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nome *</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Cor</Label><Input type="color" value={editing.color || "#8B5CF6"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={saveSquad}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
