import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Pencil, LogOut, Users as UsersIcon, RotateCcw, AlertTriangle, LayoutDashboard, ShieldCheck, ArrowLeft as BackIcon } from "lucide-react";
import { ActionVerificationDialog, type SensitiveAction } from "@/components/ActionVerificationDialog";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const DASHBOARDS = [
  { key: "criativos", label: "Dashboard de Criativos" },
  { key: "projecao", label: "Funil de Projeção de Vendas" },
];

const EMAIL_DOMAIN = "@kp.local";

interface UserRow {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  dashboards: string[];
  clients: { id: string; name: string }[];
  deleted_at?: string | null;
}

export default function UsersPage() {
  const { signOut } = useAuth();
  const { data: clients } = useClients();
  const queryClient = useQueryClient();

  // Fetch users with their roles, dashboard access, and client access
  const fetchUsers = async (trash: boolean): Promise<UserRow[]> => {
    let q = supabase.from("profiles").select("*");
    q = trash ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
    const { data: profiles } = await q;
    if (!profiles) return [];

    const { data: roles } = await supabase.from("user_roles").select("*");
    const { data: dashAccess } = await supabase.from("user_dashboard_access").select("*");
    const { data: clientAccess } = await supabase.from("user_client_access").select("*, clients(id, name)");

    return profiles.map((p: any) => {
      const userRoles = (roles || []).filter((r) => r.user_id === p.user_id);
      const role = userRoles.find((r) => r.role === "admin") ? "admin" : userRoles[0]?.role || "manager";
      const userDash = (dashAccess || []).filter((d) => d.user_id === p.user_id).map((d) => d.dashboard_key);
      const userClients = (clientAccess || [])
        .filter((ca) => ca.user_id === p.user_id)
        .map((ca: any) => ({ id: ca.client_id, name: ca.clients?.name || "—" }));

      return {
        user_id: p.user_id,
        email: p.email || "",
        full_name: p.full_name,
        phone: p.phone || null,
        role,
        dashboards: userDash,
        clients: userClients,
        deleted_at: p.deleted_at || null,
      } as UserRow;
    });
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: () => fetchUsers(false),
  });

  const { data: trashedUsers, refetch: refetchTrash } = useQuery({
    queryKey: ["admin_users_trash"],
    queryFn: () => fetchUsers(true),
  });

  // Create user dialog
  const [open, setOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "manager" as string,
    dashboards: [] as string[],
    clientIds: [] as string[],
    phone: "",
  });
  const [saving, setSaving] = useState(false);

  // Generic action verification dialog
  const [verifyAction, setVerifyAction] = useState<{
    action: SensitiveAction;
    payload: Record<string, any>;
    targetLabel: string;
    successMessage: string;
    onSuccess?: () => void;
  } | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Trash + permanent purge
  const [trashOpen, setTrashOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; name: string } | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");

  const resetForm = () => {
    setForm({ username: "", password: "", fullName: "", role: "manager", dashboards: [], clientIds: [], phone: "" });
    setEditingUserId(null);
  };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (u: UserRow) => {
    const username = u.email?.replace(EMAIL_DOMAIN, "") || "";
    setEditingUserId(u.user_id);
    setForm({
      username,
      password: "",
      fullName: u.full_name || "",
      role: u.role,
      dashboards: u.dashboards,
      clientIds: u.clients.map((c) => c.id),
      phone: u.phone || "",
    });
    setOpen(true);
  };

  const toggleDashboard = (key: string) => {
    setForm((f) => ({
      ...f,
      dashboards: f.dashboards.includes(key)
        ? f.dashboards.filter((d) => d !== key)
        : [...f.dashboards, key],
    }));
  };

  const toggleClient = (clientId: string) => {
    setForm((f) => ({
      ...f,
      clientIds: f.clientIds.includes(clientId)
        ? f.clientIds.filter((id) => id !== clientId)
        : [...f.clientIds, clientId],
    }));
  };

  const handleSave = async () => {
    if (!form.username.trim()) { toast.error("Usuário é obrigatório"); return; }
    if (!editingUserId && !form.password) { toast.error("Senha é obrigatória"); return; }
    if (!editingUserId && !form.phone.trim()) {
      toast.error("Telefone é obrigatório");
      return;
    }

    setSaving(true);
    try {
      if (editingUserId) {
        await supabase.from("user_dashboard_access").delete().eq("user_id", editingUserId);
        await supabase.from("user_client_access").delete().eq("user_id", editingUserId);

        if (form.dashboards.length > 0) {
          await supabase.from("user_dashboard_access").insert(
            form.dashboards.map((dk) => ({ user_id: editingUserId, dashboard_key: dk }))
          );
        }

        if (form.clientIds.length > 0) {
          await supabase.from("user_client_access").insert(
            form.clientIds.map((cid) => ({ user_id: editingUserId, client_id: cid }))
          );
        }

        await supabase.from("user_roles").delete().eq("user_id", editingUserId);
        await supabase.from("user_roles").insert({ user_id: editingUserId, role: form.role as any });

        if (form.fullName || form.phone) {
          const profileUpdate: any = {};
          if (form.fullName) profileUpdate.full_name = form.fullName;
          profileUpdate.phone = form.phone.trim() || null;
          await supabase.from("profiles").update(profileUpdate).eq("user_id", editingUserId);
        }

        toast.success("Usuário atualizado!");
        queryClient.invalidateQueries({ queryKey: ["admin_users"] });
        setOpen(false);
        resetForm();
      } else {
        // Trigger verification flow
        setOpen(false);
        setVerifyAction({
          action: "create_user",
          payload: {
            username: form.username.trim().toLowerCase(),
            password: form.password,
            full_name: form.fullName,
            role: form.role,
            dashboard_keys: form.dashboards,
            client_ids: form.clientIds,
            phone: form.phone.trim(),
          },
          targetLabel: `Criar usuário ${form.username}`,
          successMessage: "Usuário criado!",
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin_users"] });
            resetForm();
          },
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  const requestDelete = (u: UserRow) => {
    const name = u.full_name || u.email?.replace(EMAIL_DOMAIN, "") || "usuário";
    setDeleteTarget({ id: u.user_id, name });
    setDeleteConfirmText("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim().toLowerCase() !== "confirmar") {
      toast.error('Digite "confirmar" para excluir');
      return;
    }
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeleteConfirmText("");
    setVerifyAction({
      action: "delete_user",
      payload: { user_id: target.id },
      targetLabel: `Excluir usuário ${target.name}`,
      successMessage: `"${target.name}" enviado para a lixeira`,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin_users"] });
        refetchTrash();
      },
    });
  };

  const handleRestore = async (u: UserRow) => {
    const name = u.full_name || u.email?.replace(EMAIL_DOMAIN, "") || "usuário";
    try {
      const { error } = await supabase.functions.invoke("create-internal-user", {
        body: { action: "restore", user_id: u.user_id },
      });
      if (error) throw error;
      toast.success(`"${name}" restaurado`);
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      refetchTrash();
    } catch (err: any) {
      toast.error(err.message || "Erro ao restaurar");
    }
  };

  const confirmPurge = async () => {
    if (!purgeTarget) return;
    if (purgeConfirmText.trim().toLowerCase() !== "excluir") {
      toast.error('Digite "excluir" para confirmar');
      return;
    }
    const target = purgeTarget;
    setPurgeTarget(null);
    setPurgeConfirmText("");
    setVerifyAction({
      action: "purge_user",
      payload: { user_id: target.id },
      targetLabel: `Excluir DEFINITIVAMENTE usuário ${target.name}`,
      successMessage: `"${target.name}" excluído definitivamente`,
      onSuccess: () => {
        refetchTrash();
        queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      },
    });
  };

  const daysLeft = (deletedAt: string) => {
    const ms = new Date(deletedAt).getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 relative" onClick={() => setTrashOpen(true)}>
            <Trash2 className="h-4 w-4" /> Lixeira
            {trashedUsers && trashedUsers.length > 0 && (
              <span className="ml-1 rounded-full bg-destructive/20 text-destructive text-[10px] font-semibold px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {trashedUsers.length}
              </span>
            )}
          </Button>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo Usuário
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              {editingUserId ? "Editar Usuário" : "Criar Usuário"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="nome.usuario"
                  disabled={!!editingUserId}
                />
              </div>
              <div className="space-y-2">
                <Label>{editingUserId ? "Nova Senha (opcional)" : "Senha"}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Ex: João Silva"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Colaborador</SelectItem>
                    <SelectItem value="client">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Telefone (WhatsApp)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Ex: 5581999999999"
              />
              <p className="text-xs text-muted-foreground">
                Número com código do país (55) + DDD + número. Usado para enviar links de criativos via WhatsApp.
              </p>
            </div>

            {/* Dashboard access */}
            <div className="space-y-3">
              <Label>Acesso a Dashboards</Label>
              <div className="space-y-2">
                {DASHBOARDS.map((d) => (
                  <label key={d.key} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-secondary/30 cursor-pointer transition-colors">
                    <Checkbox
                      checked={form.dashboards.includes(d.key)}
                      onCheckedChange={() => toggleDashboard(d.key)}
                    />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Client access */}
            <div className="space-y-3">
              <Label>Acesso a Clientes</Label>
              {!clients?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors">
                    <Checkbox
                      checked={clients.length > 0 && form.clientIds.length === clients.length}
                      onCheckedChange={(checked) => {
                        setForm((f) => ({
                          ...f,
                          clientIds: checked ? clients.map((c: any) => c.id) : [],
                        }));
                      }}
                    />
                    <span className="text-sm font-medium">Selecionar Todos</span>
                  </label>
                  {clients.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-secondary/30 cursor-pointer transition-colors">
                      <Checkbox
                        checked={form.clientIds.includes(c.id)}
                        onCheckedChange={() => toggleClient(c.id)}
                      />
                      <span className="text-sm">{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? "Salvando..." : editingUserId ? "Salvar Alterações" : "Enviar código por WhatsApp"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Usuários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : !users?.length ? (
            <p className="text-muted-foreground text-center py-8">Nenhum usuário cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead className="text-muted-foreground">Usuário</TableHead>
                  <TableHead className="text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-muted-foreground">Dashboards</TableHead>
                  <TableHead className="text-muted-foreground">Clientes</TableHead>
                  <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isAdmin = u.role === "admin";
                  const dashCount = isAdmin ? DASHBOARDS.length : u.dashboards.length;
                  const clientCount = isAdmin ? (clients?.length || 0) : u.clients.length;
                  const clientNames = isAdmin
                    ? "Todos"
                    : u.clients.length > 0
                      ? u.clients.map((c) => c.name).join(", ")
                      : "Nenhum";
                  return (
                    <TableRow key={u.user_id} className="border-border/20">
                      <TableCell className="font-medium align-top">
                        {u.email?.replace(EMAIL_DOMAIN, "") || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top">{u.full_name || "—"}</TableCell>
                      <TableCell className="align-top">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          u.role === "admin" ? "bg-primary/20 text-primary" :
                          u.role === "client" ? "bg-fuchsia-500/20 text-fuchsia-400" :
                          "bg-blue-500/20 text-blue-400"
                        }`}>
                          {u.role === "admin" ? "Admin" : u.role === "client" ? "Cliente" : "Colaborador"}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px] font-semibold px-1.5 py-0.5">
                            <LayoutDashboard className="h-3 w-3" />
                            {dashCount}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {isAdmin ? "Todos" : u.dashboards.length > 0
                              ? u.dashboards.map((d) => DASHBOARDS.find((db) => db.key === d)?.label || d).join(", ")
                              : "Nenhum"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top max-w-[280px]">
                        <div className="flex items-start gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold px-1.5 py-0.5 shrink-0 mt-0.5">
                            {clientCount}
                          </span>
                          <span className="text-muted-foreground text-xs break-words" title={clientNames}>
                            {clientNames}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1 align-top">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {u.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => requestDelete(u)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Soft delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirmText(""); } }}
      >
        <DialogContent className="bg-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Excluir usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Você está prestes a excluir <strong className="text-foreground">{deleteTarget?.name}</strong>.
              O usuário irá para a lixeira e poderá ser restaurado em até <strong>7 dias</strong>.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Para confirmar a exclusão desse usuário, digite abaixo{" "}
                <span className="font-mono font-semibold text-foreground">confirmar</span>
              </Label>
              <Input
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteConfirmText.trim().toLowerCase() === "confirmar") {
                    confirmDelete();
                  }
                }}
                placeholder="confirmar"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteConfirmText.trim().toLowerCase() !== "confirmar"}
              >
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trash dialog */}
      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="bg-card border-border/50 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Lixeira de Usuários
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Usuários na lixeira não conseguem mais fazer login e são apagados <strong>definitivamente após 7 dias</strong>.
                Você pode restaurá-los antes disso.
              </p>
            </div>

            {!trashedUsers?.length ? (
              <p className="text-center text-sm text-muted-foreground py-8">A lixeira está vazia</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead className="text-muted-foreground">Usuário</TableHead>
                    <TableHead className="text-muted-foreground">Excluído em</TableHead>
                    <TableHead className="text-muted-foreground">Restam</TableHead>
                    <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trashedUsers.map((u) => {
                    const days = daysLeft(u.deleted_at!);
                    const danger = days <= 2;
                    const username = u.email?.replace(EMAIL_DOMAIN, "") || "—";
                    return (
                      <TableRow key={u.user_id} className="border-border/20">
                        <TableCell className="font-medium">
                          <div>{username}</div>
                          {u.full_name && (
                            <div className="text-[10px] text-muted-foreground/70 mt-0.5">{u.full_name}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {u.deleted_at ? new Date(u.deleted_at).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                            danger
                              ? "border-red-500/30 bg-red-500/10 text-red-300"
                              : "border-green-500/30 bg-green-500/10 text-green-300"
                          }`}>
                            {days} dia{days !== 1 ? "s" : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-green-400 hover:text-green-300"
                            onClick={() => handleRestore(u)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => { setPurgeTarget({ id: u.user_id, name: u.full_name || username }); setPurgeConfirmText(""); }}
                            title="Excluir definitivamente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Permanent purge confirmation */}
      <Dialog
        open={!!purgeTarget}
        onOpenChange={(o) => { if (!o) { setPurgeTarget(null); setPurgeConfirmText(""); } }}
      >
        <DialogContent className="bg-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Excluir definitivamente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Você está prestes a excluir <strong className="text-foreground">{purgeTarget?.name}</strong> de
              forma <strong className="text-destructive">permanente</strong>. Esta ação não pode ser desfeita.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Para confirmar, digite{" "}
                <span className="font-mono font-semibold text-foreground">excluir</span>
              </Label>
              <Input
                autoFocus
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && purgeConfirmText.trim().toLowerCase() === "excluir") {
                    confirmPurge();
                  }
                }}
                placeholder="excluir"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setPurgeTarget(null); setPurgeConfirmText(""); }}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmPurge}
                disabled={purgeConfirmText.trim().toLowerCase() !== "excluir"}
              >
                Excluir definitivamente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
