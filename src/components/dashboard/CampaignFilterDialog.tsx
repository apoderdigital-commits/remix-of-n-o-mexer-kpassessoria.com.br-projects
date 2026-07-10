import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Filter } from "lucide-react";

interface Campaign { campaign_name: string; amount_spent: number | string; leads_total: number; }
interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string | null;
  campaigns: Campaign[];
  excluded: string[];
  onSaved: () => void;
}

const fmtMoney = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CampaignFilterDialog({ open, onClose, clientId, campaigns, excluded, onSaved }: Props) {
  // Só campanhas que GASTARAM no período (agrupadas por nome)
  const list = useMemo(() => {
    const m = new Map<string, { spent: number; leads: number }>();
    for (const c of (campaigns || [])) {
      const nm = (c.campaign_name || "").trim();
      if (!nm) continue;
      const e = m.get(nm) || { spent: 0, leads: 0 };
      e.spent += Number(c.amount_spent) || 0;
      e.leads += Number(c.leads_total) || 0;
      m.set(nm, e);
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v }))
      .filter((c) => c.spent > 0)
      .sort((a, b) => b.spent - a.spent);
  }, [campaigns]);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Ao abrir: marca todas menos as já excluídas (padrão = todas ativas)
  useEffect(() => {
    if (!open) return;
    const excl = new Set(excluded || []);
    setChecked(new Set(list.map((c) => c.name).filter((n) => !excl.has(n))));
  }, [open, list, excluded]);

  const toggle = (name: string) => {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  };
  const allOn = list.length > 0 && list.every((c) => checked.has(c.name));
  const toggleAll = () => setChecked(allOn ? new Set() : new Set(list.map((c) => c.name)));

  const save = async () => {
    if (!clientId) return;
    setSaving(true);
    // Excluídas = campanhas do período que ficaram DESMARCADAS
    const excludedNow = list.map((c) => c.name).filter((n) => !checked.has(n));
    // Upsert manual (não depende de constraint ON CONFLICT / cache do PostgREST)
    const { data: existing, error: selErr } = await (supabase.from as any)("client_campaign_filters")
      .select("client_id").eq("client_id", clientId).maybeSingle();
    let error: any = selErr;
    if (!error) {
      if (existing) {
        const res = await (supabase.from as any)("client_campaign_filters")
          .update({ excluded_campaigns: excludedNow, updated_at: new Date().toISOString() })
          .eq("client_id", clientId);
        error = res.error;
      } else {
        const res = await (supabase.from as any)("client_campaign_filters")
          .insert({ client_id: clientId, excluded_campaigns: excludedNow });
        error = res.error;
      }
    }
    setSaving(false);
    if (error) {
      if (/client_campaign_filters|does not exist|schema cache/i.test(error.message || "")) {
        toast.error("Precisa rodar a migração do filtro de campanhas (peça ao Lovable).");
      } else {
        toast.error("Erro ao salvar filtro: " + error.message);
      }
      return;
    }
    toast.success("Filtro salvo — vale para todos os usuários.");
    onSaved();
    onClose();
  };

  const totalSel = list.filter((c) => checked.has(c.name)).reduce((s, c) => s + c.spent, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" /> Filtrar campanhas do investimento
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Marque só as campanhas que são <strong>suas</strong>. As desmarcadas saem do <strong>Investimento</strong> e do <strong>Total de Leads</strong>.
          Vale para <strong>todos os usuários</strong>. Só aparecem campanhas que <strong>gastaram no período</strong> selecionado.
        </p>
        <div className="flex items-center justify-between py-2 border-b border-border/30">
          <button onClick={toggleAll} className="text-xs text-primary hover:underline">{allOn ? "Desmarcar todas" : "Marcar todas"}</button>
          <span className="text-xs text-muted-foreground">{checked.size}/{list.length} · {fmtMoney(totalSel)}</span>
        </div>
        <div className="space-y-1.5 py-1 max-h-[45vh] overflow-y-auto pr-1">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma campanha com gasto no período. (Sincronize a Meta primeiro.)</p>
          ) : list.map((c) => (
            <label key={c.name} className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/40 px-3 py-2 cursor-pointer hover:bg-card/60">
              <Checkbox checked={checked.has(c.name)} onCheckedChange={() => toggle(c.name)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" title={c.name}>{c.name}</p>
                <p className="text-[11px] text-muted-foreground">{fmtMoney(c.spent)} · {c.leads} leads</p>
              </div>
            </label>
          ))}
        </div>
        <Button onClick={save} disabled={saving || !clientId} className="w-full">{saving ? "Salvando..." : "Salvar filtro"}</Button>
      </DialogContent>
    </Dialog>
  );
}
