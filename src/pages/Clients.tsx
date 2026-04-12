import { useState } from "react";
import { useClients } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowLeft, Pencil, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_TOKEN_KEY = "default_meta_token";

interface ClientForm {
  name: string;
  metaAccountId: string;
  metaToken: string;
  googleSheetId: string;
  ticketMedio: string;
  phone: string;
}

const emptyForm: ClientForm = { name: "", metaAccountId: "", metaToken: "", googleSheetId: "", ticketMedio: "", phone: "" };

export default function Clients() {
  const { data: clients, isLoading } = useClients();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [defaultToken, setDefaultToken] = useState(() => localStorage.getItem(DEFAULT_TOKEN_KEY) || "");

  const set = (field: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, metaToken: defaultToken });
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      metaAccountId: c.meta_account_id || "",
      metaToken: c.meta_access_token || "",
      googleSheetId: c.google_sheet_id || "",
      ticketMedio: c.ticket_medio ? String(c.ticket_medio) : "",
      phone: c.phone || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      meta_account_id: form.metaAccountId.trim() || null,
      meta_access_token: form.metaToken.trim() || null,
      google_sheet_id: form.googleSheetId.trim() || null,
      ticket_medio: form.ticketMedio.trim() ? parseFloat(form.ticketMedio) : null,
      phone: form.phone.trim() || null,
    };

    // Save token as default
    if (form.metaToken.trim()) {
      localStorage.setItem(DEFAULT_TOKEN_KEY, form.metaToken.trim());
      setDefaultToken(form.metaToken.trim());
    }

    if (editingId) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Cliente atualizado!");
    } else {
      const { error } = await supabase.from("clients").insert(payload);
      if (error) { toast.error("Erro ao criar: " + error.message); return; }
      toast.success("Cliente criado!");
    }

    queryClient.invalidateQueries({ queryKey: ["clients"] });
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Cliente excluído");
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleSaveDefaultToken = async () => {
    const token = defaultToken.trim();
    if (!token) return;
    localStorage.setItem(DEFAULT_TOKEN_KEY, token);

    const { count, error } = await supabase
      .from("clients")
      .update({ meta_access_token: token })
      .not("id", "is", null);

    if (error) {
      toast.error("Erro ao atualizar clientes: " + error.message);
      return;
    }
    toast.success(`Token atualizado em ${count ?? 0} cliente(s)!`);
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };


  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">Gestão de Clientes</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Default Token */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Token Padrão da Meta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">
                Esse token será pré-preenchido ao criar novos clientes
              </Label>
              <Input
                type="password"
                value={defaultToken}
                onChange={(e) => setDefaultToken(e.target.value)}
                placeholder="Token de longa duração da Meta"
              />
            </div>
            <Button variant="outline" onClick={handleSaveDefaultToken}>Salvar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Client Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cliente" : "Adicionar Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input value={form.name} onChange={set("name")} placeholder="Ex: Moto Honda Recife" />
            </div>
            <div className="space-y-2">
              <Label>Meta Account ID</Label>
              <Input value={form.metaAccountId} onChange={set("metaAccountId")} placeholder="Ex: 123456789" />
            </div>
            <div className="space-y-2">
              <Label>Meta Access Token</Label>
              <Input type="password" value={form.metaToken} onChange={set("metaToken")} placeholder="Token de longa duração" />
            </div>
            <div className="space-y-2">
              <Label>Google Sheet ID (Planilha de Leads Qualificados)</Label>
              <Input value={form.googleSheetId} onChange={set("googleSheetId")} placeholder="Ex: 1OHtGzE2C3QzkM-kNVJ6xOhB9blAmFdMFJXha_bRUN4w" />
              <p className="text-xs text-muted-foreground">
                O ID está na URL: docs.google.com/spreadsheets/d/<strong>ID_AQUI</strong>/edit
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ticket Médio (R$)</Label>
              <Input type="number" value={form.ticketMedio} onChange={set("ticketMedio")} placeholder="Ex: 15000" />
              <p className="text-xs text-muted-foreground">Usado no Funil de Projeção de Vendas</p>
            </div>
            <div className="space-y-2">
              <Label>Telefone (WhatsApp)</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="Ex: 5581999999999" />
              <p className="text-xs text-muted-foreground">Número com código do país (55) + DDD + número. Usado para enviar links de criativos via WhatsApp.</p>
            </div>
            <Button onClick={handleSave} className="w-full">
              {editingId ? "Salvar Alterações" : "Criar Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* Clients Table */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Clientes Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : !clients?.length ? (
            <p className="text-muted-foreground text-center py-8">Nenhum cliente cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead className="text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-muted-foreground">Meta Account ID</TableHead>
                   <TableHead className="text-muted-foreground">Google Sheet</TableHead>
                   <TableHead className="text-muted-foreground">Telefone</TableHead>
                   <TableHead className="text-muted-foreground">Ticket Médio</TableHead>
                  <TableHead className="text-muted-foreground">Criado em</TableHead>
                  <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c: any) => (
                  <TableRow key={c.id} className="border-border/20">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.meta_account_id || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.google_sheet_id ? "✅ Configurado" : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.ticket_medio ? `R$ ${Number(c.ticket_medio).toLocaleString('pt-BR')}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
