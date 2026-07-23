import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, AlertTriangle, CircleDollarSign } from "lucide-react";

type Conta = {
  client_id: string;
  name: string;
  account: string | null;
  account_name?: string | null;
  saldo?: number | null;
  gasto?: number | null;
  limite?: number | null;
  currency?: string | null;
  status?: number | null;
  forma_pagamento?: string | null;
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

  // Contas com saldo primeiro (menor saldo no topo = mais urgente); erros/sem-conta por último.
  const { ok, comErro } = useMemo(() => {
    const ok = contas.filter((c) => !c.error).sort((a, b) => (a.saldo ?? Infinity) - (b.saldo ?? Infinity));
    const comErro = contas.filter((c) => c.error);
    return { ok, comErro };
  }, [contas]);

  const totalSaldo = useMemo(
    () => ok.reduce((s, c) => s + (typeof c.saldo === "number" ? c.saldo : 0), 0),
    [ok]
  );

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

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
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
              {ok.map((c) => {
                const st = statusInfo(c.status);
                const cur = c.currency || "BRL";
                const negativoOuBaixo = typeof c.saldo === "number" && c.saldo <= 0;
                return (
                  <div
                    key={c.client_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/40 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {(c.gasto != null ? `Gasto ${money(c.gasto, cur)}` : "")}
                        {c.limite != null ? ` · Limite ${money(c.limite, cur)}` : ""}
                        {c.forma_pagamento ? ` · ${c.forma_pagamento}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold tabular-nums ${negativoOuBaixo ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                        {money(c.saldo, cur)}
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

              {comErro.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 px-1">
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
                </div>
              )}
            </>
          )}
        </div>

        {ok.length > 0 && (
          <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-3">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CircleDollarSign className="h-4 w-4" /> Total ({ok.length} contas)
            </span>
            <span className="font-bold tabular-nums">{money(totalSaldo)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
