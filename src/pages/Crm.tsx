import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, MessageSquare, Target, Users, Settings, Wrench,
  Search, Plus, Send, User, Link2, Phone, Mail,
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

const KANBAN = [
  { nome: "Novo lead", dot: "bg-blue-500" },
  { nome: "Em atendimento", dot: "bg-amber-500" },
  { nome: "Proposta enviada", dot: "bg-violet-500" },
  { nome: "Ganho", dot: "bg-emerald-500" },
  { nome: "Perdido", dot: "bg-rose-500" },
];

// ---------------------------------------------------------------------------
// Tipos das linhas do CRM
// ---------------------------------------------------------------------------
type Contato = { id: string; nome: string | null; telefone: string | null; email: string | null };
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
};

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

function EmBreveBtn({ children }: { children: ReactNode }) {
  return (
    <button
      disabled
      title="Em construção"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 opacity-70 cursor-not-allowed"
    >
      {children}
    </button>
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

function Avatar({ nome, size = "md" }: { nome: string | null | undefined; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-16 w-16 text-xl" : "h-10 w-10 text-sm";
  return (
    <div className={`${cls} shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold`}>
      {(nome || "?").charAt(0).toUpperCase()}
    </div>
  );
}

// ---------------------------- CONVERSAS (real) -----------------------------
function Conversas() {
  const [filter, setFilter] = useState<"todos" | "nao_lidos">("todos");
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
      .select("id,cliente_id,contact_id,status,atualizado_em,ultima_mensagem,ultima_em,crm_contacts(id,nome,telefone,email)")
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
    .filter((c) => (filter === "nao_lidos" ? c.status === "nao_lido" : true))
    .filter((c) => !busca.trim() || (c.crm_contacts?.nome || "").toLowerCase().includes(busca.trim().toLowerCase()));

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
            {(["todos", "nao_lidos"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-xs font-semibold rounded-lg py-1.5 transition-colors ${
                  filter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {f === "todos" ? "Todos" : "Não lidos"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
          ) : visibleConvs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              {filter === "nao_lidos" ? "Nenhuma conversa não lida." : "Nenhuma conversa ainda."}
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
                  <Avatar nome={nome} />
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
              <Avatar nome={sel.crm_contacts?.nome} />
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
            <Avatar nome={sel.crm_contacts?.nome} size="lg" />
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

// -------------------------- OPORTUNIDADES (casca) --------------------------
function Oportunidades() {
  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0">
      <SectionHeader title="Oportunidades" action={<EmBreveBtn><Plus className="h-4 w-4" /> Nova oportunidade</EmBreveBtn>} />
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-3 h-full min-w-max">
          {KANBAN.map((col) => (
            <div key={col.nome} className="w-64 shrink-0 flex flex-col rounded-xl bg-muted/30 border border-border">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} /> {col.nome}
                </span>
                <span className="text-[10px] text-muted-foreground bg-background rounded-full px-1.5 py-0.5">0</span>
              </div>
              <div className="flex-1 p-2 flex items-center justify-center min-h-[120px]">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">Sem oportunidades<br />nesta fase</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------- CONTATOS (casca) ----------------------------
function Contatos() {
  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0">
      <SectionHeader title="Contatos" action={<EmBreveBtn><Plus className="h-4 w-4" /> Novo contato</EmBreveBtn>} />
      <div className="grid grid-cols-[1.5fr_1fr_1.5fr_1fr] gap-0 border-b border-border bg-card/50 text-muted-foreground text-xs font-semibold">
        <div className="px-4 py-2.5">Nome</div>
        <div className="px-4 py-2.5">Telefone</div>
        <div className="px-4 py-2.5">Email</div>
        <div className="px-4 py-2.5">Criado em</div>
      </div>
      <EmptyState icon={Users} title="Nenhum contato ainda" sub="Os contatos vão aparecer aqui numa próxima fase." />
    </div>
  );
}

// --------------------------- CONFIGURAÇÕES (casca) -------------------------
function Config() {
  const items = [
    { icon: User, title: "Perfil", sub: "Seus dados e preferências" },
    { icon: Link2, title: "Conexões", sub: "WhatsApp, Instagram e integrações" },
  ];
  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0">
      <SectionHeader title="Configurações" />
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl space-y-2">
          {items.map((it) => (
            <button
              key={it.title}
              disabled
              className="w-full flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 text-left opacity-80 cursor-not-allowed"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <it.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{it.title}</p>
                <p className="text-xs text-muted-foreground">{it.sub}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">Em breve</span>
            </button>
          ))}
        </div>
      </div>
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
