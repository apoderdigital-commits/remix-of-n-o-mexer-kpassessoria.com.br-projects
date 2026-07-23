import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, MessageSquare, Target, Users, Settings, Wrench,
  Search, Plus, Send, User, Link2,
} from "lucide-react";

// ============================================================================
// CRM · Fase 2 — Casca de navegação (só estrutura visual, sem dados reais).
// Layout estilo GHL: rail à esquerda + coluna(s) de conteúdo que trocam
// conforme a seção. Tudo em tokens de tema (bg-background/card/muted,
// text-foreground/muted-foreground, border-border) + acento sky do CRM,
// funcionando em light e dark.
// ============================================================================

type Section = "conversas" | "oportunidades" | "contatos" | "config";

const NAV: { key: Section; label: string; icon: typeof MessageSquare }[] = [
  { key: "conversas", label: "Conversas", icon: MessageSquare },
  { key: "oportunidades", label: "Oportun.", icon: Target },
  { key: "contatos", label: "Contatos", icon: Users },
  { key: "config", label: "Config", icon: Settings },
];

// ---- dados mockados só para validar a casca (Fase 2) ----
const MOCK_CONVERSAS = [
  { id: 1, nome: "João da Moto", preview: "Boa tarde, ainda tem a CG 160?", hora: "14:32", unread: 2 },
  { id: 2, nome: "Maria Fernandes", preview: "Fechado, passo aí amanhã!", hora: "12:10", unread: 0 },
  { id: 3, nome: "Pedro Consórcio", preview: "Qual o valor da parcela?", hora: "ontem", unread: 0 },
  { id: 4, nome: "Lucas Test Ride", preview: "🎤 Áudio", hora: "seg", unread: 0 },
];

const KANBAN = [
  { nome: "Novo lead", dot: "bg-sky-500" },
  { nome: "Em atendimento", dot: "bg-amber-500" },
  { nome: "Proposta enviada", dot: "bg-violet-500" },
  { nome: "Ganho", dot: "bg-emerald-500" },
  { nome: "Perdido", dot: "bg-rose-500" },
];

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
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded-lg px-3 py-1.5 opacity-70 cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// ---------------------------- CONVERSAS ------------------------------------
function Conversas() {
  const [sel, setSel] = useState<number | null>(null);
  const active = MOCK_CONVERSAS.find((c) => c.id === sel) || null;
  return (
    <>
      {/* lista */}
      <div className="w-72 sm:w-80 shrink-0 border-r border-border flex flex-col min-h-0">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Buscar conversa..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-sky-500/50"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {MOCK_CONVERSAS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSel(c.id)}
              className={`w-full text-left px-3 py-3 border-b border-border/50 flex gap-3 transition-colors ${
                sel === c.id ? "bg-sky-500/10" : "hover:bg-muted/50"
              }`}
            >
              <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                {c.nome.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-foreground truncate">{c.nome}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{c.hora}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">{c.preview}</span>
                  {c.unread > 0 && (
                    <span className="shrink-0 h-4 min-w-[16px] px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {/* chat (placeholder) */}
      <div className="flex-1 min-w-0 flex flex-col bg-muted/20">
        {!active ? (
          <EmptyState icon={MessageSquare} title="Selecione uma conversa" sub="Escolha um contato à esquerda para ver as mensagens." />
        ) : (
          <>
            <div className="h-14 shrink-0 border-b border-border bg-card/50 px-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                {active.nome.charAt(0)}
              </div>
              <span className="font-semibold text-sm text-foreground">{active.nome}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex">
                <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-card border border-border px-3 py-2 text-sm text-foreground shadow-sm">
                  {active.preview}
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-sky-500 text-white px-3 py-2 text-sm shadow-sm">
                  Opa! Deixa eu verificar aqui pra você 👍
                </div>
              </div>
              <p className="text-center text-[11px] text-muted-foreground pt-4">
                Área de chat — placeholder da Fase 2 (sem dados reais ainda)
              </p>
            </div>
            <div className="shrink-0 border-t border-border p-3 flex items-center gap-2 bg-card/40">
              <input
                disabled
                placeholder="Digite uma mensagem... (em breve)"
                className="flex-1 h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              />
              <button disabled className="h-10 w-10 rounded-lg bg-sky-500/60 text-white flex items-center justify-center cursor-not-allowed">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// -------------------------- OPORTUNIDADES ----------------------------------
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
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Sem oportunidades<br />nesta fase
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------- CONTATOS ------------------------------------
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
      <EmptyState icon={Users} title="Nenhum contato ainda" sub="Os contatos vão aparecer aqui quando o CRM for conectado." />
    </div>
  );
}

// --------------------------- CONFIGURAÇÕES ---------------------------------
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
              <div className="h-9 w-9 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
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
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-border bg-card/50 backdrop-blur px-3 sm:px-4 flex items-center gap-3">
        <Link to="/" className="p-2 -ml-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Voltar ao início">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow">
          <MessageSquare className="h-4 w-4 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-foreground">CRM</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/40 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
            <Wrench className="h-3 w-3" /> Em construção
          </span>
        </div>
      </header>

      {/* Body: rail + conteúdo */}
      <div className="flex-1 flex min-h-0">
        <nav className="w-[72px] shrink-0 border-r border-border bg-card/30 p-2 flex flex-col gap-1">
          {NAV.map((item) => {
            const activeItem = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`w-full flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-colors ${
                  activeItem
                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
