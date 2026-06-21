import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, FlaskConical } from "lucide-react";

const WEBHOOK_URL = "https://kpadm-n8n.a6hrr3.easypanel.host/webhook/relatorioautositekp";

interface Props {
  client: { id: string; name: string } | null;
  onClose: () => void;
}

interface ReportConfig {
  client_id: string;
  whatsapp_jid: string;
  enabled: boolean;
  send_day: number;
  send_time: string;
  metric_source: "ghl" | "planilha";
}

const DAYS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

const DEFAULT_CONFIG = (clientId: string): ReportConfig => ({
  client_id: clientId,
  whatsapp_jid: "",
  enabled: false,
  send_day: 1,
  send_time: "08:00",
  metric_source: "ghl",
});

export function RelatorioConfigModal({ client, onClose }: Props) {
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_CONFIG(""));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!client) return;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("client_report_configs")
        .select("*")
        .eq("client_id", client.id)
        .maybeSingle();
      setConfig(data ?? DEFAULT_CONFIG(client.id));
      setLoading(false);
    })();
  }, [client]);

  const save = async () => {
    if (!client) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("client_report_configs")
      .upsert(
        { ...config, client_id: client.id, updated_at: new Date().toISOString() },
        { onConflict: "client_id" }
      );
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar configuração");
    } else {
      toast.success("Configuração salva!");
      onClose();
    }
  };

  const sendTest = async () => {
    if (!client) return;
    if (!config.whatsapp_jid.trim()) {
      toast.error("Preencha o JID do grupo antes de testar");
      return;
    }
    setTesting(true);
    try {
      // Fetch client credentials from Supabase so n8n can query the APIs
      const { data: clientData } = await (supabase as any)
        .from("clients")
        .select("meta_account_id, meta_token_id, ghl_api_key, ghl_location_id, google_sheet_id")
        .eq("id", client.id)
        .single();

      // Build last-7-days period
      const until = new Date();
      const since = new Date();
      since.setDate(until.getDate() - 6);
      const fmt = (d: Date) => d.toISOString().split("T")[0];

      const payload = {
        test: true,
        client_id: client.id,
        client_name: client.name,
        whatsapp_jid: config.whatsapp_jid,
        metric_source: config.metric_source,
        period: {
          since: fmt(since),
          until: fmt(until),
          label: `${since.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${until.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
        },
        credentials: {
          meta_account_id: clientData?.meta_account_id ?? null,
          ghl_api_key: clientData?.ghl_api_key ?? null,
          ghl_location_id: clientData?.ghl_location_id ?? null,
          google_sheet_id: clientData?.google_sheet_id ?? null,
        },
        report_template: {
          header: "📊 *Relatório Semanal - KP Assessoria*",
          funnel_metas: {
            qualificacoes_pct: 60,
            leads_qualificados_pct: 20,
            vendas_pct: 25,
          },
        },
      };

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Relatório de teste enviado! Verifique o grupo do WhatsApp.");
      } else {
        toast.error(`Erro no webhook: ${res.status}`);
      }
    } catch {
      toast.error("Não foi possível alcançar o webhook. Verifique o n8n.");
    } finally {
      setTesting(false);
    }
  };

  const set = (patch: Partial<ReportConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

  return (
    <Dialog open={!!client} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Relatório Automático
          </DialogTitle>
          {client && (
            <p className="text-sm text-muted-foreground">{client.name}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <div className="space-y-5 py-2">

            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
              <div>
                <p className="text-sm font-medium">Ativar disparo automático</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Envia o relatório no dia e horário configurados
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => set({ enabled: v })}
              />
            </div>

            {/* JID */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                JID do Grupo WhatsApp
              </Label>
              <Input
                placeholder="120363xxxxxxxxxx@g.us"
                value={config.whatsapp_jid}
                onChange={(e) => set({ whatsapp_jid: e.target.value })}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground/70">
                Cole o JID do grupo onde o relatório será enviado
              </p>
            </div>

            {/* Day + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Dia da semana
                </Label>
                <Select
                  value={String(config.send_day)}
                  onValueChange={(v) => set({ send_day: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Horário
                </Label>
                <Input
                  type="time"
                  value={config.send_time}
                  onChange={(e) => set({ send_time: e.target.value })}
                />
              </div>
            </div>

            {/* Metric source */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Fonte das métricas
              </Label>
              <div className="flex rounded-lg border border-border/40 overflow-hidden">
                <button
                  onClick={() => set({ metric_source: "ghl" })}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors border-r border-border/40 ${
                    config.metric_source === "ghl"
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  CRM
                  <span className="text-[10px] ml-1 opacity-60">(padrão)</span>
                </button>
                <button
                  onClick={() => set({ metric_source: "planilha" })}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    config.metric_source === "planilha"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Planilha
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={sendTest}
                disabled={testing || saving}
                className="flex-1 gap-2 border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 hover:border-amber-400/50"
              >
                <FlaskConical className="h-4 w-4" />
                {testing ? "Enviando..." : "Enviar Teste"}
              </Button>
              <Button
                onClick={save}
                disabled={saving || testing}
                className="flex-1 gap-2"
              >
                <Send className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
