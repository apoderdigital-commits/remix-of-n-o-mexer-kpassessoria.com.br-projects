// Ritmo do mês: compara "como deveria estar até hoje" com "como está".
// A conta é proporcional aos DIAS ÚTEIS decorridos, não aos dias corridos —
// senão toda segunda-feira o mês pareceria atrasado sem ninguém ter falhado.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, TrendingUp, TrendingDown, Minus } from "lucide-react";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));

export interface MetaMes {
  competencia: string;
  meta_faturamento: number;
  meta_vendas: number;
  meta_mqls: number;
  meta_reunioes: number;
  meta_leads: number;
  considerar_dias_uteis: boolean;
}

/** Dias úteis (seg–sex) entre duas datas, inclusive. */
function diasUteis(de: Date, ate: Date) {
  let n = 0;
  const d = new Date(de.getFullYear(), de.getMonth(), de.getDate());
  while (d <= ate) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

interface Realizado {
  faturamento: number;
  vendas: number;
  mqls: number;
  /** Reunioes comparecidas de MQL (contato com tag lead a/b). */
  reunioes: number;
  leads: number;
}

interface Diagnostico {
  contatosCriadosNoMes: number;
  porClasse: Record<string, number>;
  comparecimentosTotais: number;
  pipelineEncontrada: string | null;
  etapaEncontrada: string | null;
  pipelinesDisponiveis: string[];
}

const VAZIO: Realizado = { faturamento: 0, vendas: 0, mqls: 0, reunioes: 0, leads: 0 };

export function RitmoDoMes({
  competencia,
  podeEditar,
}: {
  /** Primeiro dia do mês analisado, formato YYYY-MM-DD. */
  competencia: string;
  podeEditar: boolean;
}) {
  const [realizado, setRealizado] = useState<Realizado>(VAZIO);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroFonte, setErroFonte] = useState<string | null>(null);
  const [meta, setMeta] = useState<MetaMes | null>(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [semTabela, setSemTabela] = useState(false);
  const [form, setForm] = useState({
    faturamento: "0",
    vendas: "0",
    mqls: "0",
    reunioes: "0",
    leads: "0",
    uteis: true,
  });

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from("kp_comercial_metas_mes" as never)
        .select("*")
        .eq("competencia", competencia)
        .maybeSingle();
      if (!vivo) return;
      if (error) {
        // Tabela ainda não criada: o painel some em vez de quebrar a tela.
        if (/kp_comercial_metas_mes|does not exist|schema cache/i.test(error.message || "")) {
          setSemTabela(true);
        }
        setMeta(null);
        return;
      }
      const m = (data ?? null) as unknown as MetaMes | null;
      setMeta(m);
      setForm({
        faturamento: String(m?.meta_faturamento ?? 0),
        vendas: String(m?.meta_vendas ?? 0),
        mqls: String(m?.meta_mqls ?? 0),
        reunioes: String(m?.meta_reunioes ?? 0),
        leads: String(m?.meta_leads ?? 0),
        uteis: m?.considerar_dias_uteis ?? true,
      });
    })();
    return () => { vivo = false; };
  }, [competencia]);

  // Busca do mês inteiro, de propósito: o filtro de datas da tela não influencia.
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErroFonte(null);
    (async () => {
      const { data, error } = await supabase.functions.invoke("kp-comercial-ritmo", {
        body: { competencia },
      });
      if (!vivo) return;
      setCarregando(false);
      if (error || (data as any)?.error) {
        setErroFonte((data as any)?.error || error?.message || "Não foi possível ler o GHL.");
        setRealizado(VAZIO);
        return;
      }
      const d = data as any;
      setRealizado({
        faturamento: Number(d.faturamento) || 0,
        vendas: Number(d.vendas) || 0,
        mqls: Number(d.mqls) || 0,
        reunioes: Number(d.reunioes) || 0,
        leads: Number(d.leads) || 0,
      });
      setDiag(d.diagnostico ?? null);
    })();
    return () => { vivo = false; };
  }, [competencia]);

  const calculo = useMemo(() => {
    const ini = new Date(`${competencia}T00:00:00`);
    const fimMes = new Date(ini.getFullYear(), ini.getMonth() + 1, 0);
    const hoje = new Date();
    // Mês passado conta inteiro; mês futuro ainda não começou.
    const corte = hoje > fimMes ? fimMes : hoje < ini ? ini : hoje;
    const usarUteis = meta?.considerar_dias_uteis ?? true;

    const totais = usarUteis ? diasUteis(ini, fimMes) : fimMes.getDate();
    const passados = hoje < ini ? 0 : usarUteis ? diasUteis(ini, corte) : corte.getDate();
    const fracao = totais > 0 ? Math.min(1, passados / totais) : 0;

    const linhas = [
      { chave: "faturamento", rotulo: "Faturamento", meta: meta?.meta_faturamento ?? 0, real: realizado.faturamento, dinheiro: true },
      { chave: "vendas",      rotulo: "Vendas",      meta: meta?.meta_vendas ?? 0,      real: realizado.vendas,      dinheiro: false },
      { chave: "mqls",        rotulo: "MQLs",        meta: meta?.meta_mqls ?? 0,        real: realizado.mqls,        dinheiro: false },
      { chave: "reunioes",    rotulo: "Reuniões comparecidas", meta: meta?.meta_reunioes ?? 0, real: realizado.reunioes, dinheiro: false },
      { chave: "leads",       rotulo: "Leads",       meta: meta?.meta_leads ?? 0,       real: realizado.leads,       dinheiro: false },
    ].map((l) => {
      const esperado = l.meta * fracao;
      const dif = l.real - esperado;
      const pctMeta = l.meta > 0 ? (l.real / l.meta) * 100 : null;
      const pctRitmo = esperado > 0 ? (l.real / esperado) * 100 : null;
      return { ...l, esperado, dif, pctMeta, pctRitmo };
    });

    return { totais, passados, fracao, usarUteis, linhas, fimMes, iniciou: hoje >= ini };
  }, [meta, realizado, competencia]);

  async function salvar() {
    setSalvando(true);
    const payload = {
      competencia,
      meta_faturamento: Number(form.faturamento.replace(",", ".")) || 0,
      meta_vendas: Math.round(Number(form.vendas) || 0),
      meta_mqls: Math.round(Number(form.mqls) || 0),
      meta_reunioes: Math.round(Number(form.reunioes) || 0),
      meta_leads: Math.round(Number(form.leads) || 0),
      considerar_dias_uteis: form.uteis,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("kp_comercial_metas_mes" as never)
      .upsert(payload as never, { onConflict: "competencia" });
    setSalvando(false);
    if (error) {
      toast.error(
        /kp_comercial_metas_mes|does not exist|schema cache/i.test(error.message || "")
          ? "Falta a migração kp_comercial_metas_mes."
          : error.message,
      );
      return;
    }
    setMeta(payload as unknown as MetaMes);
    setAberto(false);
    toast.success("Meta do mês salva.");
  }

  if (semTabela) return null;

  const temMeta = calculo.linhas.some((l) => l.meta > 0);
  const fat = calculo.linhas[0];
  const acima = fat.dif >= 0;

  return (
    <Card className="relative overflow-hidden p-6 bg-card/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl shadow-black/20">
      <div
        className={`pointer-events-none absolute -top-24 right-1/4 h-64 w-64 rounded-full blur-3xl ${
          acima ? "bg-emerald-500/10" : "bg-amber-500/10"
        }`}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Ritmo do mês
          </div>
          <div className="text-lg font-semibold mt-0.5">Como deveria estar × como está</div>
          <p className="text-xs text-muted-foreground mt-1">
            {calculo.iniciou ? (
              <>
                {calculo.passados} de {calculo.totais}{" "}
                {calculo.usarUteis ? "dias úteis" : "dias"} decorridos ·{" "}
                <span className="tabular-nums">{(calculo.fracao * 100).toFixed(0)}%</span> do mês
              </>
            ) : (
              "Mês ainda não começou."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {carregando && <span className="text-xs text-muted-foreground">lendo o GHL…</span>}
          {erroFonte && <span className="text-xs text-amber-400">{erroFonte}</span>}
          {temMeta && calculo.iniciou && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                acima
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {acima ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {acima ? "Acima do ritmo" : "Abaixo do ritmo"}
            </span>
          )}
          {podeEditar && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAberto(true)}>
              <Settings className="h-4 w-4" /> Meta do mês
            </Button>
          )}
        </div>
      </div>

      {!temMeta ? (
        <div className="relative rounded-xl border border-dashed border-white/10 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma meta cadastrada para este mês.
          </p>
          {podeEditar && (
            <Button className="mt-3" size="sm" onClick={() => setAberto(true)}>
              Definir meta do mês
            </Button>
          )}
        </div>
      ) : (
        <div className="relative space-y-4">
          {/* Destaque do faturamento */}
          <div className="rounded-xl border border-white/5 bg-background/30 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Faturado no mês</div>
                <div className="text-3xl font-bold tabular-nums">{fmtBRL(fat.real)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  meta {fmtBRL(fat.meta)}
                  {fat.pctMeta !== null && (
                    <span className="tabular-nums"> · {fat.pctMeta.toFixed(0)}% da meta</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Deveria estar em</div>
                <div className="text-xl font-semibold tabular-nums text-muted-foreground">
                  {fmtBRL(fat.esperado)}
                </div>
                <div
                  className={`text-sm font-semibold tabular-nums mt-0.5 ${
                    acima ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {acima ? "+" : "−"}
                  {fmtBRL(Math.abs(fat.dif))} {acima ? "à frente" : "atrás"}
                </div>
              </div>
            </div>

            {/* Barra com o marcador de onde o ritmo deveria estar */}
            <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${acima ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, fat.meta > 0 ? (fat.real / fat.meta) * 100 : 0)}%` }}
              />
              {fat.meta > 0 && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-white/70"
                  style={{ left: `${Math.min(100, calculo.fracao * 100)}%` }}
                  title="Onde o ritmo deveria estar hoje"
                />
              )}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>início</span>
              <span>| marca = ritmo esperado hoje</span>
              <span>meta</span>
            </div>
          </div>

          {/* Demais indicadores */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Indicador</th>
                  <th className="pb-2 text-right font-medium">Deveria estar</th>
                  <th className="pb-2 text-right font-medium">Está</th>
                  <th className="pb-2 text-right font-medium">Diferença</th>
                  <th className="pb-2 text-right font-medium">% da meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {calculo.linhas.slice(1).map((l) => {
                  const ok = l.dif >= 0;
                  const fmt = l.dinheiro ? fmtBRL : fmtNum;
                  if (l.meta <= 0) return null;
                  return (
                    <tr key={l.chave}>
                      <td className="py-2">{l.rotulo}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(l.esperado)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmt(l.real)}</td>
                      <td className={`py-2 text-right tabular-nums ${ok ? "text-emerald-400" : "text-amber-400"}`}>
                        {ok ? "+" : "−"}{fmt(Math.abs(l.dif))}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {l.pctMeta !== null ? `${l.pctMeta.toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p>
              O esperado é proporcional aos {calculo.usarUteis ? "dias úteis" : "dias"} já decorridos.
              Se o mês acabou, o esperado é a meta cheia.
            </p>
            <p>
              Números do mês inteiro, direto do GHL — o filtro de datas acima não afeta este painel.
              Leads e MQLs vêm de contato + tag (<code>lead a/b/c/d</code>), não de oportunidade.
            </p>
            {diag && (
              <p>
                {diag.contatosCriadosNoMes} contato(s) criados no mês · A {diag.porClasse?.a ?? 0} ·
                B {diag.porClasse?.b ?? 0} · C {diag.porClasse?.c ?? 0} · D {diag.porClasse?.d ?? 0}
                {diag.pipelineEncontrada
                  ? ` · vendas de "${diag.pipelineEncontrada} › ${diag.etapaEncontrada ?? "?"}"`
                  : " · pipeline de vendas não encontrada"}
              </p>
            )}
            {diag && !diag.pipelineEncontrada && diag.pipelinesDisponiveis?.length > 0 && (
              <p className="text-amber-400">
                Pipelines disponíveis: {diag.pipelinesDisponiveis.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Cadastro da meta */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Meta do mês</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Faturamento (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.faturamento}
                  onChange={(e) => setForm({ ...form, faturamento: e.target.value })}
                />
              </div>
              <div>
                <Label>Vendas</Label>
                <Input
                  inputMode="numeric"
                  value={form.vendas}
                  onChange={(e) => setForm({ ...form, vendas: e.target.value })}
                />
              </div>
              <div>
                <Label>MQLs</Label>
                <Input
                  inputMode="numeric"
                  value={form.mqls}
                  onChange={(e) => setForm({ ...form, mqls: e.target.value })}
                />
              </div>
              <div>
                <Label>Reuniões comparecidas</Label>
                <Input
                  inputMode="numeric"
                  value={form.reunioes}
                  onChange={(e) => setForm({ ...form, reunioes: e.target.value })}
                />
              </div>
              <div>
                <Label>Leads</Label>
                <Input
                  inputMode="numeric"
                  value={form.leads}
                  onChange={(e) => setForm({ ...form, leads: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.uteis}
                onCheckedChange={(v) => setForm({ ...form, uteis: v })}
              />
              Considerar só dias úteis no ritmo
            </label>
            <p className="text-[11px] text-muted-foreground">
              Deixe ligado se a equipe não trabalha no fim de semana. Desligado, o ritmo
              esperado cresce todo dia, inclusive sábado e domingo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
