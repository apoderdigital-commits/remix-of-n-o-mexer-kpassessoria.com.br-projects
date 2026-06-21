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
import { Send } from "lucide-react";

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

            <Button onClick={save} disabled={saving} className="w-full mt-1">
              {saving ? "Salvando..." : "Salvar configuração"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
