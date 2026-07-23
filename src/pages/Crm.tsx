import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, MessageSquare, Target, Users, Settings, Wrench,
  Search, Plus, Send, User, Link2, Phone, Mail, X,
  Pencil, ChevronUp, ChevronDown, Trash2, UserPlus, Shield, QrCode,
} from "lucide-react";

// ============================================================================
// CRM · Fase 3 — Tela de Conversas conectada aos dados reais (crm_*).
// Conversas: lista real (crm_conversations + crm_contacts) com filtro
//   Todos/Não lidos (campo status), chat real (crm_messages) em ordem
//   cronológica, envio gravando no banco, Realtime e painel do contato.
// Oportunidades/Contatos/Config seguem como casca (Fases 4+).
// Multi-tenant: a filtragem por cliente_id é feita pela RLS no Supabase.
// Tokens de tema (light/dark) + acento roxo (primary — identidade da KP).
// ============================================================================

type Section = "conversas" | "oportunidades" | "contatos" | "config";

const NAV: { key: Section; label: string; icon: typeof MessageSquare }[] = [
  { key: "conversas", label: "Conversas", icon: MessageSquare },
  { key: "oportunidades", label: "Oportun.", icon: Target },
  { key: "contatos", label: "Contatos", icon: Users },
  { key: "config", label: "Config", icon: Settings },
];

// Etapas padrão ao criar um funil do zero + cor do marcador por posição.
const DEFAULT_STAGES = ["Novo lead", "Em atendimento", "Proposta enviada", "Ganho", "Perdido"];
const STAGE_DOTS = ["bg-blue-500", "bg-amber-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500"];

// ---------------------------------------------------------------------------
// Tipos das linhas do CRM
// ---------------------------------------------------------------------------
type Contato = { id: string; nome: string | null; telefone: string | null; email: string | null; foto_url?: string | null; is_group?: boolean | null };
type Conversa = {
  id: string;
  cliente_id: string;
  contact_id: string;
  status: "nao_lido" | "lido" | "arquivado";
  atualizado_em: string;
  ultima_mensagem: string | null;
  ultima_em: string | null;
  crm_contacts: Contato | null;
};
type Mensagem = {
  id: string;
  conversation_id: string;
  direcao: "recebida" | "enviada";
  tipo: string;
  conteudo: string | null;
  url_midia: string | null;
  lida: boolean;
  criado_em: string;
  remetente_nome?: string | null;
  remetente_telefone?: string | null;
};
type Pipeline = { id: string; cliente_id: string; nome: string };
type Stage = { id: string; nome: string; ordem: number; cliente_id: string; pipeline_id: string };
type Opp = {
  id: string;
  cliente_id: string;
  contact_id: string;
  pipeline_stage_id: string | null;
  valor: number | null;
  status: "aberto" | "ganho" | "perdido";
  item_compra?: string | null;
  vendedor?: string | null;
  observacao?: string | null;
  crm_contacts: { id: string; nome: string | null } | null;
};
type ContatoFull = { id: string; cliente_id: string; nome: string | null; telefone: string | null; email: string | null; criado_em: string };
type CrmUser = { id: string; auth_user_id: string | null; nome: string | null; email: string | null; cliente_id: string; papel: "admin" | "atendente" | "gestor" };
type ClienteRow = { id: string; nome: string | null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// erro de "tabela/coluna crm_* não existe" -> CRM ainda não configurado no banco
function isSchemaMissing(error: any): boolean {
  const msg = `${error?.message || ""} ${error?.code || ""}`;
  return /crm_|schema cache|does not exist|PGRST205|PGRST20[0-9]|42P01|42703/i.test(msg);
}

function StatusBadge({ status }: { status: "aberto" | "ganho" | "perdido" }) {
  const map = {
    aberto: "text-muted-foreground bg-muted",
    ganho: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15",
    perdido: "text-rose-700 dark:text-rose-300 bg-rose-500/15",
  } as const;
  const label = { aberto: "Aberto", ganho: "Ganho", perdido: "Perdido" }[status];
  return <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${map[status]}`}>{label}</span>;
}

function EmptyState({ icon: Icon, title, sub }: { icon: typeof MessageSquare; title: string; sub?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {sub && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="h-14 shrink-0 border-b border-border px-4 flex items-center justify-between">
      <h2 className="font-bold text-foreground">{title}</h2>
      {action}
    </div>
  );
}


function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm text-foreground break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

function Avatar({ nome, size = "md", foto }: { nome: string | null | undefined; size?: "md" | "lg"; foto?: string | null }) {
  const cls = size === "lg" ? "h-16 w-16 text-xl" : "h-10 w-10 text-sm";
  if (foto) {
    return (
      <img
        src={foto}
        alt={nome || "avatar"}
        className={`${cls} shrink-0 rounded-full object-cover bg-muted`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={`${cls} shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold`}>
      {(nome || "?").charAt(0).toUpperCase()}
    </div>
  );
}

// ---------------------------- CONVERSAS (real) -----------------------------
function Conversas() {
  const [filter, setFilter] = useState<"contatos" | "grupos" | "nao_lidos">("contatos");
  const [busca, setBusca] = useState("");
  const [convs, setConvs] = useState<Conversa[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selIdRef = useRef<string | null>(null);
  selIdRef.current = selId;

  const sel = convs.find((c) => c.id === selId) || null;

  const loadConversas = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("crm_conversations")
      .select("id,cliente_id,contact_id,status,atualizado_em,ultima_mensagem,ultima_em,crm_contacts(id,nome,telefone,email,foto_url,is_group)")
      .neq("status", "arquivado")
      // ordena pela última MENSAGEM (não por atualizado_em, que muda ao só ler/abrir);
      // conversas sem mensagem (ultima_em nulo) vão para o fim.
      .order("ultima_em", { ascending: false, nullsFirst: false })
      .order("atualizado_em", { ascending: false });
    if (error) {
      const msg = `${error.message || ""} ${error.code || ""}`;
      // tabela/coluna ainda não existe -> CRM não configurado no banco
      if (/crm_conversations|schema cache|does not exist|PGRST205|PGRST20[0-9]|42P01|42703/i.test(msg)) {
        setNotReady(true);
      }
      setLoading(false);
      return;
    }
    setConvs((data as Conversa[]) || []);
    setNotReady(false);
    setLoading(false);
  }, []);

  const loadMensagens = useCallback(async (conversationId: string) => {
    const { data } = await (supabase as any)
      .from("crm_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("criado_em", { ascending: true });
    setMsgs((data as Mensagem[]) || []);
  }, []);

  // carga inicial
  useEffect(() => { void loadConversas(); }, [loadConversas]);

  // Realtime: nova mensagem ou mudança de conversa -> atualiza lista;
  // se for da conversa aberta, recarrega o chat também.
  useEffect(() => {
    const ch = supabase
      .channel("crm-conversas-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_messages" }, (payload: any) => {
        void loadConversas();
        const cid = (payload?.new || payload?.old || {}).conversation_id;
        if (cid && cid === selIdRef.current) void loadMensagens(cid);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_conversations" }, () => {
        void loadConversas();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [loadConversas, loadMensagens]);

  // rolar pro fim quando o chat muda
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, selId]);

  const abrir = async (c: Conversa) => {
    setSelId(c.id);
    await loadMensagens(c.id);
    if (c.status === "nao_lido") {
      await (supabase as any).from("crm_conversations").update({ status: "lido" }).eq("id", c.id);
      await (supabase as any).from("crm_messages").update({ lida: true })
        .eq("conversation_id", c.id).eq("direcao", "recebida").eq("lida", false);
      void loadConversas();
    }
  };

  const enviar = async () => {
    const texto = draft.trim();
    if (!texto || !sel || sending) return;
    setSending(true);
    const { error } = await (supabase as any).from("crm_messages").insert({
      cliente_id: sel.cliente_id,
      conversation_id: sel.id,
      direcao: "enviada",
      tipo: "texto",
      conteudo: texto,
      lida: true,
    });
    setSending(false);
    if (error) { toast.error("Não foi possível enviar: " + (error.message || "")); return; }
    setDraft("");
    await loadMensagens(sel.id);
    void loadConversas();
  };

  if (notReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
          <Wrench className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground">CRM ainda não configurado no banco</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Rode os scripts SQL das Fases 1 e 3 no Supabase (tabelas <code>crm_*</code>, trigger e Realtime)
            para as conversas aparecerem aqui.
          </p>
        </div>
      </div>
    );
  }

  const visibleConvs = convs
    .filter((c) => {
      if (filter === "nao_lidos") return c.status === "nao_lido";
      const isG = !!c.crm_contacts?.is_group;
      return filter === "grupos" ? isG : !isG;
    })
    .filter((c) => !busca.trim() || (c.crm_contacts?.nome || "").toLowerCase().includes(busca.trim().toLowerCase()));

  const countUnread = convs.filter((c) => c.status === "nao_lido").length;
  const countGroups = convs.filter((c) => c.crm_contacts?.is_group).length;

  return (
    <>
      {/* LISTA */}
      <div className="w-72 sm:w-80 shrink-0 border-r border-border flex flex-col min-h-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex gap-1">
            {([
              { key: "contatos", label: "Contatos" },
              { key: "grupos", label: `Grupos${countGroups ? ` (${countGroups})` : ""}` },
              { key: "nao_lidos", label: `Não lidos${countUnread ? ` (${countUnread})` : ""}` },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 text-xs font-semibold rounded-lg py-1.5 transition-colors ${
                  filter === f.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
          ) : visibleConvs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              {filter === "nao_lidos"
                ? "Nenhuma conversa não lida."
                : filter === "grupos"
                ? "Nenhum grupo ainda."
                : "Nenhum contato ainda."}
            </p>
          ) : (
            visibleConvs.map((c) => {
              const nome = c.crm_contacts?.nome || "Sem nome";
              const naoLido = c.status === "nao_lido";
              return (
                <button
                  key={c.id}
                  onClick={() => abrir(c)}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 flex gap-3 transition-colors ${
                    selId === c.id ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <Avatar nome={nome} foto={c.crm_contacts?.foto_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm text-foreground truncate ${naoLido ? "font-bold" : "font-semibold"}`}>{nome}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{fmtHora(c.ultima_em || c.atualizado_em)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className={`text-xs truncate ${naoLido ? "text-foreground" : "text-muted-foreground"}`}>{c.ultima_mensagem || "Sem mensagens"}</span>
                      {naoLido && <span className="shrink-0 h-2 w-2 rounded-full bg-primary mt-0.5" />}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* CHAT */}
      <div className="flex-1 min-w-0 flex flex-col bg-muted/20">
        {!sel ? (
          <EmptyState icon={MessageSquare} title="Selecione uma conversa" sub="Escolha um contato à esquerda para ver as mensagens." />
        ) : (
          <>
            <div className="h-14 shrink-0 border-b border-border bg-card/50 px-4 flex items-center gap-3">
              <Avatar nome={sel.crm_contacts?.nome} foto={sel.crm_contacts?.foto_url} />
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{sel.crm_contacts?.nome || "Sem nome"}</p>
                {sel.crm_contacts?.telefone && <p className="text-[11px] text-muted-foreground truncate">{sel.crm_contacts.telefone}</p>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {msgs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground pt-6">Nenhuma mensagem ainda. Envie a primeira 👇</p>
              ) : (
                msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.direcao === "enviada" ? "justify-end" : ""}`}>
                    <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      m.direcao === "enviada"
                        ? "bg-primary text-white rounded-tr-sm"
                        : "bg-card border border-border text-foreground rounded-tl-sm"
                    }`}>
                      <span className="whitespace-pre-wrap break-words">{m.tipo === "texto" ? m.conteudo : `[${m.tipo}]`}</span>
                      <span className={`block text-[9px] mt-0.5 text-right ${m.direcao === "enviada" ? "text-white/70" : "text-muted-foreground"}`}>{fmtHora(m.criado_em)}</span>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            <div className="shrink-0 border-t border-border p-3 flex items-center gap-2 bg-card/40">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
                placeholder="Digite uma mensagem..."
                className="flex-1 h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
              <button
                onClick={() => void enviar()}
                disabled={sending || !draft.trim()}
                className="h-10 w-10 rounded-lg bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* PAINEL DO CONTATO */}
      {sel && (
        <div className="w-64 shrink-0 border-l border-border bg-card/30 p-5 hidden lg:flex flex-col gap-5 overflow-y-auto">
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar nome={sel.crm_contacts?.nome} size="lg" foto={sel.crm_contacts?.foto_url} />
            <p className="font-bold text-foreground">{sel.crm_contacts?.nome || "Sem nome"}</p>
          </div>
          <div className="space-y-3">
            <InfoRow icon={Phone} label="Telefone" value={sel.crm_contacts?.telefone} />
            <InfoRow icon={Mail} label="Email" value={sel.crm_contacts?.email} />
          </div>
          <div className="mt-auto pt-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground">Mais dados do contato e oportunidades vinculadas chegam nas próximas fases.</p>
          </div>
        </div>
      )}
    </>
  );
}

// -------------------------- OPORTUNIDADES (Kanban real) --------------------
function Oportunidades() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [contacts, setContacts] = useState<{ id: string; nome: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [busyPipe, setBusyPipe] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Opp> | null>(null);
  const [saving, setSaving] = useState(false);
  const [manageStages, setManageStages] = useState(false);

  const pipeline = pipelines.find((p) => p.id === pipelineId) || null;
  const clienteId = pipeline?.cliente_id || null;

  const loadPipelines = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("crm_pipelines").select("id,cliente_id,nome").order("criado_em", { ascending: true });
    if (error) { if (isSchemaMissing(error)) setNotReady(true); setLoading(false); return; }
    setPipelines((data as Pipeline[]) || []);
    setPipelineId((prev) => prev || ((data as Pipeline[])?.[0]?.id ?? null));
    setNotReady(false);
    setLoading(false);
  }, []);

  const loadBoard = useCallback(async (pid: string, cid: string) => {
    const [st, op, ct] = await Promise.all([
      (supabase as any).from("crm_pipeline_stages").select("id,nome,ordem,cliente_id,pipeline_id").eq("pipeline_id", pid).order("ordem", { ascending: true }),
      (supabase as any).from("crm_opportunities").select("*,crm_contacts(id,nome)").eq("cliente_id", cid),
      (supabase as any).from("crm_contacts").select("id,nome").eq("cliente_id", cid).order("nome", { ascending: true }),
    ]);
    setStages((st.data as Stage[]) || []);
    setOpps((op.data as Opp[]) || []);
    setContacts((ct.data as { id: string; nome: string | null }[]) || []);
  }, []);

  useEffect(() => { void loadPipelines(); }, [loadPipelines]);
  useEffect(() => { if (pipelineId && clienteId) void loadBoard(pipelineId, clienteId); }, [pipelineId, clienteId, loadBoard]);

  useEffect(() => {
    if (!pipelineId || !clienteId) return;
    const ch = supabase.channel("crm-opps-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_opportunities" }, () => { void loadBoard(pipelineId, clienteId); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [pipelineId, clienteId, loadBoard]);

  const criarFunilPadrao = async () => {
    setBusyPipe(true);
    try {
      const { data: cli } = await (supabase as any).from("crm_clients").select("id").order("criado_em", { ascending: true }).limit(1).maybeSingle();
      if (!cli?.id) { toast.error("Nenhuma loja disponível para criar o funil."); return; }
      const { data: pipe, error } = await (supabase as any).from("crm_pipelines").insert({ cliente_id: cli.id, nome: "Funil de Vendas" }).select("id,cliente_id,nome").single();
      if (error) throw error;
      const { error: sErr } = await (supabase as any).from("crm_pipeline_stages").insert(DEFAULT_STAGES.map((n, i) => ({ cliente_id: cli.id, pipeline_id: pipe.id, nome: n, ordem: i })));
      if (sErr) throw sErr;
      await loadPipelines();
      setPipelineId(pipe.id);
      toast.success("Funil criado!");
    } catch (e: any) { toast.error(e?.message || "Erro ao criar o funil"); }
    finally { setBusyPipe(false); }
  };

  const moveOpp = async (oppId: string, stageId: string) => {
    setOverStage(null);
    const opp = opps.find((o) => o.id === oppId);
    if (!opp || opp.pipeline_stage_id === stageId) return;
    setOpps((prev) => prev.map((o) => (o.id === oppId ? { ...o, pipeline_stage_id: stageId } : o)));
    const { error } = await (supabase as any).from("crm_opportunities").update({ pipeline_stage_id: stageId }).eq("id", oppId);
    if (error) { toast.error("Não foi possível mover: " + (error.message || "")); if (pipelineId && clienteId) void loadBoard(pipelineId, clienteId); }
  };

  const salvarOpp = async () => {
    if (!editing || !clienteId) return;
    if (!editing.contact_id) { toast.error("Escolha um contato."); return; }
    setSaving(true);
    const core = {
      cliente_id: clienteId,
      contact_id: editing.contact_id,
      pipeline_stage_id: editing.pipeline_stage_id ?? stages[0]?.id ?? null,
      valor: editing.valor ?? null,
      status: editing.status || "aberto",
    };
    let oppId = editing.id;
    if (editing.id) {
      const r = await (supabase as any).from("crm_opportunities").update(core).eq("id", editing.id);
      if (r.error) { setSaving(false); toast.error(r.error.message); return; }
    } else {
      const r = await (supabase as any).from("crm_opportunities").insert(core).select("id").single();
      if (r.error) { setSaving(false); toast.error(r.error.message); return; }
      oppId = (r.data as any)?.id;
    }
    // Campos extras (colunas opcionais) — save resiliente: se a migração não rodou, avisa sem quebrar
    if (oppId) {
      const extras = { item_compra: editing.item_compra ?? null, vendedor: editing.vendedor ?? null, observacao: editing.observacao ?? null };
      const r2 = await (supabase as any).from("crm_opportunities").update(extras).eq("id", oppId);
      if (r2.error && /item_compra|vendedor|observacao|column|schema cache|PGRST/i.test(`${r2.error.message} ${r2.error.code}`)) {
        toast("Oportunidade salva. Os campos extras (item/vendedor/obs) precisam da migração — peça ao Lovable.");
      } else if (r2.error) {
        toast.error(r2.error.message);
      }
    }
    setSaving(false);
    setEditing(null);
    if (pipelineId && clienteId) void loadBoard(pipelineId, clienteId);
  };

  const excluirOpp = async () => {
    if (!editing?.id) return;
    const { error } = await (supabase as any).from("crm_opportunities").delete().eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    if (pipelineId && clienteId) void loadBoard(pipelineId, clienteId);
  };

  if (notReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/15 flex items-center justify-center"><Wrench className="h-7 w-7 text-amber-600 dark:text-amber-400" /></div>
        <div>
          <p className="font-semibold text-foreground">CRM ainda não configurado no banco</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">Rode os scripts SQL das Fases 1 e 3 no Supabase para o Kanban funcionar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0">
      <div className="h-14 shrink-0 border-b border-border px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-bold text-foreground shrink-0">Oportunidades</h2>
          {pipelines.length > 0 && (
            <select value={pipelineId || ""} onChange={(e) => setPipelineId(e.target.value)} className="h-8 rounded-lg bg-muted/50 border border-border text-xs text-foreground px-2 outline-none focus:border-primary/50 max-w-[180px]">
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
          {pipeline && (
            <button onClick={() => setManageStages(true)} title="Editar etapas do funil" className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold px-2.5 transition-colors shrink-0">
              <Pencil className="h-3.5 w-3.5" /> Etapas
            </button>
          )}
        </div>
        {pipeline && (
          <button onClick={() => setEditing({ status: "aberto", pipeline_stage_id: stages[0]?.id })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-3 py-1.5 transition-colors shrink-0">
            <Plus className="h-4 w-4" /> Nova oportunidade
          </button>
        )}
      </div>

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
      ) : !pipeline ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center"><Target className="h-7 w-7 text-muted-foreground" /></div>
          <div>
            <p className="font-semibold text-foreground">Nenhum funil ainda</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">Crie um funil padrão (Novo lead → Ganho/Perdido) para começar.</p>
          </div>
          <button onClick={() => void criarFunilPadrao()} disabled={busyPipe} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 transition-colors disabled:opacity-60">
            <Plus className="h-4 w-4" /> {busyPipe ? "Criando..." : "Criar funil padrão"}
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-3 h-full min-w-max">
            {stages.map((stage, idx) => {
              const list = opps.filter((o) => o.pipeline_stage_id === stage.id);
              const soma = list.reduce((s, o) => s + (Number(o.valor) || 0), 0);
              const over = overStage === stage.id;
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
                  onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                  onDrop={() => { if (dragId) void moveOpp(dragId, stage.id); }}
                  className={`w-72 shrink-0 flex flex-col rounded-xl border transition-colors ${over ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}
                >
                  <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${STAGE_DOTS[idx % STAGE_DOTS.length]}`} /> {stage.nome}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-background rounded-full px-1.5 py-0.5">{list.length}</span>
                  </div>
                  {soma > 0 && <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground border-b border-border/50">{formatBRL(soma)}</div>}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
                    {list.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center pt-6">Arraste um card aqui</p>
                    ) : (
                      list.map((o) => (
                        <div
                          key={o.id}
                          draggable
                          onDragStart={() => setDragId(o.id)}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => setEditing({ ...o })}
                          className="rounded-lg border border-border bg-card p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
                        >
                          <p className="font-semibold text-sm text-foreground truncate">{o.crm_contacts?.nome || "Sem contato"}</p>
                          {o.item_compra && <p className="text-xs text-muted-foreground truncate mt-0.5">{o.item_compra}</p>}
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-sm font-bold text-primary">{formatBRL(o.valor)}</span>
                            {o.status !== "aberto" && <StatusBadge status={o.status} />}
                          </div>
                          {o.vendedor && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 truncate"><User className="h-3 w-3 shrink-0" /> {o.vendedor}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && (
        <OppModal editing={editing} setEditing={setEditing} contacts={contacts} stages={stages} onSave={salvarOpp} onDelete={excluirOpp} saving={saving} />
      )}
      {manageStages && pipeline && (
        <StagesModal
          stages={stages}
          opps={opps}
          clienteId={clienteId!}
          pipelineId={pipelineId!}
          onClose={() => setManageStages(false)}
          onChanged={() => { if (pipelineId && clienteId) void loadBoard(pipelineId, clienteId); }}
        />
      )}
    </div>
  );
}

function OppModal({
  editing, setEditing, contacts, stages, onSave, onDelete, saving,
}: {
  editing: Partial<Opp>;
  setEditing: (v: Partial<Opp> | null) => void;
  contacts: { id: string; nome: string | null }[];
  stages: Stage[];
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
      <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">{editing.id ? "Editar oportunidade" : "Nova oportunidade"}</h3>
          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Contato</label>
            <select value={editing.contact_id || ""} onChange={(e) => setEditing({ ...editing, contact_id: e.target.value })} className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-2 outline-none focus:border-primary/50">
              <option value="">Selecione...</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.nome || "Sem nome"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Item de compra</label>
            <input value={editing.item_compra ?? ""} onChange={(e) => setEditing({ ...editing, item_compra: e.target.value })} placeholder="ex: Honda CG 160 Start" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Valor (R$)</label>
              <input type="number" min="0" step="100" value={editing.valor ?? ""} onChange={(e) => setEditing({ ...editing, valor: e.target.value === "" ? null : Number(e.target.value) })} placeholder="0" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Vendedor</label>
              <input value={editing.vendedor ?? ""} onChange={(e) => setEditing({ ...editing, vendedor: e.target.value })} placeholder="ex: Pedro" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Etapa</label>
              <select value={editing.pipeline_stage_id || ""} onChange={(e) => setEditing({ ...editing, pipeline_stage_id: e.target.value })} className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-2 outline-none focus:border-primary/50">
                {stages.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <select value={editing.status || "aberto"} onChange={(e) => setEditing({ ...editing, status: e.target.value as Opp["status"] })} className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-2 outline-none focus:border-primary/50">
                <option value="aberto">Aberto</option>
                <option value="ganho">Ganho</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Observação</label>
            <textarea rows={2} value={editing.observacao ?? ""} onChange={(e) => setEditing({ ...editing, observacao: e.target.value })} placeholder="Detalhes, próximos passos..." className="mt-1 w-full rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 py-2 outline-none focus:border-primary/50 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          {editing.id ? (
            <button onClick={() => onDelete()} className="text-sm font-semibold text-rose-600 dark:text-rose-400 hover:underline">Excluir</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-2">Cancelar</button>
            <button onClick={() => onSave()} disabled={saving} className="text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StagesModal({
  stages, opps, clienteId, pipelineId, onClose, onChanged,
}: {
  stages: Stage[];
  opps: Opp[];
  clienteId: string;
  pipelineId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [novo, setNovo] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const nome = novo.trim();
    if (!nome) return;
    setBusy(true);
    const maxOrdem = stages.reduce((m, s) => Math.max(m, s.ordem), -1);
    const { error } = await (supabase as any).from("crm_pipeline_stages").insert({ cliente_id: clienteId, pipeline_id: pipelineId, nome, ordem: maxOrdem + 1 });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNovo("");
    onChanged();
  };
  const rename = async (id: string, nome: string) => {
    const n = nome.trim();
    const cur = stages.find((s) => s.id === id);
    if (!n || (cur && cur.nome === n)) return;
    const { error } = await (supabase as any).from("crm_pipeline_stages").update({ nome: n }).eq("id", id);
    if (error) toast.error(error.message); else onChanged();
  };
  const move = async (idx: number, dir: -1 | 1) => {
    const a = stages[idx], b = stages[idx + dir];
    if (!a || !b) return;
    await (supabase as any).from("crm_pipeline_stages").update({ ordem: b.ordem }).eq("id", a.id);
    await (supabase as any).from("crm_pipeline_stages").update({ ordem: a.ordem }).eq("id", b.id);
    onChanged();
  };
  const del = async (id: string) => {
    if (opps.filter((o) => o.pipeline_stage_id === id).length > 0) {
      toast.error("Mova as oportunidades desta etapa antes de excluir.");
      return;
    }
    const { error } = await (supabase as any).from("crm_pipeline_stages").delete().eq("id", id);
    if (error) toast.error(error.message); else onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">Etapas do funil</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {stages.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa ainda. Adicione a primeira abaixo.</p>}
          {stages.map((s, i) => {
            const count = opps.filter((o) => o.pipeline_stage_id === s.id).length;
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <input defaultValue={s.nome} onBlur={(e) => void rename(s.id, e.target.value)} className="flex-1 h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
                <span className="text-[10px] text-muted-foreground w-6 text-center shrink-0" title="oportunidades nesta etapa">{count}</span>
                <button onClick={() => void move(i, -1)} disabled={i === 0} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => void move(i, 1)} disabled={i === stages.length - 1} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                <button onClick={() => void del(s.id)} title="Excluir etapa" className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <input value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} placeholder="Nova etapa..." className="flex-1 h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
          <button onClick={() => void add()} disabled={busy || !novo.trim()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-3 py-2 disabled:opacity-60 shrink-0">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-2">Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- CONTATOS (real) -----------------------------
function NotConfigured({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
      <div className="h-14 w-14 rounded-2xl bg-amber-500/15 flex items-center justify-center"><Wrench className="h-7 w-7 text-amber-600 dark:text-amber-400" /></div>
      <div>
        <p className="font-semibold text-foreground">CRM ainda não configurado no banco</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{children}</p>
      </div>
    </div>
  );
}

function Contatos() {
  const [contatos, setContatos] = useState<ContatoFull[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [editing, setEditing] = useState<Partial<ContatoFull> | null>(null);
  const [saving, setSaving] = useState(false);
  const [hist, setHist] = useState<{ convs: { id: string; ultima_mensagem: string | null; status: string }[]; opps: { id: string; valor: number | null; status: string; item_compra?: string | null }[] }>({ convs: [], opps: [] });

  const sel = contatos.find((c) => c.id === selId) || null;

  const loadContatos = useCallback(async () => {
    const [ct, cl] = await Promise.all([
      (supabase as any).from("crm_contacts").select("id,cliente_id,nome,telefone,email,criado_em").order("nome", { ascending: true }),
      (supabase as any).from("crm_clients").select("id,nome").order("nome", { ascending: true }),
    ]);
    if (ct.error) { if (isSchemaMissing(ct.error)) setNotReady(true); setLoading(false); return; }
    setContatos((ct.data as ContatoFull[]) || []);
    setClientes((cl.data as ClienteRow[]) || []);
    setNotReady(false);
    setLoading(false);
  }, []);

  const loadHist = useCallback(async (contactId: string) => {
    const [cv, op] = await Promise.all([
      (supabase as any).from("crm_conversations").select("id,ultima_mensagem,status").eq("contact_id", contactId).order("atualizado_em", { ascending: false }),
      (supabase as any).from("crm_opportunities").select("id,valor,status,item_compra").eq("contact_id", contactId),
    ]);
    setHist({ convs: (cv.data as any[]) || [], opps: (op.data as any[]) || [] });
  }, []);

  useEffect(() => { void loadContatos(); }, [loadContatos]);
  useEffect(() => { if (selId) void loadHist(selId); else setHist({ convs: [], opps: [] }); }, [selId, loadHist]);

  const salvar = async () => {
    if (!editing) return;
    if (!editing.nome?.trim() && !editing.telefone?.trim()) { toast.error("Preencha ao menos o nome ou o telefone."); return; }
    const clienteId = editing.cliente_id || clientes[0]?.id;
    if (!clienteId) { toast.error("Nenhuma loja disponível para vincular o contato."); return; }
    setSaving(true);
    const payload = {
      cliente_id: clienteId,
      nome: editing.nome?.trim() || null,
      telefone: editing.telefone?.trim() || null,
      email: editing.email?.trim() || null,
    };
    const res = editing.id
      ? await (supabase as any).from("crm_contacts").update(payload).eq("id", editing.id)
      : await (supabase as any).from("crm_contacts").insert(payload).select("id").single();
    setSaving(false);
    if (res.error) {
      if (res.error.code === "23505" || /duplicate|unique/i.test(res.error.message || "")) toast.error("Já existe um contato com esse telefone nesta loja.");
      else toast.error(res.error.message);
      return;
    }
    const newId = editing.id || (res.data as any)?.id;
    setEditing(null);
    await loadContatos();
    if (newId) setSelId(newId);
  };

  const excluir = async (id: string) => {
    const { error } = await (supabase as any).from("crm_contacts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    if (selId === id) setSelId(null);
    void loadContatos();
  };

  if (notReady) return <NotConfigured>Rode os scripts SQL das Fases 1 e 3 no Supabase para os contatos aparecerem aqui.</NotConfigured>;

  const visiveis = contatos.filter((c) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (c.nome || "").toLowerCase().includes(q) || (c.telefone || "").toLowerCase().includes(q);
  });

  return (
    <>
      {/* LISTA */}
      <div className="w-72 sm:w-80 shrink-0 border-r border-border flex flex-col min-h-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-foreground">Contatos</h2>
            <button onClick={() => setEditing({})} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-2.5 py-1.5"><Plus className="h-3.5 w-3.5" /> Novo</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone..." className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
            : visiveis.length === 0 ? <p className="p-6 text-sm text-muted-foreground text-center">Nenhum contato encontrado.</p>
            : visiveis.map((c) => (
              <button key={c.id} onClick={() => setSelId(c.id)} className={`w-full text-left px-3 py-3 border-b border-border/50 flex gap-3 transition-colors ${selId === c.id ? "bg-primary/10" : "hover:bg-muted/50"}`}>
                <Avatar nome={c.nome} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-foreground truncate">{c.nome || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.telefone || "sem telefone"}</p>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* DETALHE + HISTÓRICO */}
      <div className="flex-1 min-w-0 flex flex-col bg-muted/20 overflow-y-auto">
        {!sel ? (
          <EmptyState icon={Users} title="Selecione um contato" sub="Veja os dados e o histórico de conversas e oportunidades num só lugar." />
        ) : (
          <div className="p-5 space-y-5 w-full max-w-xl">
            <div className="flex items-center gap-3">
              <Avatar nome={sel.nome} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg text-foreground truncate">{sel.nome || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">Criado em {new Date(sel.criado_em).toLocaleDateString("pt-BR")}</p>
              </div>
              <button onClick={() => setEditing({ ...sel })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/15 transition-colors"><Pencil className="h-3.5 w-3.5" /> Editar</button>
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
              <InfoRow icon={Phone} label="Telefone" value={sel.telefone} />
              <InfoRow icon={Mail} label="Email" value={sel.email} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Conversas ({hist.convs.length})</p>
              {hist.convs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conversa vinculada.</p> : (
                <div className="space-y-1.5">
                  {hist.convs.map((cv) => (
                    <div key={cv.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm">
                      <span className="flex-1 min-w-0 truncate text-foreground">{cv.ultima_mensagem || "Sem mensagens"}</span>
                      {cv.status === "nao_lido" && <span className="shrink-0 h-2 w-2 rounded-full bg-primary" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Oportunidades ({hist.opps.length})</p>
              {hist.opps.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma oportunidade vinculada.</p> : (
                <div className="space-y-1.5">
                  {hist.opps.map((op) => (
                    <div key={op.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm">
                      <span className="flex-1 min-w-0 truncate text-foreground">{op.item_compra || "Oportunidade"}</span>
                      <span className="shrink-0 font-bold text-primary">{formatBRL(op.valor)}</span>
                      {op.status !== "aberto" && <StatusBadge status={op.status as Opp["status"]} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {editing && <ContatoModal editing={editing} setEditing={setEditing} clientes={clientes} onSave={salvar} onDelete={excluir} saving={saving} />}
    </>
  );
}

function ContatoModal({
  editing, setEditing, clientes, onSave, onDelete, saving,
}: {
  editing: Partial<ContatoFull>;
  setEditing: (v: Partial<ContatoFull> | null) => void;
  clientes: ClienteRow[];
  onSave: () => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const isNew = !editing.id;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
      <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">{isNew ? "Novo contato" : "Editar contato"}</h3>
          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          {isNew && clientes.length > 1 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Loja</label>
              <select value={editing.cliente_id || clientes[0]?.id || ""} onChange={(e) => setEditing({ ...editing, cliente_id: e.target.value })} className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-2 outline-none focus:border-primary/50">
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome || "Loja"}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Nome</label>
            <input value={editing.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} placeholder="Nome do contato" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Telefone</label>
            <input value={editing.telefone ?? ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} placeholder="+55 92 99999-0000" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Email</label>
            <input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="email@exemplo.com" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          {editing.id ? <button onClick={() => onDelete(editing.id!)} className="text-sm font-semibold text-rose-600 dark:text-rose-400 hover:underline">Excluir</button> : <span />}
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-2">Cancelar</button>
            <button onClick={() => onSave()} disabled={saving} className="text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------- CONFIGURAÇÕES (real) --------------------------
const PAPEL_LABEL: Record<string, string> = { admin: "Admin", gestor: "Gestor", atendente: "Atendente" };
type ConfTab = { key: "perfil" | "usuarios" | "conexoes" | "fases"; label: string; icon: typeof User };

function Config() {
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState<ConfTab["key"]>("perfil");
  const tabs: ConfTab[] = [
    { key: "perfil", label: "Perfil", icon: User },
    ...(isAdmin ? [{ key: "usuarios", label: "Usuários", icon: Users } as ConfTab] : []),
    { key: "conexoes", label: "Conexões", icon: Link2 },
    ...(isAdmin ? [{ key: "fases", label: "Fases do funil", icon: Target } as ConfTab] : []),
  ];
  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0">
      <SectionHeader title="Configurações" />
      <div className="flex-1 flex min-h-0">
        <nav className="w-40 sm:w-48 shrink-0 border-r border-border p-2 space-y-1 overflow-y-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <t.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0 overflow-y-auto p-5">
          {tab === "perfil" && <PerfilCard user={user} isAdmin={isAdmin} />}
          {tab === "usuarios" && isAdmin && <UsuariosSection />}
          {tab === "conexoes" && <ConexoesCard />}
          {tab === "fases" && isAdmin && <FasesSection />}
        </div>
      </div>
    </div>
  );
}

function PerfilCard({ user, isAdmin }: { user: any; isAdmin: boolean }) {
  const [me, setMe] = useState<CrmUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await (supabase as any).from("crm_users").select("id,auth_user_id,nome,email,cliente_id,papel").eq("auth_user_id", user.id).maybeSingle();
      setMe((data as CrmUser) || null);
      setLoaded(true);
    })();
  }, [user?.id]);
  const nome = me?.nome || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <Avatar nome={nome} size="lg" />
        <div className="min-w-0">
          <p className="font-bold text-lg text-foreground truncate">{nome}</p>
          <p className="text-sm text-muted-foreground truncate">{me?.email || user?.email}</p>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
        <InfoRow icon={Mail} label="Email" value={me?.email || user?.email} />
        <InfoRow icon={Shield} label="Papel no CRM" value={me ? PAPEL_LABEL[me.papel] : (isAdmin ? "Admin (do app)" : "—")} />
      </div>
      {loaded && !me && (
        <p className="text-xs text-muted-foreground">Você não tem cadastro em <code>crm_users</code>. Como admin do app, já enxerga tudo pela RLS.</p>
      )}
    </div>
  );
}

function UsuariosSection() {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState<Partial<CrmUser> | null>(null);
  const load = useCallback(async () => {
    const [u, c] = await Promise.all([
      (supabase as any).from("crm_users").select("id,auth_user_id,nome,email,cliente_id,papel").order("nome", { ascending: true }),
      (supabase as any).from("crm_clients").select("id,nome").order("nome", { ascending: true }),
    ]);
    setUsers((u.data as CrmUser[]) || []);
    setClientes((c.data as ClienteRow[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const changePapel = async (id: string, papel: string) => {
    const { error } = await (supabase as any).from("crm_users").update({ papel }).eq("id", id);
    if (error) toast.error(error.message); else void load();
  };
  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("crm_users").delete().eq("id", id);
    if (error) toast.error(error.message); else void load();
  };
  const salvarNovo = async () => {
    if (!novo) return;
    if (!novo.nome?.trim() && !novo.email?.trim()) { toast.error("Preencha nome ou email."); return; }
    const cliente_id = novo.cliente_id || clientes[0]?.id;
    if (!cliente_id) { toast.error("Nenhuma loja disponível."); return; }
    const { error } = await (supabase as any).from("crm_users").insert({
      nome: novo.nome?.trim() || null,
      email: novo.email?.trim() || null,
      cliente_id,
      papel: novo.papel || "atendente",
    });
    if (error) toast.error(error.message); else { setNovo(null); void load(); }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">Usuários do CRM</p>
          <p className="text-xs text-muted-foreground">Quem tem acesso. O convite por email vem depois — por ora, cria o cadastro (ele se vincula ao login na 1ª vez que a pessoa entrar).</p>
        </div>
        <button onClick={() => setNovo({ papel: "atendente" })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-3 py-1.5 shrink-0"><UserPlus className="h-4 w-4" /> Novo usuário</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
        <div className="rounded-xl border border-border overflow-hidden">
          {users.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhum usuário cadastrado.</p> : users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
              <Avatar nome={u.nome || u.email} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{u.nome || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email || "—"}{!u.auth_user_id && " · não vinculado"}</p>
              </div>
              <select value={u.papel} onChange={(e) => changePapel(u.id, e.target.value)} className="h-8 rounded-lg bg-muted/50 border border-border text-xs text-foreground px-2 outline-none focus:border-primary/50 shrink-0">
                <option value="admin">Admin</option>
                <option value="gestor">Gestor</option>
                <option value="atendente">Atendente</option>
              </select>
              <button onClick={() => void remove(u.id)} title="Remover" className="h-8 w-8 rounded-lg flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      {novo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setNovo(null)}>
          <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Novo usuário</h3>
              <button onClick={() => setNovo(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-muted-foreground">Nome</label><input value={novo.nome ?? ""} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Email</label><input value={novo.email ?? ""} onChange={(e) => setNovo({ ...novo, email: e.target.value })} placeholder="email@exemplo.com" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" /></div>
              <div className="grid grid-cols-2 gap-3">
                {clientes.length > 1 && (
                  <div><label className="text-xs font-semibold text-muted-foreground">Loja</label>
                    <select value={novo.cliente_id || clientes[0]?.id || ""} onChange={(e) => setNovo({ ...novo, cliente_id: e.target.value })} className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-2 outline-none focus:border-primary/50">
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome || "Loja"}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="text-xs font-semibold text-muted-foreground">Papel</label>
                  <select value={novo.papel || "atendente"} onChange={(e) => setNovo({ ...novo, papel: e.target.value as CrmUser["papel"] })} className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-2 outline-none focus:border-primary/50">
                    <option value="admin">Admin</option>
                    <option value="gestor">Gestor</option>
                    <option value="atendente">Atendente</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setNovo(null)} className="text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-2">Cancelar</button>
              <button onClick={() => void salvarNovo()} className="text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-4 py-2">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConexoesCard() {
  return (
    <div className="max-w-lg space-y-4">
      {/* API NÃO OFICIAL (Evolution) — recomendada para testes */}
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"><MessageSquare className="h-5 w-5" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground">WhatsApp — API não oficial</p>
                <span className="text-[10px] font-semibold rounded-full bg-primary/15 text-primary px-2 py-0.5">Recomendado p/ testes</span>
              </div>
              <p className="text-xs text-muted-foreground">Conecta lendo o QR Code do WhatsApp (Evolution API). Sem aprovação da Meta.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 shrink-0"><span className="h-2 w-2 rounded-full bg-rose-500" /> Desconectado</span>
        </div>
        <div className="mt-4 space-y-2 opacity-70 pointer-events-none select-none">
          <input disabled placeholder="URL da Evolution API (ex: https://evo.seudominio.com)" className="w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground px-3" />
          <input disabled placeholder="API Key da Evolution" className="w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground px-3" />
          <input disabled placeholder="Nome da instância (ex: kp-teste)" className="w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground px-3" />
          <button disabled className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"><QrCode className="h-4 w-4" /> Gerar QR Code</button>
        </div>
      </div>

      {/* API OFICIAL — fica para produção/futuro */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0"><MessageSquare className="h-5 w-5" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground">WhatsApp — API oficial</p>
                <span className="text-[10px] font-semibold rounded-full bg-muted text-muted-foreground px-2 py-0.5">Produção / futuro</span>
              </div>
              <p className="text-xs text-muted-foreground">Requer aprovação da Meta e templates. Entra depois dos testes.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 shrink-0"><span className="h-2 w-2 rounded-full bg-rose-500" /> Desconectado</span>
        </div>
        <div className="mt-4 space-y-2 opacity-60 pointer-events-none select-none">
          <input disabled placeholder="Número do WhatsApp (ex: +55 92 ...)" className="w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground px-3" />
          <input disabled placeholder="Token / credencial da API" className="w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground px-3" />
          <button disabled className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Conectar</button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Os campos ainda são visuais. A conexão ao vivo (QR Code + receber/enviar mensagens) entra quando ligarmos o webhook da Evolution — é o próximo passo.</p>
    </div>
  );
}

function FasesSection() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [open, setOpen] = useState(false);
  const pipeline = pipelines.find((p) => p.id === pipelineId) || null;
  const clienteId = pipeline?.cliente_id || null;

  const loadPipes = useCallback(async () => {
    const { data } = await (supabase as any).from("crm_pipelines").select("id,cliente_id,nome").order("criado_em", { ascending: true });
    setPipelines((data as Pipeline[]) || []);
    setPipelineId((prev) => prev || ((data as Pipeline[])?.[0]?.id ?? null));
  }, []);
  const loadStages = useCallback(async (pid: string, cid: string) => {
    const [st, op] = await Promise.all([
      (supabase as any).from("crm_pipeline_stages").select("id,nome,ordem,cliente_id,pipeline_id").eq("pipeline_id", pid).order("ordem", { ascending: true }),
      (supabase as any).from("crm_opportunities").select("id,pipeline_stage_id").eq("cliente_id", cid),
    ]);
    setStages((st.data as Stage[]) || []);
    setOpps((op.data as Opp[]) || []);
  }, []);
  useEffect(() => { void loadPipes(); }, [loadPipes]);
  useEffect(() => { if (pipelineId && clienteId) void loadStages(pipelineId, clienteId); }, [pipelineId, clienteId, loadStages]);

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <p className="font-bold text-foreground">Fases do funil</p>
        <p className="text-xs text-muted-foreground">Cada loja pode ter etapas diferentes. Edite aqui, sem SQL.</p>
      </div>
      {pipelines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum funil ainda. Crie um na aba Oportunidades.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <select value={pipelineId || ""} onChange={(e) => setPipelineId(e.target.value)} className="h-9 flex-1 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-2 outline-none focus:border-primary/50">
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/15 shrink-0"><Pencil className="h-3.5 w-3.5" /> Editar etapas</button>
          </div>
          <div className="rounded-xl border border-border divide-y divide-border/50">
            {stages.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma etapa.</p> : stages.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className={`h-2 w-2 rounded-full ${STAGE_DOTS[i % STAGE_DOTS.length]}`} />
                <span className="flex-1 text-foreground">{s.nome}</span>
                <span className="text-xs text-muted-foreground">{opps.filter((o) => o.pipeline_stage_id === s.id).length}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {open && pipeline && (
        <StagesModal stages={stages} opps={opps} clienteId={clienteId!} pipelineId={pipelineId!} onClose={() => setOpen(false)} onChanged={() => { if (pipelineId && clienteId) void loadStages(pipelineId, clienteId); }} />
      )}
    </div>
  );
}

// ------------------------------- SHELL -------------------------------------
export default function Crm() {
  const [section, setSection] = useState<Section>("conversas");
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <header className="h-14 shrink-0 border-b border-border bg-card/50 backdrop-blur px-3 sm:px-4 flex items-center gap-3">
        <Link to="/" className="p-2 -ml-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Voltar ao início">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
          <MessageSquare className="h-4 w-4 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-foreground">CRM</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/40 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Wrench className="h-3 w-3" /> Em construção
          </span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <nav className="w-[72px] shrink-0 border-r border-border bg-card/30 p-2 flex flex-col gap-1">
          {NAV.map((item) => {
            const activeItem = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`w-full flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-colors ${
                  activeItem ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none text-center">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0 flex">
          {section === "conversas" && <Conversas />}
          {section === "oportunidades" && <Oportunidades />}
          {section === "contatos" && <Contatos />}
          {section === "config" && <Config />}
        </div>
      </div>
    </div>
  );
}
