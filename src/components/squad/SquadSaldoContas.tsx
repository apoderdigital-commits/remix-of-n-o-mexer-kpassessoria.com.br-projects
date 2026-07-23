import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, AlertTriangle, CreditCard, PiggyBank } from "lucide-react";

type Conta = {
  client_id: string;
  name: string;
  account: string | null;
  account_name?: string | null;
  saldo?: number | null;          // balance (fatura em aberto) — usado pra cartão
  saldo_disponivel?: number | null; // saldo pré-pago disponível — usado pra pré-pago
  gasto?: number | null;
  limite?: number | null;
  currency?: string | null;
  status?: number | null;
  forma_pagamento?: string | null;
  tipo?: "prepago" | "cartao";
  error?: string;
};

type Props = { open: boolean; onClose: () => void; squadId: string | null };

function money(v: number | null | undefined, currency = "BRL") {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  }
}

// Códigos de status da conta de anúncios da Meta.
function statusInfo(code?: number | null): { label: string; cls: string } | null {
  switch (code) {
    case 1: return { label: "Ativa", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
    case 2: return { label: "Desativada", cls: "bg-red-500/15 text-red-600 dark:text-red-400" };
    case 3: return { label: "Pendência de pagamento", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    case 7: return { label: "Em análise", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    case 8: return { label: "Aguardando acerto", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    case 9: return { label: "Período de carência", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    case 100:
    case 101: return { label: "Fechada", cls: "bg-red-500/15 text-red-600 dark:text-red-400" };
    default: return code == null ? null : { label: `Status ${code}`, cls: "bg-muted text-muted-foreground" };
  }
}

// Cor do saldo pré-pago: vermelho se zerou, âmbar se está baixo.
function saldoCls(v: number | null | undefined) {
  if (v == null) return "text-foreground";
  if (v <= 0) return "text-red-600 dark:text-red-400";
  if (v < 300) return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}

export function SquadSaldoContas({ open, onClose, squadId }: Props) {
  const [loading, setLoading] = useState(false);
  const [contas, setContas] = useState<Conta[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);

  const load = async () => {
    if (!squadId) return;
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-meta-balances", {
        body: { squad_id: squadId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setContas(((data as any)?.contas || []) as Conta[]);
      setAtualizadoEm((data as any)?.atualizado_em || new Date().toISOString());
    } catch (e: any) {
      setErro(e?.message || "Não foi possível carregar os saldos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, squadId]);

  const { prepago, cartao, comErro, totalPrepago } = useMemo(() => {
    const ok = contas.filter((c) => !c.error);
    // Pré-pago: menor saldo disponível no topo (mais urgente). Nulos por último.
    const prepago = ok
      .filter((c) => c.tipo === "prepago")
      .sort((a, b) => (a.saldo_disponivel ?? Infinity) - (b.saldo_disponivel ?? Infinity));
    // Cartão: menor fatura em aberto no topo.
    const cartao = ok
      .filter((c) => c.tipo !== "prepago")
      .sort((a, b) => (a.saldo ?? Infinity) - (b.saldo ?? Infinity));
    const comErro = contas.filter((c) => c.error);
    const totalPrepago = prepago.reduce(
      (s, c) => s + (typeof c.saldo_disponivel === "number" ? c.saldo_disponivel : 0),
      0
    );
    return { prepago, cartao, comErro, totalPrepago };
  }, [contas]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Saldo das contas de anúncios
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 pb-2">
          <p className="text-xs text-muted-foreground">
            {atualizadoEm
              ? `Atualizado às ${new Date(atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Consultando a Meta em tempo real…"}
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-5">
          {loading && contas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
              Consultando saldos na Meta…
            </div>
          ) : erro ? (
            <div className="py-10 text-center">
              <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{erro}</p>
            </div>
          ) : contas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum cliente com conta de anúncios neste squad.
            </p>
          ) : (
            <>
              {/* PRÉ-PAGO */}
              {prepago.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <PiggyBank className="h-4 w-4 text-emerald-500" /> Pré-pago · saldo disponível
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Total <b className="text-foreground">{money(totalPrepago)}</b>
                    </span>
                  </div>
                  {prepago.map((c) => {
                    const st = statusInfo(c.status);
                    const cur = c.currency || "BRL";
                    return (
                      <div
                        key={c.client_id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/40 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {c.gasto != null ? `Gasto ${money(c.gasto, cur)}` : ""}
                            {c.limite != null ? ` · Limite ${money(c.limite, cur)}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold tabular-nums ${saldoCls(c.saldo_disponivel)}`}>
                            {money(c.saldo_disponivel, cur)}
                          </p>
                          {st && (
                            <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>
                              {st.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}

              {/* CARTÃO */}
              {cartao.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center px-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <CreditCard className="h-4 w-4 text-primary" /> Cartão · pós-pago
                    </span>
                  </div>
                  {cartao.map((c) => {
                    const st = statusInfo(c.status);
                    const cur = c.currency || "BRL";
                    return (
                      <div
                        key={c.client_id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/40 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {c.forma_pagamento || "Cartão"}
                            {c.gasto != null ? ` · Gasto ${money(c.gasto, cur)}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold tabular-nums text-foreground">{money(c.saldo, cur)}</p>
                          <span className="block text-[10px] text-muted-foreground">fatura em aberto</span>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}

              {/* SEM LEITURA */}
              {comErro.length > 0 && (
                <section className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                    Sem leitura de saldo
                  </p>
                  {comErro.map((c) => (
                    <div
                      key={c.client_id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/40 px-4 py-2.5"
                    >
                      <p className="font-medium truncate text-muted-foreground">{c.name}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0">{c.error}</span>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
