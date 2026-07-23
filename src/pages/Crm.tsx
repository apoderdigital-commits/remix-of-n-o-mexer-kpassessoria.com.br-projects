import { useState, useEffect, useRef, useCallback, createContext, useContext, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import notificationSound from "@/assets/notification.mp3.asset.json";
import {
  ArrowLeft, MessageSquare, Target, Users, Settings, Wrench,
  Search, Plus, Send, User, Link2, Phone, Mail, X,
  Pencil, ChevronUp, ChevronDown, Trash2, UserPlus, Shield, QrCode,
  Mic, Square as StopIcon, Paperclip,
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

// ── Permissões granulares (tipo 'usuario'). admin da subconta e agência têm tudo ──
const PERMISSOES: { key: string; label: string }[] = [
  { key: "ver_conversas", label: "Ver conversas" },
  { key: "responder", label: "Responder mensagens" },
  { key: "add_contato", label: "Adicionar contato" },
  { key: "editar_contato", label: "Editar contato" },
  { key: "excluir_contato", label: "Excluir contato" },
  { key: "ver_oportunidades", label: "Ver oportunidades" },
  { key: "gerir_oportunidades", label: "Gerir oportunidades" },
  { key: "ver_config", label: "Ver configurações" },
];

// ── Multi-conta: subconta ativa + papel/permissões do usuário logado ──
type CrmScopeT = { subcontaId: string; isAgencia: boolean; subcontaNome: string; papel: string; can: (k: string) => boolean };
const CrmScope = createContext<CrmScopeT>({ subcontaId: "", isAgencia: false, subcontaNome: "", papel: "usuario", can: () => false });
const useScope = () => useContext(CrmScope);

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
  remetente_foto?: string | null;
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
type CrmUser = { id: string; auth_user_id: string | null; nome: string | null; email: string | null; cliente_id: string; papel: "admin" | "usuario"; permissoes?: Record<string, boolean> };
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

function Avatar({ nome, size = "md", foto, isGroup }: { nome: string | null | undefined; size?: "md" | "lg" | "sm"; foto?: string | null; isGroup?: boolean }) {
  const cls = size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-6 w-6 text-[10px]" : "h-10 w-10 text-sm";
  const iconCls = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-3 w-3" : "h-5 w-5";
  // Em grupo, não usamos foto individual do remetente como avatar do chat.
  if (isGroup) {
    return (
      <div className={`${cls} shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white`}>
        {foto ? (
          <img src={foto} alt={nome || "grupo"} className={`${cls} rounded-full object-cover`} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <Users className={iconCls} />
        )}
      </div>
    );
  }
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
  const { subcontaId, can } = useScope();
  const [filter, setFilter] = useState<"contatos" | "grupos" | "nao_lidos">("contatos");
  const [busca, setBusca] = useState("");
  const [convs, setConvs] = useState<Conversa[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selIdRef = useRef<string | null>(null);
  selIdRef.current = selId;
  const convsRef = useRef<Conversa[]>([]);
  convsRef.current = convs;
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);
  if (typeof window !== "undefined" && !notifAudioRef.current) {
    const a = new Audio(notificationSound.url);
    a.volume = 0.2;
    a.preload = "auto";
    notifAudioRef.current = a;
  }
  const notifBootRef = useRef<number>(Date.now());

  const sel = convs.find((c) => c.id === selId) || null;

  const loadConversas = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("crm_conversations")
      .select("id,cliente_id,contact_id,status,atualizado_em,ultima_mensagem,ultima_em,crm_contacts(id,nome,telefone,email,foto_url,is_group)")
      .eq("cliente_id", subcontaId)
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
        const row = payload?.new || payload?.old || {};
        const cid = row.conversation_id;
        // toque de notificação: apenas INSERT recebido, de contato individual (não grupo),
        // e ignora a "salva inicial" do realtime nos primeiros 1.5s após montar.
        if (
          payload?.eventType === "INSERT" &&
          row.direcao === "recebida" &&
          Date.now() - notifBootRef.current > 1500
        ) {
          const conv = convsRef.current.find((c) => c.id === cid);
          const isGroup = !!conv?.crm_contacts?.is_group;
          if (!isGroup) {
            try {
              const a = notifAudioRef.current;
              if (a) { a.currentTime = 0; void a.play().catch(() => {}); }
            } catch { /* noop */ }
          }
        }
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

  const sendAudioBlob = async (blob: Blob) => {
    if (!sel) return;
    setSending(true);
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const path = `${sel.cliente_id}/${sel.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("crm-audios").upload(path, blob, {
        contentType: blob.type || "audio/webm",
        upsert: false,
      });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from("crm-audios").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("sem URL");
      const { error } = await (supabase as any).from("crm_messages").insert({
        cliente_id: sel.cliente_id,
        conversation_id: sel.id,
        direcao: "enviada",
        tipo: "audio",
        conteudo: null,
        url_midia: signed.data.signedUrl,
        lida: true,
      });
      if (error) throw error;
      await loadMensagens(sel.id);
      void loadConversas();
    } catch (e: any) {
      toast.error("Falha ao enviar áudio: " + (e?.message || ""));
    } finally {
      setSending(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado da ligação: confirmação → chamando → encerrado.
  const [callState, setCallState] = useState<"idle" | "confirming" | "ringing">("idle");
  const [callTarget, setCallTarget] = useState<{ nome: string; telefone: string; foto?: string | null } | null>(null);
  const [callMuted, setCallMuted] = useState(false);
  const [callElapsed, setCallElapsed] = useState(0);

  useEffect(() => {
    if (callState !== "ringing") return;
    setCallElapsed(0);
    const t = setInterval(() => setCallElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  const iniciarLigacao = (telefone: string, nome: string, foto?: string | null) => {
    const phone = telefone.replace(/\D/g, "");
    if (!phone) { toast.error("Contato sem telefone válido."); return; }
    setCallTarget({ nome, telefone: phone, foto });
    setCallMuted(false);
    setCallState("confirming");
  };

  const confirmarLigacao = async () => {
    if (!callTarget) return;
    setCallState("ringing");
    try {
      await fetch("https://kpadm-n8n.a6hrr3.easypanel.host/webhook/crm-whatsapp-call", {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: callTarget.telefone,
          contato_nome: callTarget.nome,
          cliente_id: sel?.cliente_id,
          contact_id: sel?.contact_id,
          callDuration: 30,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      toast.error("Falha ao disparar a ligação.");
      setCallState("idle");
    }
  };

  const encerrarLigacao = () => {
    setCallState("idle");
    setCallTarget(null);
    setCallMuted(false);
    toast.success("Chamada encerrada.");
  };



  const sendMediaFile = async (file: File) => {
    if (!sel) return;
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) { toast.error("Envie apenas imagem ou vídeo."); return; }
    if (file.size > 100 * 1024 * 1024) { toast.error("Arquivo acima de 100MB."); return; }
    setSending(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${sel.cliente_id}/${sel.id}/${Date.now()}_${safeName}`;
      const up = await supabase.storage.from("crm-audios").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from("crm-audios").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("sem URL");
      const { error } = await (supabase as any).from("crm_messages").insert({
        cliente_id: sel.cliente_id,
        conversation_id: sel.id,
        direcao: "enviada",
        tipo: isImg ? "imagem" : "video",
        conteudo: null,
        url_midia: signed.data.signedUrl,
        lida: true,
      });
      if (error) throw error;
      await loadMensagens(sel.id);
      void loadConversas();
    } catch (e: any) {
      toast.error("Falha ao enviar arquivo: " + (e?.message || ""));
    } finally {
      setSending(false);
    }
  };

  const startRec = async () => {
    if (recording || sending || !sel) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(recChunksRef.current, { type });
        recStreamRef.current?.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
        if (recTimerRef.current) { window.clearInterval(recTimerRef.current); recTimerRef.current = null; }
        setRecSecs(0);
        setRecording(false);
        if (blob.size > 1024) void sendAudioBlob(blob);
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
      setRecSecs(0);
      recTimerRef.current = window.setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch (e: any) {
      toast.error("Permita o acesso ao microfone para gravar áudio.");
    }
  };

  const stopRec = (cancel = false) => {
    const mr = recRef.current;
    if (!mr) return;
    if (cancel) {
      recChunksRef.current = [];
    }
    try { mr.stop(); } catch { /* noop */ }
    recRef.current = null;
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
              const isGroup = !!c.crm_contacts?.is_group;
              return (
                <button
                  key={c.id}
                  onClick={() => abrir(c)}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 flex gap-3 transition-colors ${
                    selId === c.id ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <Avatar nome={nome} foto={c.crm_contacts?.foto_url} isGroup={isGroup} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm text-foreground truncate ${naoLido ? "font-bold" : "font-semibold"}`}>{nome}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{fmtHora(c.ultima_em || c.atualizado_em)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className={`text-xs truncate ${naoLido ? "text-foreground" : "text-muted-foreground"}`}>
                        {isGroup && <span className="mr-1 inline-flex items-center rounded px-1 py-[1px] text-[9px] font-semibold bg-primary/15 text-primary align-middle">GRUPO</span>}
                        {c.ultima_mensagem || "Sem mensagens"}
                      </span>
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
              <Avatar nome={sel.crm_contacts?.nome} foto={sel.crm_contacts?.foto_url} isGroup={!!sel.crm_contacts?.is_group} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-foreground truncate flex items-center gap-2">
                  {sel.crm_contacts?.nome || "Sem nome"}
                  {sel.crm_contacts?.is_group && (
                    <span className="inline-flex items-center rounded px-1.5 py-[1px] text-[9px] font-semibold bg-primary/15 text-primary">GRUPO</span>
                  )}
                </p>
                {sel.crm_contacts?.telefone && <p className="text-[11px] text-muted-foreground truncate">{sel.crm_contacts.telefone}</p>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {msgs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground pt-6">Nenhuma mensagem ainda. Envie a primeira 👇</p>
              ) : (
                msgs.map((m) => {
                  const isGroupChat = !!sel.crm_contacts?.is_group;
                  const showRemetente = isGroupChat && m.direcao === "recebida" && !!m.remetente_nome;
                  const showParticipantAvatar = isGroupChat && m.direcao === "recebida";
                  return (
                    <div key={m.id} className={`flex items-end gap-2 ${m.direcao === "enviada" ? "justify-end" : ""}`}>
                      {showParticipantAvatar && (
                        <Avatar size="sm" nome={m.remetente_nome} foto={m.remetente_foto} />
                      )}
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        m.direcao === "enviada"
                          ? "bg-primary text-white rounded-tr-sm"
                          : "bg-card border border-border text-foreground rounded-tl-sm"
                      }`}>
                        {showRemetente && (
                          <span className="block text-[10px] font-semibold text-primary mb-0.5 truncate">{m.remetente_nome}</span>
                        )}
                        {m.tipo === "audio" && m.url_midia ? (
                          <audio controls src={m.url_midia} className="max-w-[240px] block" />
                        ) : m.tipo === "imagem" && m.url_midia ? (
                          <a href={m.url_midia} target="_blank" rel="noreferrer">
                            <img src={m.url_midia} alt="imagem" className="max-w-[240px] max-h-[240px] rounded-md block object-cover" />
                          </a>
                        ) : m.tipo === "video" && m.url_midia ? (
                          <video controls src={m.url_midia} className="max-w-[260px] max-h-[260px] rounded-md block" />
                        ) : (
                          <span className="whitespace-pre-wrap break-words">{m.tipo === "texto" ? m.conteudo : `[${m.tipo}]`}</span>
                        )}
                        <span className={`block text-[9px] mt-0.5 text-right ${m.direcao === "enviada" ? "text-white/70" : "text-muted-foreground"}`}>{fmtHora(m.criado_em)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <div className="shrink-0 border-t border-border p-3 flex items-center gap-2 bg-card/40">
              {!can("responder") ? (
                <p className="w-full text-center text-xs text-muted-foreground py-1">Você não tem permissão para responder nesta conta.</p>
              ) : recording ? (
                <>
                  <div className="flex-1 h-10 px-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-sm text-rose-600 dark:text-rose-300 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    Gravando... {Math.floor(recSecs / 60).toString().padStart(2, "0")}:{(recSecs % 60).toString().padStart(2, "0")}
                  </div>
                  <button
                    onClick={() => stopRec(true)}
                    title="Cancelar"
                    className="h-10 w-10 rounded-lg bg-muted hover:bg-muted/70 text-foreground flex items-center justify-center transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => stopRec(false)}
                    title="Enviar áudio"
                    className="h-10 w-10 rounded-lg bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void sendMediaFile(f);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    title="Anexar imagem ou vídeo"
                    className="h-10 w-10 rounded-lg bg-muted hover:bg-muted/70 text-foreground flex items-center justify-center transition-colors disabled:opacity-50"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                  />
                  {draft.trim() ? (
                    <button
                      onClick={() => void enviar()}
                      disabled={sending}
                      title="Enviar"
                      className="h-10 w-10 rounded-lg bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => void startRec()}
                      disabled={sending}
                      title="Gravar áudio"
                      className="h-10 w-10 rounded-lg bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* PAINEL DO CONTATO */}
      {sel && (
        <div className="w-64 shrink-0 border-l border-border bg-card/30 p-5 hidden lg:flex flex-col gap-5 overflow-y-auto">
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar nome={sel.crm_contacts?.nome} size="lg" foto={sel.crm_contacts?.foto_url} isGroup={!!sel.crm_contacts?.is_group} />
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
  const { subcontaId, can } = useScope();
  const podeGerir = can("gerir_oportunidades");
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
      .from("crm_pipelines").select("id,cliente_id,nome").eq("cliente_id", subcontaId).order("criado_em", { ascending: true });
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
      const { data: pipe, error } = await (supabase as any).from("crm_pipelines").insert({ cliente_id: subcontaId, nome: "Funil de Vendas" }).select("id,cliente_id,nome").single();
      if (error) throw error;
      const { error: sErr } = await (supabase as any).from("crm_pipeline_stages").insert(DEFAULT_STAGES.map((n, i) => ({ cliente_id: subcontaId, pipeline_id: pipe.id, nome: n, ordem: i })));
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
          {pipeline && podeGerir && (
            <button onClick={() => setManageStages(true)} title="Editar etapas do funil" className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold px-2.5 transition-colors shrink-0">
              <Pencil className="h-3.5 w-3.5" /> Etapas
            </button>
          )}
        </div>
        {pipeline && podeGerir && (
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
                          draggable={podeGerir}
                          onDragStart={() => podeGerir && setDragId(o.id)}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => podeGerir && setEditing({ ...o })}
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
  const { subcontaId, can } = useScope();
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
      (supabase as any).from("crm_contacts").select("id,cliente_id,nome,telefone,email,criado_em").eq("cliente_id", subcontaId).order("nome", { ascending: true }),
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
    const clienteId = editing.id ? (editing.cliente_id || subcontaId) : subcontaId;
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
            {can("add_contato") && <button onClick={() => setEditing({})} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-2.5 py-1.5"><Plus className="h-3.5 w-3.5" /> Novo</button>}
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
              {can("editar_contato") && <button onClick={() => setEditing({ ...sel })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/15 transition-colors"><Pencil className="h-3.5 w-3.5" /> Editar</button>}
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

      {editing && <ContatoModal editing={editing} setEditing={setEditing} clientes={clientes} onSave={salvar} onDelete={excluir} saving={saving} podeExcluir={can("excluir_contato")} />}
    </>
  );
}

function ContatoModal({
  editing, setEditing, clientes, onSave, onDelete, saving, podeExcluir,
}: {
  editing: Partial<ContatoFull>;
  setEditing: (v: Partial<ContatoFull> | null) => void;
  clientes: ClienteRow[];
  onSave: () => void;
  onDelete: (id: string) => void;
  saving: boolean;
  podeExcluir: boolean;
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
          {editing.id && podeExcluir ? <button onClick={() => onDelete(editing.id!)} className="text-sm font-semibold text-rose-600 dark:text-rose-400 hover:underline">Excluir</button> : <span />}
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
const PAPEL_LABEL: Record<string, string> = { agencia: "Agência", admin: "Admin da subconta", usuario: "Usuário" };
type ConfTab = { key: "perfil" | "usuarios" | "conexoes" | "fases"; label: string; icon: typeof User };

function Config() {
  const { user } = useAuth();
  const { isAgencia, papel } = useScope();
  const gerirSubconta = isAgencia || papel === "admin";
  const [tab, setTab] = useState<ConfTab["key"]>("perfil");
  const tabs: ConfTab[] = [
    { key: "perfil", label: "Perfil", icon: User },
    ...(gerirSubconta ? [{ key: "usuarios", label: "Usuários", icon: Users } as ConfTab] : []),
    { key: "conexoes", label: "Conexões", icon: Link2 },
    ...(gerirSubconta ? [{ key: "fases", label: "Fases do funil", icon: Target } as ConfTab] : []),
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
          {tab === "perfil" && <PerfilCard user={user} isAdmin={isAgencia} />}
          {tab === "usuarios" && gerirSubconta && <UsuariosSection />}
          {tab === "conexoes" && <ConexoesCard />}
          {tab === "fases" && gerirSubconta && <FasesSection />}
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
  const { subcontaId } = useScope();
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Estado do modal: inclui campos de login (username, password) usados na CRIAÇÃO
  // e opcionalmente na TROCA de senha durante edição.
  type EditState = Partial<CrmUser> & { username?: string; password?: string };
  const [edit, setEdit] = useState<EditState | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("crm_users").select("id,auth_user_id,nome,email,cliente_id,papel,permissoes").eq("cliente_id", subcontaId).order("nome", { ascending: true });
    setUsers((data as CrmUser[]) || []);
    setLoading(false);
  }, [subcontaId]);
  useEffect(() => { void load(); }, [load]);

  const remove = async (u: CrmUser) => {
    if (!confirm("Remover este usuário do CRM? (o login do site será mantido — remova pela tela de Gestão de Usuários se quiser apagar por completo.)")) return;
    const { error } = await (supabase as any).from("crm_users").delete().eq("id", u.id);
    if (error) toast.error(error.message); else void load();
  };

  const salvar = async () => {
    if (!edit) return;
    if (!subcontaId) { toast.error("Sem subconta ativa."); return; }
    setSaving(true);
    try {
      const linkPayload = {
        cliente_id: subcontaId,
        papel: edit.papel === "admin" ? "admin" : "usuario",
        permissoes: edit.papel === "admin" ? {} : (edit.permissoes || {}),
      };

      // ── CRIAR: cria o login do site (edge function) e vincula em crm_users ──
      if (!edit.id) {
        const username = (edit.username || "").trim().toLowerCase();
        const password = (edit.password || "").trim();
        if (!username || !password) { toast.error("Preencha usuário e senha."); setSaving(false); return; }
        if (password.length < 6) { toast.error("A senha precisa ter no mínimo 6 caracteres."); setSaving(false); return; }
        if (!/^[a-z0-9._-]+$/.test(username)) { toast.error("Usuário: só letras, números, . _ -"); setSaving(false); return; }

        const { data: authData } = await supabase.auth.getSession();
        const token = authData.session?.access_token;
        const res = await supabase.functions.invoke("create-internal-user", {
          body: {
            username,
            password,
            full_name: edit.nome?.trim() || "",
            role: "client",
            dashboard_keys: ["crm"],
            client_ids: [],
            crm_links: [linkPayload],
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.error || (res.data as any)?.error) {
          toast.error((res.data as any)?.error || res.error?.message || "Falha ao criar login.");
          setSaving(false);
          return;
        }
        toast.success("Usuário criado. Ele já pode entrar com esse usuário e senha.");
        setEdit(null);
        setSaving(false);
        void load();
        return;
      }

      // ── EDITAR: papel/permissões + (opcional) troca de senha via edge function ──
      if (!edit.auth_user_id) {
        toast.error("Este usuário ainda não tem login vinculado.");
        setSaving(false);
        return;
      }
      if (edit.password && edit.password.trim() && edit.password.trim().length < 6) {
        toast.error("Nova senha precisa ter no mínimo 6 caracteres."); setSaving(false); return;
      }
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      const res = await supabase.functions.invoke("create-internal-user", {
        body: {
          action: "update_user",
          user_id: edit.auth_user_id,
          password: edit.password?.trim() || undefined,
          full_name: edit.nome?.trim() || "",
          crm_links: [linkPayload],
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error || (res.data as any)?.error) {
        toast.error((res.data as any)?.error || res.error?.message || "Falha ao salvar.");
        setSaving(false);
        return;
      }
      toast.success("Usuário atualizado.");
      setEdit(null);
      void load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">Usuários do CRM</p>
          <p className="text-xs text-muted-foreground">Ao criar, já geramos o login do site (usuário + senha). Ele entra pela tela normal de login e recebe acesso automático ao Dashboard do CRM desta subconta.</p>
        </div>
        <button onClick={() => setEdit({ papel: "usuario", permissoes: {} })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-3 py-1.5 shrink-0"><UserPlus className="h-4 w-4" /> Novo usuário</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
        <div className="rounded-xl border border-border overflow-hidden">
          {users.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhum usuário cadastrado.</p> : users.map((u) => {
            const login = (u.email || "").replace(/@kp\.local$/i, "");
            return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
                <Avatar nome={u.nome || u.email} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{u.nome || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground truncate">{login || u.email || "—"}{!u.auth_user_id && " · não vinculado"}</p>
                </div>
                <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${u.papel === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{u.papel === "admin" ? "Admin" : "Usuário"}</span>
                <button onClick={() => setEdit({ ...u, permissoes: u.permissoes || {}, password: "" })} title="Editar" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => void remove(u)} title="Remover" className="h-8 w-8 rounded-lg flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      )}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">{edit.id ? "Editar usuário" : "Novo usuário"}</h3>
              <button onClick={() => setEdit(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-muted-foreground">Nome completo</label><input value={edit.nome ?? ""} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" /></div>
              {!edit.id ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Usuário (login)</label>
                    <input value={edit.username ?? ""} onChange={(e) => setEdit({ ...edit, username: e.target.value })} placeholder="ex: joaosilva" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
                    <p className="text-[11px] text-muted-foreground mt-1">Ele usará este nome + senha para entrar na tela de login do site.</p>
                  </div>
                  <div><label className="text-xs font-semibold text-muted-foreground">Senha</label><input type="password" value={edit.password ?? ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder="mínimo 6 caracteres" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" /></div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Nova senha (opcional)</label>
                  <input type="password" value={edit.password ?? ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder="deixe em branco para não alterar" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" />
                  {!edit.auth_user_id && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Este usuário ainda não tem login vinculado — a troca de senha não terá efeito.</p>}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Papel</label>
                <select value={edit.papel || "usuario"} onChange={(e) => setEdit({ ...edit, papel: e.target.value as CrmUser["papel"] })} className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-2 outline-none focus:border-primary/50">
                  <option value="admin">Admin da subconta (tudo)</option>
                  <option value="usuario">Usuário (limitado)</option>
                </select>
              </div>
              {edit.papel === "usuario" && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Permissões — marque o que este usuário pode fazer</p>
                  <div className="space-y-1.5 rounded-lg border border-border p-3">
                    {PERMISSOES.map((p) => (
                      <label key={p.key} className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={!!edit.permissoes?.[p.key]} onChange={(e) => setEdit({ ...edit, permissoes: { ...(edit.permissoes || {}), [p.key]: e.target.checked } })} className="h-4 w-4 accent-primary" />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-2" disabled={saving}>Cancelar</button>
              <button onClick={() => void salvar()} disabled={saving} className="text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConexoesCard() {
  const { subcontaId, isAgencia, papel } = useScope();
  const podeConfig = isAgencia || papel === "admin";
  const [conn, setConn] = useState<any | null>(null);
  const [form, setForm] = useState({ instance_id: "", zapi_token: "", zapi_client_token: "", numero: "", n8n_send_url: "", ativo: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("crm_connections").select("*").eq("cliente_id", subcontaId).eq("provedor", "z-api").maybeSingle();
    setConn(data || null);
    if (data) setForm({ instance_id: data.instance_id || "", zapi_token: data.zapi_token || "", zapi_client_token: data.zapi_client_token || "", numero: data.numero || "", n8n_send_url: data.n8n_send_url || "", ativo: data.ativo ?? true });
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const salvar = async () => {
    if (!subcontaId) return;
    if (!form.instance_id.trim()) { toast.error("Preencha o Instance ID."); return; }
    setSaving(true);
    const payload: any = {
      cliente_id: subcontaId, provedor: "z-api",
      instance_id: form.instance_id.trim(),
      zapi_token: form.zapi_token.trim() || null,
      zapi_client_token: form.zapi_client_token.trim() || null,
      numero: form.numero.trim() || null,
      n8n_send_url: form.n8n_send_url.trim() || null,
      ativo: form.ativo,
    };
    const res = conn?.id
      ? await (supabase as any).from("crm_connections").update(payload).eq("id", conn.id)
      : await (supabase as any).from("crm_connections").insert({ ...payload, webhook_secret: "kpwh_72793a36df318e7593cc8bf97478d99b" });
    setSaving(false);
    if (res.error) {
      if (res.error.code === "23505") toast.error("Esse Instance ID já está em uso em outra subconta.");
      else toast.error(res.error.message);
      return;
    }
    toast.success("Conexão salva!");
    void load();
  };

  if (!podeConfig) return <p className="text-sm text-muted-foreground">Só admins da subconta configuram a conexão do WhatsApp.</p>;
  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const conectado = !!(conn?.instance_id && conn?.ativo);
  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"><MessageSquare className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">WhatsApp — Z-API (não oficial)</p>
              <p className="text-xs text-muted-foreground">Credenciais desta subconta. Cada loja tem a sua.</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 ${conectado ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}><span className={`h-2 w-2 rounded-full ${conectado ? "bg-emerald-500" : "bg-rose-500"}`} /> {conectado ? "Ativo" : "Inativo"}</span>
        </div>
        <div className="space-y-2">
          <div><label className="text-xs font-semibold text-muted-foreground">Instance ID</label><input value={form.instance_id} onChange={(e) => setForm({ ...form, instance_id: e.target.value })} placeholder="ex: 3F4413670AF4D120..." className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" /></div>
          <div><label className="text-xs font-semibold text-muted-foreground">Token da instância</label><input value={form.zapi_token} onChange={(e) => setForm({ ...form, zapi_token: e.target.value })} placeholder="ex: 72AC42C49EA75..." className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" /></div>
          <div><label className="text-xs font-semibold text-muted-foreground">Client-Token (segurança da conta)</label><input value={form.zapi_client_token} onChange={(e) => setForm({ ...form, zapi_client_token: e.target.value })} placeholder="ex: F12709db3bddd..." className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" /></div>
          <div><label className="text-xs font-semibold text-muted-foreground">Número (opcional)</label><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="ex: 5592..." className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" /></div>
          <div><label className="text-xs font-semibold text-muted-foreground">URL do webhook de envio (n8n)</label><input value={form.n8n_send_url} onChange={(e) => setForm({ ...form, n8n_send_url: e.target.value })} placeholder="ex: https://seu-n8n.../webhook/crm-whatsapp-out" className="mt-1 w-full h-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground px-3 outline-none focus:border-primary/50" /><p className="text-[11px] text-muted-foreground mt-1">A mesma URL do fluxo "Enviar" do n8n, para todas as subcontas.</p></div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer pt-1"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="h-4 w-4 accent-primary" /> Conexão ativa</label>
        </div>
        <div className="flex justify-end">
          <button onClick={() => void salvar()} disabled={saving} className="text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 disabled:opacity-60">{saving ? "Salvando..." : "Salvar conexão"}</button>
        </div>
      </div>

      {conn?.id && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Último passo no Z-API</p>
          <p className="text-xs text-muted-foreground">Nesta instância do Z-API, em <strong>"Webhooks → Ao receber"</strong>, cole a URL do seu webhook do n8n (a mesma para todas as subcontas). O roteamento pra loja certa é automático pela instância.</p>
        </div>
      )}
    </div>
  );
}

function FasesSection() {
  const { subcontaId } = useScope();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [open, setOpen] = useState(false);
  const pipeline = pipelines.find((p) => p.id === pipelineId) || null;
  const clienteId = pipeline?.cliente_id || null;

  const loadPipes = useCallback(async () => {
    const { data } = await (supabase as any).from("crm_pipelines").select("id,cliente_id,nome").eq("cliente_id", subcontaId).order("criado_em", { ascending: true });
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
  const { user, isAdmin } = useAuth();
  const [section, setSection] = useState<Section>("conversas");
  const [subcontas, setSubcontas] = useState<{ id: string; nome: string | null }[]>([]);
  const [subcontaId, setSubcontaId] = useState<string | null>(null);
  const [loadingScope, setLoadingScope] = useState(true);
  const [semAcesso, setSemAcesso] = useState(false);
  const [criando, setCriando] = useState(false);
  const [meuPapel, setMeuPapel] = useState<string>("usuario");
  const [minhasPerms, setMinhasPerms] = useState<Record<string, boolean>>({});

  const loadSubcontas = useCallback(async () => {
    if (!user?.id) return;
    setLoadingScope(true);
    if (isAdmin) {
      // AGÊNCIA: vê tudo, escolhe em qual subconta entrar
      setMeuPapel("agencia");
      setMinhasPerms({});
      const { data } = await (supabase as any).from("crm_clients").select("id,nome").order("nome", { ascending: true });
      const list = ((data as any[]) || []).map((c) => ({ id: c.id, nome: c.nome }));
      setSubcontas(list);
      setSubcontaId((prev) => prev || (list.length === 1 ? list[0].id : null));
    } else {
      // ADMIN/USUÁRIO de subconta: entra direto na sua, com seu papel/permissões
      const { data } = await (supabase as any).from("crm_users").select("cliente_id, papel, permissoes").eq("auth_user_id", user.id).maybeSingle();
      if (data?.cliente_id) {
        setMeuPapel(data.papel || "usuario");
        setMinhasPerms((data.permissoes as Record<string, boolean>) || {});
        const { data: cl } = await (supabase as any).from("crm_clients").select("nome").eq("id", data.cliente_id).maybeSingle();
        setSubcontaId(data.cliente_id);
        setSubcontas([{ id: data.cliente_id, nome: cl?.nome ?? null }]);
      } else {
        setSemAcesso(true);
      }
    }
    setLoadingScope(false);
  }, [user?.id, isAdmin]);

  useEffect(() => { void loadSubcontas(); }, [loadSubcontas]);

  const criarSubconta = async () => {
    const nome = window.prompt("Nome da nova subconta (loja):")?.trim();
    if (!nome) return;
    setCriando(true);
    const { data, error } = await (supabase as any).from("crm_clients").insert({ nome }).select("id,nome").single();
    setCriando(false);
    if (error) { toast.error(error.message); return; }
    await loadSubcontas();
    setSubcontaId(data.id);
  };

  const subcontaNome = subcontas.find((s) => s.id === subcontaId)?.nome || "";
  const can = (k: string) => isAdmin || meuPapel === "admin" || !!minhasPerms[k];
  const navPerm: Record<Section, string | null> = { conversas: "ver_conversas", oportunidades: "ver_oportunidades", contatos: null, config: "ver_config" };
  const navVisible = NAV.filter((item) => { const p = navPerm[item.key]; return !p || can(p); });
  const effectiveSection: Section = navVisible.some((n) => n.key === section) ? section : (navVisible[0]?.key || "conversas");

  const Header = (
    <header className="h-14 shrink-0 border-b border-border bg-card/50 backdrop-blur px-3 sm:px-4 flex items-center gap-3">
      <Link to="/" className="p-2 -ml-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Voltar ao início">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
        <MessageSquare className="h-4 w-4 text-white" />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-base font-bold text-foreground shrink-0">CRM</h1>
        {subcontaId && <span className="text-sm text-muted-foreground truncate">· {subcontaNome || "Subconta"}</span>}
        {isAdmin && subcontaId && (
          <button onClick={() => setSubcontaId(null)} className="ml-1 text-[11px] font-semibold text-primary bg-primary/10 border border-primary/30 rounded-lg px-2 py-0.5 hover:bg-primary/15 shrink-0">Trocar</button>
        )}
      </div>
      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/40 px-2 py-0.5 text-[10px] font-semibold text-primary shrink-0">
        <Wrench className="h-3 w-3" /> Em construção
      </span>
    </header>
  );

  if (semAcesso) {
    return (
      <div className="h-screen flex flex-col bg-background text-foreground">
        {Header}
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center"><Users className="h-7 w-7 text-muted-foreground" /></div>
          <p className="font-semibold text-foreground">Você ainda não tem acesso a uma subconta do CRM.</p>
          <p className="text-sm text-muted-foreground max-w-sm">Peça a um admin para te vincular a uma subconta.</p>
        </div>
      </div>
    );
  }

  if (isAdmin && !subcontaId) {
    return (
      <div className="h-screen flex flex-col bg-background text-foreground">
        {Header}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Subcontas</h2>
                <p className="text-sm text-muted-foreground">Escolha em qual subconta você quer entrar.</p>
              </div>
              <button onClick={() => void criarSubconta()} disabled={criando} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-3 py-1.5 disabled:opacity-60"><Plus className="h-4 w-4" /> Nova subconta</button>
            </div>
            {loadingScope ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : subcontas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma subconta ainda. Crie a primeira acima.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {subcontas.map((s) => (
                  <button key={s.id} onClick={() => setSubcontaId(s.id)} className="text-left rounded-xl border border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5 p-4 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">{(s.nome || "?").charAt(0).toUpperCase()}</div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{s.nome || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">Entrar →</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loadingScope || !subcontaId) {
    return (
      <div className="h-screen flex flex-col bg-background text-foreground">
        {Header}
        <div className="flex-1 flex items-center justify-center"><p className="text-sm text-muted-foreground">Carregando...</p></div>
      </div>
    );
  }

  return (
    <CrmScope.Provider value={{ subcontaId, isAgencia: isAdmin, subcontaNome, papel: meuPapel, can }}>
      <div className="h-screen flex flex-col bg-background text-foreground">
        {Header}
        <div className="flex-1 flex min-h-0">
          <nav className="w-[72px] shrink-0 border-r border-border bg-card/30 p-2 flex flex-col gap-1">
            {navVisible.map((item) => {
              const activeItem = effectiveSection === item.key;
              return (
                <button key={item.key} onClick={() => setSection(item.key)} className={`w-full flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-colors ${activeItem ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-none text-center">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="flex-1 min-w-0 flex" key={subcontaId}>
            {effectiveSection === "conversas" && <Conversas />}
            {effectiveSection === "oportunidades" && <Oportunidades />}
            {effectiveSection === "contatos" && <Contatos />}
            {effectiveSection === "config" && <Config />}
          </div>
        </div>
      </div>
    </CrmScope.Provider>
  );
}
