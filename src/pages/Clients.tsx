import { useState, useMemo, useEffect } from "react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Pencil, LogOut, Search, Lock, Unlock, Check, X, Eye, EyeOff, RotateCcw, AlertTriangle, KeyRound, Send } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { GhlStageMappingEditor, type StageMapping } from "@/components/clients/GhlStageMappingEditor";
import { RelatorioConfigModal } from "@/components/clients/RelatorioConfigModal";
import { HealthBadge } from "@/components/clients/HealthBadge";
import { useClientsHealth, type HealthLevel } from "@/hooks/useClientHealth";

import { ActionVerificationDialog, type SensitiveAction } from "@/components/ActionVerificationDialog";

const LEGACY_TOKEN_KEY = "default_meta_token";

const EMPTY_MAPPING: StageMapping = {
  cpf_aprovado: [],
  cpf_nao_aprovado: [],
  vendas_financiamento: [],
  vendas_consorcio: [],
};

interface MetaToken {
  id: string;
  name: string;
  token: string;
}

interface ClientForm {
  name: string;
  metaAccountId: string;
  metaTokenId: string;
  googleSheetId: string;
  cpfKeywords: string;
  saleKeywords: string;
  ticketMedio: string;
  ghlApiKey: string;
  ghlLocationId: string;
  stageMapping: StageMapping;
  squadId: string;
}

const emptyForm: ClientForm = {
  name: "",
  metaAccountId: "",
  metaTokenId: "",
  googleSheetId: "",
  cpfKeywords: "",
  saleKeywords: "",
  ticketMedio: "",
  ghlApiKey: "",
  ghlLocationId: "",
  stageMapping: EMPTY_MAPPING,
  squadId: "",
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
        ok
          ? "border-green-500/30 bg-green-500/10 text-green-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
      title={ok ? `${label} configurado` : `${label} faltando`}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

export default function Clients() {
  const { data: clients, isLoading } = useClients();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginalTokenId, setEditingOriginalTokenId] = useState<string>("");
  const [editingOriginalMetaAccessToken, setEditingOriginalMetaAccessToken] = useState<string>("");
  const [tokenSelectionTouched, setTokenSelectionTouched] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<"all" | "attention" | "critical">("all");
  const [squadFilter, setSquadFilter] = useState<string>("all");
  const { data: healthMap } = useClientsHealth();

  // Token lock state (shared for the whole tokens card)
  const [revealedTokenId, setRevealedTokenId] = useState<string | null>(null);

  // Tokens — load from DB
  const { data: metaTokens, refetch: refetchTokens } = useQuery({
    queryKey: ["meta_tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_tokens")
        .select("id, name, token")
        .order("name");
      if (error) throw error;
      return (data || []) as MetaToken[];
    },
  });

  const { data: squads } = useQuery({
    queryKey: ["squads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squads")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });

  // Token add/edit dialog
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [tokenForm, setTokenForm] = useState<{ name: string; token: string }>({ name: "", token: "" });
  const [deleteTokenTarget, setDeleteTokenTarget] = useState<MetaToken | null>(null);

  // One-time migration of legacy default token from localStorage to meta_tokens
  useEffect(() => {
    if (!metaTokens) return;
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!legacy) return;
    if (metaTokens.some((t) => t.token === legacy)) {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      return;
    }
    if (metaTokens.length > 0) return; // já existem tokens — não migrar
    (async () => {
      const { error } = await supabase
        .from("meta_tokens")
        .insert({ name: "Token Padrão", token: legacy });
      if (!error) {
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        refetchTokens();
        toast.success("Token padrão antigo migrado para a lista");
      }
    })();
  }, [metaTokens, refetchTokens]);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Report config state
  const [reportConfigClient, setReportConfigClient] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Trash state
  const [trashOpen, setTrashOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; name: string } | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");

  // Generic action verification
  const [verifyAction, setVerifyAction] = useState<{
    action: SensitiveAction;
    payload: Record<string, any>;
    targetLabel: string;
    successMessage: string;
    reopenEditorOnCancel?: boolean;
    onSuccess?: () => void;
  } | null>(null);

  // Trash query (admins only via RLS)
  const { data: trashedClients, refetch: refetchTrash } = useQuery({
    queryKey: ["clients_trash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, meta_account_id, deleted_at, created_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleRestore = async (id: string, name: string) => {
    const { error } = await supabase
      .from("clients")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) { toast.error("Erro ao restaurar: " + error.message); return; }
    toast.success(`"${name}" restaurado`);
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    refetchTrash();
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
      action: "purge_client",
      payload: { client_id: target.id },
      targetLabel: `Excluir DEFINITIVAMENTE cliente ${target.name}`,
      successMessage: `"${target.name}" excluído definitivamente`,
      onSuccess: () => {
        refetchTrash();
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      },
    });
  };

  const daysLeft = (deletedAt: string) => {
    const ms = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  };

  const set = (field: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const openCreate = () => {
    setEditingId(null);
    setEditingOriginalTokenId("");
    setEditingOriginalMetaAccessToken("");
    setTokenSelectionTouched(false);
    setForm({ ...emptyForm });
    setOpen(true);
  };

  const openEdit = (c: any) => {
    const resolvedTokenId = c.meta_token_id
      || metaTokens?.find((t) => t.token === c.meta_access_token)?.id
      || "";

    setEditingId(c.id);
    setEditingOriginalTokenId(resolvedTokenId);
    setEditingOriginalMetaAccessToken(c.meta_access_token || "");
    setTokenSelectionTouched(false);
    setForm({
      name: c.name,
      metaAccountId: c.meta_account_id || "",
      metaTokenId: resolvedTokenId,
      googleSheetId: c.google_sheet_id || "",
      cpfKeywords: (c as any).sheet_cpf_keywords || "",
      saleKeywords: (c as any).sheet_sale_keywords || "",
      ticketMedio: c.ticket_medio ? String(c.ticket_medio) : "",
      ghlApiKey: c.ghl_api_key || "",
      ghlLocationId: c.ghl_location_id || "",
      stageMapping: { ...EMPTY_MAPPING, ...(c.ghl_stage_mapping || {}) },
      squadId: c.squad_id || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }

    const selectedToken = metaTokens?.find((t) => t.id === form.metaTokenId);
    const nextMetaAccessToken = form.metaTokenId
      ? selectedToken?.token || null
      : editingId && !tokenSelectionTouched
        ? editingOriginalMetaAccessToken || null
        : null;

    const clientPayload = {
      name: form.name.trim(),
      meta_account_id: form.metaAccountId.trim() || null,
      meta_token_id: form.metaTokenId || null,
       meta_access_token: nextMetaAccessToken,
      google_sheet_id: form.googleSheetId.trim() || null,
      sheet_cpf_keywords: form.cpfKeywords.trim() || null,
      sheet_sale_keywords: form.saleKeywords.trim() || null,
      ticket_medio: form.ticketMedio.trim() ? parseFloat(form.ticketMedio) : null,
      ghl_api_key: form.ghlApiKey.trim() || null,
      ghl_location_id: form.ghlLocationId.trim() || null,
      ghl_stage_mapping: form.stageMapping,
      squad_id: form.squadId || null,
    };

    if (editingId) {
      const tokenChanged = (form.metaTokenId || "") !== (editingOriginalTokenId || "");
      setVerifyAction({
        // Always use update_client so the FULL payload (squad_id, mappings, token, etc.) is persisted.
        // update_client_meta_token only swaps the token fields and would discard other edits.
        action: "update_client",
        payload: { client_id: editingId, client: clientPayload },
        targetLabel: tokenChanged
          ? `Atualizar cliente ${form.name} (inclui troca de token Meta)`
          : `Atualizar cliente ${form.name}`,
        successMessage: "Cliente atualizado!",
        reopenEditorOnCancel: true,
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["clients"] });
          queryClient.refetchQueries({ queryKey: ["clients"] });
          setForm(emptyForm);
          setEditingId(null);
          setEditingOriginalTokenId("");
          setEditingOriginalMetaAccessToken("");
          setTokenSelectionTouched(false);
          setOpen(false);
        },
      });
    } else {
      setOpen(false);
      setVerifyAction({
        action: "create_client",
        payload: { client: clientPayload },
        targetLabel: `Criar cliente ${form.name}`,
        successMessage: "Cliente criado!",
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["clients"] });
          setForm(emptyForm);
          setEditingId(null);
          setEditingOriginalTokenId("");
          setEditingOriginalMetaAccessToken("");
          setTokenSelectionTouched(false);
        },
      });
    }
  };

  const requestDelete = (c: any) => {
    setDeleteTarget({ id: c.id, name: c.name });
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
      action: "delete_client",
      payload: { client_id: target.id },
      targetLabel: `Excluir cliente ${target.name}`,
      successMessage: `"${target.name}" enviado para a lixeira (30 dias)`,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        queryClient.invalidateQueries({ queryKey: ["clients_trash"] });
      },
    });
  };

  // === Tokens da Meta ===
  // Access control is enforced server-side via RLS (admin-only on meta_tokens).

  const openCreateToken = () => {
    setEditingTokenId(null);
    setTokenForm({ name: "", token: "" });
    setTokenDialogOpen(true);
  };

  const openEditToken = (t: MetaToken) => {
    setEditingTokenId(t.id);
    setTokenForm({ name: t.name, token: t.token });
    setTokenDialogOpen(true);
  };

  const saveToken = async () => {
    const name = tokenForm.name.trim();
    const token = tokenForm.token.trim();
    if (!name || !token) {
      toast.error("Preencha nome e token");
      return;
    }
    if (editingTokenId) {
      const { error } = await supabase
        .from("meta_tokens")
        .update({ name, token })
        .eq("id", editingTokenId);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
      // Propaga novo valor para todos os clientes vinculados
      const { error: propErr, count } = await supabase
        .from("clients")
        .update({ meta_access_token: token })
        .eq("meta_token_id", editingTokenId);
      if (propErr) {
        toast.error("Token salvo, mas falhou ao atualizar clientes: " + propErr.message);
      } else {
        toast.success(`Token "${name}" atualizado (${count ?? 0} cliente(s) sincronizado(s))`);
      }
    } else {
      const { error } = await supabase.from("meta_tokens").insert({ name, token });
      if (error) { toast.error("Erro ao criar: " + error.message); return; }
      toast.success(`Token "${name}" criado`);
    }
    setTokenDialogOpen(false);
    setEditingTokenId(null);
    setTokenForm({ name: "", token: "" });
    refetchTokens();
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const confirmDeleteToken = async () => {
    if (!deleteTokenTarget) return;
    const { error } = await supabase
      .from("meta_tokens")
      .delete()
      .eq("id", deleteTokenTarget.id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success(`Token "${deleteTokenTarget.name}" excluído`);
    setDeleteTokenTarget(null);
    refetchTokens();
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };


  const filteredClients = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    let list = q ? clients.filter((c: any) => c.name?.toLowerCase().includes(q)) : [...clients];

    if (healthFilter !== "all" && healthMap) {
      list = list.filter((c: any) => {
        const lvl = healthMap[c.id]?.level;
        if (healthFilter === "critical") return lvl === "red";
        if (healthFilter === "attention") return lvl === "red" || lvl === "yellow";
        return true;
      });
    }

    if (squadFilter === "none") {
      list = list.filter((c: any) => !c.squad_id);
    } else if (squadFilter !== "all") {
      list = list.filter((c: any) => c.squad_id === squadFilter);
    }

    const order: Record<HealthLevel | "none", number> = { red: 0, yellow: 1, green: 2, none: 3 };
    list.sort((a: any, b: any) => {
      const la = (healthMap?.[a.id]?.level ?? "none") as HealthLevel | "none";
      const lb = (healthMap?.[b.id]?.level ?? "none") as HealthLevel | "none";
      if (order[la] !== order[lb]) return order[la] - order[lb];
      return (a.name || "").localeCompare(b.name || "");
    });

    return list;
  }, [clients, search, healthFilter, squadFilter, healthMap]);

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
          <Button variant="outline" className="gap-2 relative" onClick={() => setTrashOpen(true)}>
            <Trash2 className="h-4 w-4" /> Lixeira
            {trashedClients && trashedClients.length > 0 && (
              <span className="ml-1 rounded-full bg-destructive/20 text-destructive text-[10px] font-semibold px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {trashedClients.length}
              </span>
            )}
          </Button>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tokens da Meta — acesso restrito a admins via RLS */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Tokens da Meta
            </span>
            <Button size="sm" className="gap-2" onClick={openCreateToken}>
              <Plus className="h-4 w-4" /> Adicionar Token
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Cadastre tokens nomeados (ex: "Token de Will", "Token de Thiago"). Ao configurar um cliente, escolha qual token utilizar.
          </p>
          {!metaTokens?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum token cadastrado ainda. Clique em "Adicionar Token" para começar.
            </p>
          ) : (
            <div className="space-y-2">
              {metaTokens.map((t) => {
                const isRevealed = revealedTokenId === t.id;
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/40 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs font-mono text-muted-foreground truncate">
                        {isRevealed ? t.token : "•".repeat(Math.min(40, t.token.length))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRevealedTokenId(isRevealed ? null : t.id)}
                      title={isRevealed ? "Ocultar" : "Mostrar"}
                    >
                      {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditToken(t)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTokenTarget(t)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token add/edit dialog */}
      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent className="bg-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTokenId ? "Editar Token" : "Novo Token"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome do token</Label>
              <Input
                autoFocus
                value={tokenForm.name}
                onChange={(e) => setTokenForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Token de Will"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token de longa duração da Meta</Label>
              <Input
                value={tokenForm.token}
                onChange={(e) => setTokenForm((f) => ({ ...f, token: e.target.value }))}
                placeholder="EAAB..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setTokenDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveToken}>{editingTokenId ? "Salvar" : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete token confirmation */}
      <Dialog
        open={!!deleteTokenTarget}
        onOpenChange={(o) => { if (!o) setDeleteTokenTarget(null); }}
      >
        <DialogContent className="bg-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Excluir token
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Excluir <span className="font-semibold text-foreground">{deleteTokenTarget?.name}</span>?
              Clientes vinculados a esse token <strong>perderão a referência</strong> (mas o valor copiado em cada cliente continuará funcionando até ser alterado).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDeleteTokenTarget(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteToken}>Excluir</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Client Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cliente" : "Adicionar Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2 pb-2">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input value={form.name} onChange={set("name")} placeholder="Ex: Moto Honda Recife" />
            </div>
            <div className="space-y-2">
              <Label>Squad</Label>
              <Select
                value={form.squadId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, squadId: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um squad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem squad —</SelectItem>
                  {squads?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meta Account ID</Label>
              <Input value={form.metaAccountId} onChange={set("metaAccountId")} placeholder="Ex: 123456789" />
            </div>
            <div className="space-y-2">
              <Label>Token da Meta</Label>
              <Select
                value={form.metaTokenId || "__none__"}
                onValueChange={(v) => {
                  setTokenSelectionTouched(true);
                  setForm((f) => ({ ...f, metaTokenId: v === "__none__" ? "" : v }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um token cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {metaTokens?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!metaTokens?.length && (
                <p className="text-xs text-amber-300/80">
                  Nenhum token cadastrado. Adicione um na seção "Tokens da Meta" acima.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Google Sheet ID (Planilha de Leads Qualificados)</Label>
              <Input value={form.googleSheetId} onChange={set("googleSheetId")} placeholder="Ex: 1OHtGzE2C3QzkM-kNVJ6xOhB9blAmFdMFJXha_bRUN4w" />
              <p className="text-xs text-muted-foreground">
                O ID está na URL: docs.google.com/spreadsheets/d/<strong>ID_AQUI</strong>/edit
              </p>
            </div>
            <div className="space-y-2">
              <Label>Palavras-chave "CPF Aprovado" (planilha)</Label>
              <Input value={form.cpfKeywords} onChange={set("cpfKeywords")} placeholder="Ex: Aprovou, Qualificado, Lead Qualificado" />
              <p className="text-xs text-muted-foreground">
                Se a coluna <strong>TIPO DE EVENTO</strong> usar outro termo (ex.: "Aprovou") em vez de "CPF Aprovado", liste aqui separado por vírgula. Conta <strong>além</strong> do padrão.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Palavras-chave "Venda" (planilha)</Label>
              <Input value={form.saleKeywords} onChange={set("saleKeywords")} placeholder="Ex: Vendido, Fechou" />
              <p className="text-xs text-muted-foreground">
                Termos que contam como <strong>venda</strong> além do padrão (venda/vendas/consórcio/financiamento). Ex.: "Vendido". Separe por vírgula.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ticket Médio (R$)</Label>
              <Input type="number" value={form.ticketMedio} onChange={set("ticketMedio")} placeholder="Ex: 15000" />
              <p className="text-xs text-muted-foreground">Usado no Funil de Projeção de Vendas</p>
            </div>
            <div className="space-y-2">
              <Label>CRM API Key</Label>
              <Input type="password" value={form.ghlApiKey} onChange={set("ghlApiKey")} placeholder="Ex: pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              <p className="text-xs text-muted-foreground">API Key do GoHighLevel para integração com pipeline</p>
            </div>
            <div className="space-y-2">
              <Label>CRM Location ID (Subconta)</Label>
              <Input value={form.ghlLocationId} onChange={set("ghlLocationId")} placeholder="Ex: T6S5cO1s72adtbDovjdX" />
              <p className="text-xs text-muted-foreground">ID da subconta no GoHighLevel</p>
            </div>

            <GhlStageMappingEditor
              clientId={editingId}
              ghlApiKey={form.ghlApiKey}
              ghlLocationId={form.ghlLocationId}
              value={form.stageMapping}
              onChange={(m) => setForm((f) => ({ ...f, stageMapping: m }))}
            />

            <Button onClick={handleSave} className="w-full">
              {editingId ? "Salvar Alterações" : "Criar Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* Clients Table */}
      <Card className="glass-card border-border/50">
        <CardHeader className="gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">
              Clientes Cadastrados
              {clients?.length ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({filteredClients.length} de {clients.length})
                </span>
              ) : null}
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="inline-flex rounded-md border border-border/40 bg-secondary/30 p-0.5 text-xs">
                {([
                  { k: "all", label: "Todos" },
                  { k: "attention", label: "Atenção" },
                  { k: "critical", label: "Críticos" },
                ] as const).map((opt) => (
                  <button
                    key={opt.k}
                    onClick={() => setHealthFilter(opt.k)}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      healthFilter === opt.k
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Select value={squadFilter} onValueChange={setSquadFilter}>
                <SelectTrigger className="h-8 w-full sm:w-[170px] text-xs">
                  <SelectValue placeholder="Todos os squads" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os squads</SelectItem>
                  {squads?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                  <SelectItem value="none">⚠ Sem squad</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar cliente..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : !clients?.length ? (
            <p className="text-muted-foreground text-center py-8">Nenhum cliente cadastrado</p>
          ) : !filteredClients.length ? (
            <p className="text-muted-foreground text-center py-8">Nenhum cliente encontrado para "{search}"</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead className="text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-muted-foreground">Status do Cadastro</TableHead>
                  <TableHead className="text-muted-foreground">Ticket Médio</TableHead>
                  <TableHead className="text-muted-foreground">Criado em</TableHead>
                  <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((c: any) => {
                  const checks = [
                    { label: "Meta ID", ok: !!c.meta_account_id },
                    { label: "Token Meta", ok: !!c.meta_access_token || !!c.meta_token_id },
                    { label: "Sheet", ok: !!c.google_sheet_id },
                    { label: "Ticket", ok: !!c.ticket_medio },
                    { label: "CRM Key", ok: !!c.ghl_api_key },
                    { label: "Subconta CRM", ok: !!c.ghl_location_id },
                  ];
                  const okCount = checks.filter((x) => x.ok).length;
                  const total = checks.length;
                  const pct = (okCount / total) * 100;
                  const barColor =
                    pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";

                  return (
                    <TableRow key={c.id} className="border-border/20">
                      <TableCell className="font-medium align-top">
                        <div className="flex items-center gap-2">
                          <HealthBadge health={healthMap?.[c.id]} />
                          <span>{c.name}</span>
                        </div>
                        {c.meta_account_id && (
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
                            {c.meta_account_id}
                          </div>
                        )}
                        {c.squad_id ? (
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                            Squad: {squads?.find((s) => s.id === c.squad_id)?.name ?? "—"}
                          </div>
                        ) : (
                          <button
                            onClick={() => openEdit(c)}
                            className="mt-1 inline-flex items-center gap-1 rounded-md border border-red-500/60 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-300 animate-pulse hover:bg-red-500/30 hover:text-red-200 transition-colors"
                            title="Este cliente não tem squad definido — clique para editar"
                          >
                            <AlertTriangle className="h-3 w-3" /> Sem squad — editar
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-2 min-w-[260px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                              <div
                                className={`h-full transition-all ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                              {okCount}/{total}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {checks.map((chk) => (
                              <StatusPill key={chk.label} ok={chk.ok} label={chk.label} />
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top">
                        {c.ticket_medio ? `R$ ${Number(c.ticket_medio).toLocaleString('pt-BR')}` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right space-x-1 align-top">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReportConfigClient({ id: c.id, name: c.name })}
                          title="Configurar relatório automático"
                          className="gap-1.5 px-2 h-8 text-violet-400 border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 hover:text-violet-300 hover:border-violet-400/50 transition-all"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-medium">Relatório</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => requestDelete(c)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Report config modal */}
      <RelatorioConfigModal
        client={reportConfigClient}
        onClose={() => setReportConfigClient(null)}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirmText(""); } }}
      >
        <DialogContent className="bg-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Excluir cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Você está prestes a excluir{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>.
              Essa ação não pode ser desfeita.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Para confirmar a exclusão desse cliente, digite abaixo{" "}
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
              <Button
                variant="ghost"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
              >
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
              <Trash2 className="h-4 w-4" /> Lixeira de Clientes
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Clientes na lixeira são excluídos <strong>definitivamente após 30 dias</strong>.
                Você pode restaurá-los antes disso.
              </p>
            </div>

            {!trashedClients?.length ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                A lixeira está vazia
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead className="text-muted-foreground">Nome</TableHead>
                    <TableHead className="text-muted-foreground">Excluído em</TableHead>
                    <TableHead className="text-muted-foreground">Restam</TableHead>
                    <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trashedClients.map((c: any) => {
                    const days = daysLeft(c.deleted_at);
                    const danger = days <= 5;
                    return (
                      <TableRow key={c.id} className="border-border/20">
                        <TableCell className="font-medium">
                          <div>{c.name}</div>
                          {c.meta_account_id && (
                            <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                              {c.meta_account_id}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(c.deleted_at).toLocaleString("pt-BR")}
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
                            onClick={() => handleRestore(c.id, c.name)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => { setPurgeTarget({ id: c.id, name: c.name }); setPurgeConfirmText(""); }}
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
              <Button
                variant="ghost"
                onClick={() => { setPurgeTarget(null); setPurgeConfirmText(""); }}
              >
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

      {verifyAction && (
        <ActionVerificationDialog
          open={!!verifyAction}
          onOpenChange={(o) => {
            if (!o) {
              if (verifyAction?.reopenEditorOnCancel) setOpen(true);
              setVerifyAction(null);
            }
          }}
          action={verifyAction.action}
          payload={verifyAction.payload}
          targetLabel={verifyAction.targetLabel}
          successMessage={verifyAction.successMessage}
          onSuccess={() => {
            verifyAction.onSuccess?.();
            setVerifyAction(null);
          }}
        />
      )}
    </div>
  );
}
