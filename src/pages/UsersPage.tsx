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
import { Plus, Trash2, ArrowLeft, Pencil, LogOut, Users as UsersIcon } from "lucide-react";
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
}

export default function UsersPage() {
  const { signOut } = useAuth();
  const { data: clients } = useClients();
  const queryClient = useQueryClient();

  // Fetch users with their roles, dashboard access, and client access
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      // Get profiles
      const { data: profiles } = await supabase.from("profiles").select("*");
      if (!profiles) return [];

      // Get roles
      const { data: roles } = await supabase.from("user_roles").select("*");
      // Get dashboard access
      const { data: dashAccess } = await supabase.from("user_dashboard_access").select("*");
      // Get client access
      const { data: clientAccess } = await supabase.from("user_client_access").select("*, clients(id, name)");

      return profiles.map((p) => {
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
          phone: (p as any).phone || null,
          role,
          dashboards: userDash,
          clients: userClients,
        } as UserRow;
      });
    },
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

    setSaving(true);
    try {
      if (editingUserId) {
        // Update: reassign dashboards and clients
        // Delete old access
        await supabase.from("user_dashboard_access").delete().eq("user_id", editingUserId);
        await supabase.from("user_client_access").delete().eq("user_id", editingUserId);

        // Insert new dashboard access
        if (form.dashboards.length > 0) {
          await supabase.from("user_dashboard_access").insert(
            form.dashboards.map((dk) => ({ user_id: editingUserId, dashboard_key: dk }))
          );
        }

        // Insert new client access
        if (form.clientIds.length > 0) {
          await supabase.from("user_client_access").insert(
            form.clientIds.map((cid) => ({ user_id: editingUserId, client_id: cid }))
          );
        }

        // Update role
        await supabase.from("user_roles").delete().eq("user_id", editingUserId);
        await supabase.from("user_roles").insert({ user_id: editingUserId, role: form.role as any });

        // Update profile name
        if (form.fullName) {
          await supabase.from("profiles").update({ full_name: form.fullName }).eq("user_id", editingUserId);
        }

        toast.success("Usuário atualizado!");
      } else {
        // Create new user via edge function
        const { data, error } = await supabase.functions.invoke("create-internal-user", {
          body: {
            username: form.username.trim().toLowerCase(),
            password: form.password,
            full_name: form.fullName,
            role: form.role,
            dashboard_keys: form.dashboards,
            client_ids: form.clientIds,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("Usuário criado!");
      }

      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  const handleDelete = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("create-internal-user", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      toast.success("Usuário excluído");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
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
              {saving ? "Salvando..." : editingUserId ? "Salvar Alterações" : "Criar Usuário"}
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
                {users.map((u) => (
                  <TableRow key={u.user_id} className="border-border/20">
                    <TableCell className="font-medium">
                      {u.email?.replace(EMAIL_DOMAIN, "") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.full_name || "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        u.role === "admin" ? "bg-primary/20 text-primary" :
                        u.role === "client" ? "bg-fuchsia-500/20 text-fuchsia-400" :
                        "bg-blue-500/20 text-blue-400"
                      }`}>
                        {u.role === "admin" ? "Admin" : u.role === "client" ? "Cliente" : "Colaborador"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {u.role === "admin" ? "Todos" : u.dashboards.length > 0
                        ? u.dashboards.map((d) => DASHBOARDS.find((db) => db.key === d)?.label || d).join(", ")
                        : "Nenhum"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                      {u.role === "admin" ? "Todos" : u.clients.length > 0
                        ? u.clients.map((c) => c.name).join(", ")
                        : "Nenhum"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {u.role !== "admin" && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(u.user_id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
