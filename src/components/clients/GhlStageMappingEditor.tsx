import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Check } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type StageMapping = {
  /** Pipeline escolhida (GHL). Ausente nos clientes antigos → usa a primeira pipeline. */
  pipeline_id?: string;
  cpf_aprovado: string[];
  cpf_nao_aprovado: string[];
  vendas_financiamento: string[];
  vendas_consorcio: string[];
};

const EMPTY_MAPPING: StageMapping = {
  cpf_aprovado: [],
  cpf_nao_aprovado: [],
  vendas_financiamento: [],
  vendas_consorcio: [],
};

const METRICS: { key: keyof StageMapping; label: string; help: string }[] = [
  { key: "cpf_aprovado", label: "CPF Aprovado", help: "Etapas que indicam CPF aprovado" },
  { key: "cpf_nao_aprovado", label: "CPF Não Aprovado", help: "Etapas de reprovação/desqualificação" },
  { key: "vendas_financiamento", label: "Vendas Financiamento", help: "Etapas de venda via financiamento" },
  { key: "vendas_consorcio", label: "Vendas Consórcio", help: "Etapas de venda via consórcio" },
];

type Pipeline = { id: string; name: string; stages: { id: string; name: string }[] };

interface Props {
  clientId?: string | null;
  ghlApiKey: string;
  ghlLocationId: string;
  value: StageMapping;
  onChange: (m: StageMapping) => void;
}

export function GhlStageMappingEditor({ clientId, ghlApiKey, ghlLocationId, value, onChange }: Props) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const mapping = { ...EMPTY_MAPPING, ...value };
  const currentPipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const stages = currentPipeline?.stages ?? [];

  const fetchStages = async () => {
    if (!ghlApiKey.trim() || !ghlLocationId.trim()) {
      toast.error("Preencha a CRM API Key e o Location ID primeiro");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-ghl-stages", {
        body: {
          client_id: clientId ?? null,
          ghl_api_key: ghlApiKey.trim(),
          ghl_location_id: ghlLocationId.trim(),
        },
      });
      if (error) throw error;
      const all = (data?.pipelines ?? []) as Pipeline[];
      if (all.length === 0) {
        toast.error("Nenhum pipeline encontrado nessa subconta");
        return;
      }
      setPipelines(all);
      // Mantém a pipeline já salva no cliente; senão, usa a primeira (igual antes)
      const initial = value.pipeline_id && all.some((p) => p.id === value.pipeline_id)
        ? value.pipeline_id
        : all[0].id;
      setSelectedPipelineId(initial);
      setLoaded(true);
      toast.success(`${all.length} pipeline${all.length === 1 ? "" : "s"} carregada${all.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error("Erro ao buscar etapas: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const onPipelineChange = (pid: string) => {
    setSelectedPipelineId(pid);
    // Trocou de pipeline → as etapas marcadas eram de outra pipeline, então zera e grava a nova pipeline
    onChange({
      pipeline_id: pid,
      cpf_aprovado: [],
      cpf_nao_aprovado: [],
      vendas_financiamento: [],
      vendas_consorcio: [],
    });
  };

  const toggle = (metric: keyof StageMapping, stageId: string) => {
    const current = new Set(mapping[metric] as string[]);
    if (current.has(stageId)) current.delete(stageId);
    else current.add(stageId);
    // Sempre carimba a pipeline atual no mapeamento
    onChange({ ...mapping, pipeline_id: selectedPipelineId || mapping.pipeline_id, [metric]: Array.from(current) });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm">Mapeamento de Etapas (CRM)</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loaded
              ? `${pipelines.length} pipeline${pipelines.length === 1 ? "" : "s"} · escolha qual usar`
              : "Busque as pipelines e marque quais etapas contam para cada métrica"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={fetchStages}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {loaded ? "Recarregar" : "Buscar etapas"}
        </Button>
      </div>

      {loaded && pipelines.length > 0 && (
        <>
          {/* Seletor de pipeline */}
          <div className="space-y-1.5">
            <Label className="text-xs">Pipeline do CRM</Label>
            <Select value={selectedPipelineId} onValueChange={onPipelineChange}>
              <SelectTrigger className="bg-background/40">
                <SelectValue placeholder="Selecione a pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.stages.length} etapas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pipelines.length > 1 && (
              <p className="text-[10px] text-muted-foreground">
                Esse cliente tem {pipelines.length} pipelines. Escolha de qual puxar as etapas.
              </p>
            )}
          </div>

          {stages.length > 0 && (
            <div className="space-y-3 pt-1">
              {METRICS.map((m) => {
                const selected = mapping[m.key] as string[];
                return (
                  <div key={m.key} className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium">{m.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {selected.length} selecionada{selected.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {stages.map((s) => {
                        const isOn = selected.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggle(m.key, s.id)}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
                              isOn
                                ? "border-primary bg-primary/20 text-primary-foreground"
                                : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border"
                            }`}
                          >
                            {isOn && <Check className="h-3 w-3" />}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
