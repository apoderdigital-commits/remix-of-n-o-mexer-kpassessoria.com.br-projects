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
import { Send, FlaskConical, CalendarDays, CalendarRange, CalendarClock } from "lucide-react";

const WEBHOOK_URL = "https://kpadm-n8n.a6hrr3.easypanel.host/webhook/relatorioautositekp";

interface Props {
  client: { id: string; name: string } | null;
  onClose: () => void;
}

interface ReportConfig {
  client_id: string;
  whatsapp_jid: string;
  enabled: boolean;
  metric_source: "ghl" | "planilha";
  daily_enabled: boolean;
  daily_days: number[];
  daily_time: string;
  weekly_enabled: boolean;
  weekly_day: number;
  weekly_time: string;
  monthly_enabled: boolean;
  monthly_day: number;
  monthly_time: string;
}

const WEEKDAYS = [
  { value: 0, short: "Dom", label: "Domingo" },
  { value: 1, short: "Seg", label: "Segunda-feira" },
  { value: 2, short: "Ter", label: "Terça-feira" },
  { value: 3, short: "Qua", label: "Quarta-feira" },
  { value: 4, short: "Qui", label: "Quinta-feira" },
  { value: 5, short: "Sex", label: "Sexta-feira" },
  { value: 6, short: "Sáb", label: "Sábado" },
];

const DEFAULT_CONFIG = (clientId: string): ReportConfig => ({
  client_id: clientId,
  whatsapp_jid: "",
  enabled: false,
  metric_source: "ghl",
  daily_enabled: false,
  daily_days: [],
  daily_time: "08:00",
  weekly_enabled: false,
  weekly_day: 1,
  weekly_time: "08:00",
  monthly_enabled: false,
  monthly_day: 1,
  monthly_time: "08:00",
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
      setConfig({ ...DEFAULT_CONFIG(client.id), ...(data ?? {}) });
      setLoading(false);
    })();
  }, [client]);

  const set = (patch: Partial<ReportConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

  const toggleDailyDay = (day: number) => {
    setConfig((c) => {
      const has = c.daily_days.includes(day);
      const next = has ? c.daily_days.filter((d) => d !== day) : [...c.daily_days, day].sort((a, b) => a - b);
      return { ...c, daily_days: next };
    });
  };

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
      const { data: clientData } = await (supabase as any)
        .from("clients")
        .select("meta_account_id, meta_token_id, ghl_api_key, ghl_location_id, google_sheet_id")
        .eq("id", client.id)
        .single();

      const until = new Date();
      const since = new Date();
      since.setDate(until.getDate() - 6);
      const fmt = (d: Date) => d.toISOString().split("T")[0];

      const payload = {
        test: true,
        report_type: "weekly",
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
          header: "📊 *Relatório - KP Assessoria*",
          funnel_metas: { qualificacoes_pct: 60, leads_qualificados_pct: 20, vendas_pct: 25 },
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

  return (
    <Dialog open={!!client} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Relatório Automático
          </DialogTitle>
          {client && <p className="text-sm text-muted-foreground">{client.name}</p>}
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-5 py-2">

            {/* Master enable */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
              <div>
                <p className="text-sm font-medium">Ativar disparos automáticos</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chave geral — desligue para pausar tudo sem perder a configuração
                </p>
              </div>
              <Switch checked={config.enabled} onCheckedChange={(v) => set({ enabled: v })} />
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
                    config.metric_source === "ghl" ? "bg-cyan-500/15 text-cyan-300" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  CRM <span className="text-[10px] ml-1 opacity-60">(padrão)</span>
                </button>
                <button
                  onClick={() => set({ metric_source: "planilha" })}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    config.metric_source === "planilha" ? "bg-emerald-500/15 text-emerald-300" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Planilha
                </button>
              </div>
            </div>

            <div className="border-t border-border/40 pt-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Frequência dos relatórios
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                Ative quantos quiser — pode combinar diário, semanal e mensal
              </p>
            </div>

            {/* ── DIÁRIO ── */}
            <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
              config.daily_enabled ? "border-blue-500/40 bg-blue-500/5" : "border-border/30 bg-muted/10"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium">Relatório Diário</span>
                </div>
                <Switch checked={config.daily_enabled} onCheckedChange={(v) => set({ daily_enabled: v })} />
              </div>
              {config.daily_enabled && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Dias de disparo</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => {
                        const active = config.daily_days.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            onClick={() => toggleDailyDay(d.value)}
                            className={`h-9 w-11 rounded-lg text-xs font-semibold transition-all ${
                              active
                                ? "bg-blue-500/20 text-blue-300 border border-blue-400/50"
                                : "bg-muted/30 text-muted-foreground border border-border/40 hover:border-blue-400/30"
                            }`}
                          >
                            {d.short}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60">
                      {config.daily_days.length === 0
                        ? "Nenhum dia selecionado = envia todos os dias"
                        : `Envia ${config.daily_days.length}x por semana`}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Horário</Label>
                    <Input
                      type="time"
                      value={config.daily_time}
                      onChange={(e) => set({ daily_time: e.target.value })}
                      className="w-32"
                    />
                  </div>
                </>
              )}
            </div>

            {/* ── SEMANAL ── */}
            <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
              config.weekly_enabled ? "border-violet-500/40 bg-violet-500/5" : "border-border/30 bg-muted/10"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-medium">Relatório Semanal</span>
                </div>
                <Switch checked={config.weekly_enabled} onCheckedChange={(v) => set({ weekly_enabled: v })} />
              </div>
              {config.weekly_enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Dia do envio</Label>
                    <Select value={String(config.weekly_day)} onValueChange={(v) => set({ weekly_day: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Horário</Label>
                    <Input type="time" value={config.weekly_time} onChange={(e) => set({ weekly_time: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            {/* ── MENSAL ── */}
            <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
              config.monthly_enabled ? "border-amber-500/40 bg-amber-500/5" : "border-border/30 bg-muted/10"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium">Relatório Mensal</span>
                </div>
                <Switch checked={config.monthly_enabled} onCheckedChange={(v) => set({ monthly_enabled: v })} />
              </div>
              {config.monthly_enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Dia do mês</Label>
                    <Select value={String(config.monthly_day)} onValueChange={(v) => set({ monthly_day: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={String(day)}>Dia {day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Horário</Label>
                    <Input type="time" value={config.monthly_time} onChange={(e) => set({ monthly_time: e.target.value })} />
                  </div>
                </div>
              )}
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
              <Button onClick={save} disabled={saving || testing} className="flex-1 gap-2">
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
