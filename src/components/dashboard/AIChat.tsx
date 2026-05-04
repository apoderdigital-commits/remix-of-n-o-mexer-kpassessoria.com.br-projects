import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import type { AIContext } from "@/lib/aiContext";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface AIChatProps {
  buildContext: () => AIContext | null;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "Qual criativo trouxe mais leads no período?",
  "Por que as vendas caíram esta semana?",
  "Compare o desempenho dos vendedores",
  "O que devo fazer para melhorar a conversão?",
];

export function AIChat({ buildContext, disabled }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const sendCreativeToWhatsApp = async (identifier: string) => {
    const ctx = buildContext();
    const top = ctx?.topCreatives?.find((c) => c.name === identifier);
    const tid = toast.loading("Enviando para seu WhatsApp...");
    try {
      const { data, error } = await supabase.functions.invoke("send-creative-whatsapp", {
        body: {
          creative_url: identifier,
          period_since: ctx?.period?.since ?? null,
          period_until: ctx?.period?.until ?? null,
          category: top ? "Top criativo (CPF aprovado)" : null,
          count: top?.count ?? null,
          percentage: top?.pct ?? null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Enviado! Confira seu WhatsApp.", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar para o WhatsApp", { id: tid });
    }
  };

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || streaming) return;
    const ctx = buildContext();
    if (!ctx) {
      toast.error("Selecione um cliente antes de conversar");
      return;
    }

    const userMsg: Msg = { role: "user", content: value };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-dashboard`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: nextMessages, context: ctx }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Limite de uso da IA excedido. Tente em alguns minutos.");
        else if (resp.status === 402) toast.error("Créditos da IA esgotados.");
        else toast.error("Falha ao conversar com a IA");
        setMessages(nextMessages); // remove placeholder vazio se houver
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        textBuffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) upsert(delta);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      // flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "" || !raw.startsWith("data: ")) continue;
          const json = raw.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) upsert(delta);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão com a IA");
    } finally {
      setStreaming(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="gap-2 bg-gradient-to-r from-primary to-fuchsia-600 hover:from-primary/90 hover:to-fuchsia-600/90 text-white shadow-lg shadow-primary/20"
      >
        <Sparkles className="h-4 w-4" />
        Perguntar à IA
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col bg-card/95 backdrop-blur border-l border-border/60"
        >
          <SheetHeader className="px-4 py-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-fuchsia-600">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                Pergunte à IA
              </SheetTitle>
              {messages.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMessages([])}
                  className="h-7 text-xs text-muted-foreground"
                >
                  Limpar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-left">
              Pergunte sobre KPIs, criativos, vendedores ou tendências do período filtrado.
            </p>
          </SheetHeader>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Sugestões
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={streaming}
                    className="w-full text-left text-xs p-3 rounded-xl border border-border/40 bg-background/40 hover:border-primary/40 hover:bg-primary/[0.05] transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary/20 text-foreground border border-primary/30"
                      : "bg-background/60 text-foreground border border-border/40"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                      <ReactMarkdown
                        urlTransform={(url) => url}
                        components={{
                          a: ({ href, children, ...props }) => {
                            if (href?.startsWith("send-whatsapp:")) {
                              const identifier = decodeURIComponent(href.slice("send-whatsapp:".length));
                              return (
                                <button
                                  type="button"
                                  onClick={() => sendCreativeToWhatsApp(identifier)}
                                  className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-xs font-medium transition no-underline"
                                >
                                  {children}
                                </button>
                              );
                            }
                            return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
                          },
                        }}
                      >{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {streaming && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-2.5 bg-background/60 border border-border/40 text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs">Pensando…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/40 p-3">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={2}
                disabled={streaming}
                placeholder="Digite sua pergunta…"
                className="w-full resize-none rounded-xl border border-border/40 bg-background/40 text-sm px-3 py-2 pr-10 focus:outline-none focus:border-primary/50 focus:bg-background/60 transition-all placeholder:text-muted-foreground/60"
              />
              <Button
                size="icon"
                onClick={() => send(input)}
                disabled={streaming || !input.trim()}
                className="absolute bottom-2 right-2 h-7 w-7"
              >
                {streaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 text-center">
              IA pode errar. Confira números importantes.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
