import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { buildProjecaoSvg, downloadProjecaoPng } from '@/lib/projecaoExport';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import {
  GitCompare, TrendingUp, TrendingDown, ArrowRight, Target as TargetIcon,
  DollarSign, Users, Calculator, Award, Rocket, Save, Building2, Calendar, FileText, Download } from 'lucide-react';

interface FunnelData {
  investimento: string; cpl: string; leads: string; preAtendimento: string; qualificados: string; vendas: string; vendasLoja: string; ticketMedio: string;
}

interface ProjetadoData extends FunnelData {
  taxaPre: string; taxaQual: string; taxaVendas: string;
}

interface Client { id: string; name: string; ticket_medio: number | null; }

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
];

const defaultFunnel = (): FunnelData => ({ investimento: '', cpl: '', leads: '', preAtendimento: '', qualificados: '', vendas: '', vendasLoja: '', ticketMedio: '' });
const defaultProjetado = (): ProjetadoData => ({ ...defaultFunnel(), taxaPre: '', taxaQual: '', taxaVendas: '' });
const parseNum = (v: string) => parseFloat(v.replace(',', '.')) || 0;

interface CalcResult {
  investimento: number; cpl: number; leads: number; preAtendimento: number;
  qualificados: number; vendas: number; ticketMedio: number;
  taxaPre: number; taxaQual: number; taxaVendas: number;
  custoPorPre: number; custoPorQual: number; custoPorVenda: number; faturamento: number;
}

function calcFunnel(f: FunnelData): CalcResult {
  const investimento = parseNum(f.investimento); const cpl = parseNum(f.cpl);
  const leads = parseNum(f.leads); const preAtendimento = parseNum(f.preAtendimento);
  const qualificados = parseNum(f.qualificados); const vendas = parseNum(f.vendas);
  const ticketMedio = parseNum(f.ticketMedio);
  const taxaPre = leads > 0 ? (preAtendimento / leads) * 100 : 0;
  const taxaQual = preAtendimento > 0 ? (qualificados / preAtendimento) * 100 : 0;
  const taxaVendas = qualificados > 0 ? (vendas / qualificados) * 100 : 0;
  const custoPorPre = preAtendimento > 0 ? investimento / preAtendimento : 0;
  const custoPorQual = qualificados > 0 ? investimento / qualificados : 0;
  const custoPorVenda = vendas > 0 ? investimento / vendas : 0;
  const faturamento = vendas * ticketMedio;
  return { investimento, cpl, leads, preAtendimento, qualificados, vendas, ticketMedio, taxaPre, taxaQual, taxaVendas, custoPorPre, custoPorQual, custoPorVenda, faturamento };
}

function calcDesejadoFunnel(data: FunnelData): CalcResult {
  const investimento = parseNum(data.investimento); const cpl = parseNum(data.cpl);
  const leads = cpl > 0 ? Math.round(investimento / cpl) : 0;
  const preAtendimento = Math.round(leads * 0.6);
  const qualificados = Math.round(preAtendimento * 0.2);
  const vendas = Math.round(qualificados * 0.2);
  const ticketMedio = parseNum(data.ticketMedio);
  const faturamento = vendas * ticketMedio;
  const custoPorVenda = vendas > 0 ? investimento / vendas : 0;
  const custoPorQual = qualificados > 0 ? investimento / qualificados : 0;
  const custoPorPre = preAtendimento > 0 ? investimento / preAtendimento : 0;
  return { investimento, cpl, leads, preAtendimento, qualificados, vendas, ticketMedio, taxaPre: 60, taxaQual: 20, taxaVendas: 20, custoPorPre, custoPorQual, custoPorVenda, faturamento };
}

function calcProjetadoFunnel(data: ProjetadoData): CalcResult {
  const investimento = parseNum(data.investimento); const cpl = parseNum(data.cpl);
  const leads = cpl > 0 ? Math.round(investimento / cpl) : 0;
  const taxaPre = parseNum(data.taxaPre); const taxaQual = parseNum(data.taxaQual); const taxaVendas = parseNum(data.taxaVendas);
  const preAtendimento = Math.round(leads * (taxaPre / 100));
  const qualificados = Math.round(preAtendimento * (taxaQual / 100));
  const vendas = Math.round(qualificados * (taxaVendas / 100));
  const ticketMedio = parseNum(data.ticketMedio);
  const faturamento = vendas * ticketMedio;
  const custoPorVenda = vendas > 0 ? investimento / vendas : 0;
  const custoPorQual = qualificados > 0 ? investimento / qualificados : 0;
  const custoPorPre = preAtendimento > 0 ? investimento / preAtendimento : 0;
  return { investimento, cpl, leads, preAtendimento, qualificados, vendas, ticketMedio, taxaPre, taxaQual, taxaVendas, custoPorPre, custoPorQual, custoPorVenda, faturamento };
}

function FunnelInput({ label, value, onChange, prefix, icon: Icon }: { label: string; value: string; onChange: (v: string) => void; prefix?: string; icon?: React.ElementType }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <Label className="text-xs text-muted-foreground">{label}</Label>
      </div>
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <Input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="border-0 bg-transparent p-0 h-auto text-sm font-bold text-white focus-visible:ring-0 focus-visible:ring-offset-0" />
      </div>
    </div>
  );
}

function FunnelReadonlyField({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <Label className="text-xs text-muted-foreground">{label}</Label>
      </div>
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 opacity-70">
        <span className="text-sm font-bold text-white">{value || '0'}</span>
      </div>
    </div>
  );
}

function RateDisplay({ value, color }: { value: string; color: string }) {
  return (
    <div className="flex items-end">
      <div className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-center">
        <p className="text-[10px] text-muted-foreground">Taxa</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function FunnelMetrics({ calc }: { calc: CalcResult }) {
  return (
    <div className="pt-3 border-t border-white/10 space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Faturamento</span>
        <span className="font-bold text-emerald-400">R$ {calc.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Custo/Venda</span>
        <span className="font-bold text-white">R$ {calc.custoPorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Custo/Qualificado</span>
        <span className="font-bold text-white">R$ {calc.custoPorQual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Custo/Pré-Atend.</span>
        <span className="font-bold text-white">R$ {calc.custoPorPre.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}

function GapIndicator({ atual, desejado }: { atual: number; desejado: number }) {
  if (desejado === 0 && atual === 0) return <span className="text-muted-foreground/50 text-xs">—</span>;
  const pct = desejado > 0 ? ((atual / desejado) * 100) : 0;
  const faltou = desejado - atual;
  if (pct >= 100) {
    return (
      <div className="text-center">
        <span className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-bold"><TrendingUp className="h-3 w-3" />{pct.toFixed(0)}%</span>
        <span className="text-[10px] text-emerald-400/70">Meta batida!</span>
      </div>
    );
  }
  return (
    <div className="text-center">
      <span className="flex items-center justify-center gap-1 text-amber-400 text-xs font-bold"><TrendingDown className="h-3 w-3" />{pct.toFixed(0)}%</span>
      <span className="text-[10px] text-red-400/70">Faltou: {faltou.toLocaleString('pt-BR')}</span>
    </div>
  );
}

function FunnelCardAtual({ data, onChange }: { data: FunnelData; onChange: (field: keyof FunnelData, value: string) => void }) {
  const calc = calcFunnel(data);
  return (
    <Card className="border-neutral-700/30 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-black dark:via-neutral-900 dark:to-black shadow-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-border dark:border-white/10">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 rounded-xl bg-gradient-to-br from-neutral-600 to-neutral-500 shadow-lg"><ArrowRight className="h-4 w-4 text-white" /></div>
          <span className="text-white">Funil Atual</span>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">O que realmente aconteceu no mês analisado</p>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FunnelInput label="Investimento" value={data.investimento} onChange={(v) => onChange('investimento', v)} prefix="R$" icon={DollarSign} />
          <FunnelInput label="CPL" value={data.cpl} onChange={(v) => onChange('cpl', v)} prefix="R$" icon={DollarSign} />
        </div>
        <FunnelInput label="Leads" value={data.leads} onChange={(v) => onChange('leads', v)} icon={Users} />
        <div className="grid grid-cols-2 gap-3">
          <FunnelInput label="Pré-Atendimento" value={data.preAtendimento} onChange={(v) => onChange('preAtendimento', v)} icon={Calculator} />
          <RateDisplay value={`${calc.taxaPre.toFixed(1)}%`} color="text-fuchsia-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FunnelInput label="Qualificados" value={data.qualificados} onChange={(v) => onChange('qualificados', v)} icon={TargetIcon} />
          <RateDisplay value={`${calc.taxaQual.toFixed(1)}%`} color="text-pink-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FunnelInput label="Vendas" value={data.vendas} onChange={(v) => onChange('vendas', v)} icon={Award} />
          <RateDisplay value={`${calc.taxaVendas.toFixed(1)}%`} color="text-orange-400" />
        </div>
        <FunnelInput label="Vendas Loja" value={data.vendasLoja} onChange={(v) => onChange('vendasLoja', v)} icon={Award} />
        <FunnelInput label="Ticket Médio" value={data.ticketMedio} onChange={(v) => onChange('ticketMedio', v)} prefix="R$" icon={DollarSign} />
        <FunnelMetrics calc={calc} />
      </CardContent>
    </Card>
  );
}

function FunnelCardDesejado({ data, onChange }: { data: FunnelData; onChange: (field: keyof FunnelData, value: string) => void }) {
  const calc = calcDesejadoFunnel(data);
  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-black dark:via-neutral-900 dark:to-black shadow-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-border dark:border-white/10">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-600 to-yellow-500 shadow-lg"><TargetIcon className="h-4 w-4 text-white" /></div>
          <span className="text-white">Funil Desejado</span>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">A meta que desejávamos atingir nesse mês</p>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FunnelInput label="Investimento" value={data.investimento} onChange={(v) => onChange('investimento', v)} prefix="R$" icon={DollarSign} />
          <FunnelInput label="CPL" value={data.cpl} onChange={(v) => onChange('cpl', v)} prefix="R$" icon={DollarSign} />
        </div>
        <FunnelReadonlyField label="Leads" value={String(calc.leads)} icon={Users} />
        <div className="grid grid-cols-2 gap-3">
          <FunnelReadonlyField label="Pré-Atendimento" value={String(calc.preAtendimento)} icon={Calculator} />
          <RateDisplay value="60.0%" color="text-fuchsia-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FunnelReadonlyField label="Qualificados" value={String(calc.qualificados)} icon={TargetIcon} />
          <RateDisplay value="20.0%" color="text-pink-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FunnelReadonlyField label="Vendas" value={String(calc.vendas)} icon={Award} />
          <RateDisplay value="20.0%" color="text-orange-400" />
        </div>
        <FunnelInput label="Vendas Loja" value={data.vendasLoja} onChange={(v) => onChange('vendasLoja', v)} icon={Award} />
        <FunnelInput label="Ticket Médio" value={data.ticketMedio} onChange={(v) => onChange('ticketMedio', v)} prefix="R$" icon={DollarSign} />
        <FunnelMetrics calc={calc} />
      </CardContent>
    </Card>
  );
}

function FunnelCardProjetado({ data, onChange }: { data: ProjetadoData; onChange: (field: keyof ProjetadoData, value: string) => void }) {
  const calc = calcProjetadoFunnel(data);
  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-black dark:via-neutral-900 dark:to-black shadow-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-border dark:border-white/10">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-lg"><Rocket className="h-4 w-4 text-white" /></div>
          <span className="text-white">Funil Projetado</span>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">O que projetamos para o mês seguinte</p>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FunnelInput label="Investimento" value={data.investimento} onChange={(v) => onChange('investimento', v)} prefix="R$" icon={DollarSign} />
          <FunnelInput label="CPL" value={data.cpl} onChange={(v) => onChange('cpl', v)} prefix="R$" icon={DollarSign} />
        </div>
        <FunnelReadonlyField label="Leads" value={String(calc.leads)} icon={Users} />
        <div className="grid grid-cols-2 gap-3">
          <FunnelReadonlyField label="Pré-Atendimento" value={String(calc.preAtendimento)} icon={Calculator} />
          <div className="flex items-end">
            <div className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <p className="text-[10px] text-muted-foreground">Taxa %</p>
              <Input type="text" value={data.taxaPre} onChange={(e) => onChange('taxaPre', e.target.value)}
                className="border-0 bg-transparent p-0 h-auto text-sm font-bold text-fuchsia-400 text-center focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="0" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FunnelReadonlyField label="Qualificados" value={String(calc.qualificados)} icon={TargetIcon} />
          <div className="flex items-end">
            <div className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <p className="text-[10px] text-muted-foreground">Taxa %</p>
              <Input type="text" value={data.taxaQual} onChange={(e) => onChange('taxaQual', e.target.value)}
                className="border-0 bg-transparent p-0 h-auto text-sm font-bold text-pink-400 text-center focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="0" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FunnelReadonlyField label="Vendas" value={String(calc.vendas)} icon={Award} />
          <div className="flex items-end">
            <div className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <p className="text-[10px] text-muted-foreground">Taxa %</p>
              <Input type="text" value={data.taxaVendas} onChange={(e) => onChange('taxaVendas', e.target.value)}
                className="border-0 bg-transparent p-0 h-auto text-sm font-bold text-orange-400 text-center focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="0" />
            </div>
          </div>
        </div>
        <FunnelInput label="Vendas Loja" value={data.vendasLoja} onChange={(v) => onChange('vendasLoja', v)} icon={Award} />
        <FunnelInput label="Ticket Médio" value={data.ticketMedio} onChange={(v) => onChange('ticketMedio', v)} prefix="R$" icon={DollarSign} />
        <FunnelMetrics calc={calc} />
      </CardContent>
    </Card>
  );
}

export function FunnelComparison() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [atual, setAtual] = useState<FunnelData>(defaultFunnel());
  const [desejado, setDesejado] = useState<FunnelData>(defaultFunnel());
  const [projetado, setProjetado] = useState<ProjetadoData>(defaultProjetado());
  const [saving, setSaving] = useState(false);
  const [actionNotes, setActionNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchClients = async () => {
      // Mesmos clientes da Dash do Squad
      const { data } = await supabase.from('squad_clients').select('id, name, contract_value').order('name');
      setClients(((data as any[]) || []).map((c) => ({ id: c.id, name: c.name, ticket_medio: c.contract_value ?? null })));
    };
    fetchClients();
  }, [user]);

  useEffect(() => {
    if (!selectedClientId || !selectedMonth || !selectedYear) return;
    const loadComparisons = async () => {
      const { data } = await supabase.from('comparisons').select('*')
        .eq('client_id', selectedClientId)
        .eq('reference_month', parseInt(selectedMonth))
        .eq('reference_year', parseInt(selectedYear));

      setAtual(defaultFunnel());
      setDesejado(defaultFunnel());
      setProjetado(defaultProjetado());
      setActionNotes('');

      const { data: notesData } = await supabase.from('comparison_notes').select('notes')
        .eq('client_id', selectedClientId)
        .eq('reference_month', parseInt(selectedMonth))
        .eq('reference_year', parseInt(selectedYear))
        .maybeSingle();
      if (notesData) setActionNotes((notesData as any).notes);

      if (data) {
        for (const row of data as any[]) {
          const fd: FunnelData = {
            investimento: String(row.investimento), cpl: String(row.cpl), leads: String(row.leads),
            preAtendimento: String(row.pre_atendimento), qualificados: String(row.qualificados),
            vendas: String(row.vendas), vendasLoja: (row as any).vendas_loja != null ? String((row as any).vendas_loja) : '', ticketMedio: String(row.ticket_medio),
          };
          if (row.tipo === 'atual') setAtual(fd);
          else if (row.tipo === 'desejado') setDesejado(fd);
          else if (row.tipo === 'projetado') {
            const leads = parseNum(String(row.leads));
            const preAt = parseNum(String(row.pre_atendimento));
            const qual = parseNum(String(row.qualificados));
            const vend = parseNum(String(row.vendas));
            setProjetado({
              ...fd,
              taxaPre: leads > 0 ? String(Math.round((preAt / leads) * 100)) : '',
              taxaQual: preAt > 0 ? String(Math.round((qual / preAt) * 100)) : '',
              taxaVendas: qual > 0 ? String(Math.round((vend / qual) * 100)) : '',
            });
          }
        }
      }
    };
    loadComparisons();
  }, [selectedClientId, selectedMonth, selectedYear]);

  const updateAtual = (field: keyof FunnelData, value: string) => setAtual(prev => ({ ...prev, [field]: value }));
  const updateDesejado = (field: keyof FunnelData, value: string) => setDesejado(prev => ({ ...prev, [field]: value }));
  const updateProjetado = (field: keyof ProjetadoData, value: string) => setProjetado(prev => ({ ...prev, [field]: value }));

  const handleExport = async () => {
    if (!selectedClientId) { toast.error('Selecione um cliente'); return; }
    const clientName = clients.find((c) => c.id === selectedClientId)?.name || 'Cliente';
    const monthLabel = MONTHS.find((m) => String(m.value) === selectedMonth)?.label || selectedMonth;
    const periodo = `${monthLabel} / ${selectedYear}`;
    const svg = buildProjecaoSvg(
      clientName, periodo,
      calcFunnel(atual), calcDesejadoFunnel(desejado), calcProjetadoFunnel(projetado)
    );
    const safe = clientName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    await downloadProjecaoPng(`projecao-${safe}-${selectedMonth}-${selectedYear}.png`, svg);
    toast.success('Projeção exportada! Agora você pode subir o arquivo na Reunião Mensal do cliente.');
  };

  const handleSave = async () => {
    if (!user || !selectedClientId || !selectedMonth || !selectedYear) {
      toast.error('Selecione um cliente, mês e ano');
      return;
    }
    setSaving(true);
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);

    const calcDes = calcDesejadoFunnel(desejado);
    const calcProj = calcProjetadoFunnel(projetado);

    const funnels = [
      { tipo: 'atual', data: atual, calc: calcFunnel(atual) },
      { tipo: 'desejado', data: desejado, calc: calcDes },
      { tipo: 'projetado', data: projetado, calc: calcProj },
    ];

    let vendasLojaMissing = false;
    for (const { tipo, data: fdata, calc } of funnels) {
      const row = {
        user_id: user.id,
        client_id: selectedClientId,
        tipo,
        investimento: calc.investimento,
        cpl: calc.cpl,
        leads: Math.round(calc.leads),
        pre_atendimento: Math.round(calc.preAtendimento),
        qualificados: Math.round(calc.qualificados),
        vendas: Math.round(calc.vendas),
        ticket_medio: calc.ticketMedio,
        reference_month: month,
        reference_year: year,
      };

      const { error } = await supabase.from('comparisons').upsert(row as any, { onConflict: 'client_id,tipo,reference_month,reference_year' });
      if (error) {
        console.error(error);
        toast.error(`Erro ao salvar ${tipo}`);
        setSaving(false);
        return;
      }
      // Vendas Loja (coluna opcional, livre — não entra no cálculo) — save resiliente
      const vl = (fdata.vendasLoja ?? '').trim() === '' ? null : parseNum(fdata.vendasLoja);
      const { error: vlErr } = await supabase.from('comparisons')
        .update({ vendas_loja: vl })
        .match({ client_id: selectedClientId, tipo, reference_month: month, reference_year: year });
      if (vlErr && /vendas_loja/.test(vlErr.message || '')) vendasLojaMissing = true;
    }
    if (vendasLojaMissing) toast('Salvo. O campo "Vendas Loja" precisa da migração (peça ao Lovable).');
    const { error: notesError } = await supabase.from('comparison_notes').upsert({
      user_id: user.id,
      client_id: selectedClientId,
      reference_month: month,
      reference_year: year,
      notes: actionNotes,
    } as any, { onConflict: 'client_id,reference_month,reference_year' });
    if (notesError) console.error('Error saving notes:', notesError);

    toast.success('Comparativos salvos com sucesso!');
    setSaving(false);
  };

  const calcAtual = calcFunnel(atual);
  const calcDes = calcDesejadoFunnel(desejado);
  const calcProj = calcProjetadoFunnel(projetado);

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);

  return (
    <div className="space-y-6">
      <Card className="border-purple-500/20 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-black dark:via-neutral-900 dark:to-black shadow-xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Cliente</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="bg-background border-border text-white"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> Mês</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px] bg-background border-border text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] bg-background border-border text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExport} disabled={!selectedClientId} variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
              <Download className="h-4 w-4 mr-2" /> Exportar PNG
            </Button>
            <Button onClick={handleSave} disabled={saving || !selectedClientId}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white shadow-lg">
              <Save className="h-4 w-4 mr-2" />{saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <FunnelCardAtual data={atual} onChange={updateAtual} />
        <FunnelCardDesejado data={desejado} onChange={updateDesejado} />
        <FunnelCardProjetado data={projetado} onChange={updateProjetado} />
      </div>

      <Card className="border-amber-500/20 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-black dark:via-neutral-900 dark:to-black shadow-xl">
        <CardHeader className="border-b border-border dark:border-white/10 pb-4">
          <CardTitle className="flex items-center gap-3 text-lg text-white">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-600 to-yellow-500 shadow-lg"><GitCompare className="h-4 w-4 text-white" /></div>
            Atual vs Desejado — O quanto batemos da meta?
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border dark:border-white/10">
                  <th className="text-left py-3 text-muted-foreground font-medium">Etapa</th>
                  <th className="text-center py-3 text-muted-foreground font-medium">Atual</th>
                  <th className="text-center py-3 text-amber-400/70 font-medium">Desejado</th>
                  <th className="text-center py-3 text-muted-foreground font-medium">% Atingido</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Investimento', atual: calcAtual.investimento, desejado: calcDes.investimento, currency: true },
                  { label: 'Leads', atual: calcAtual.leads, desejado: calcDes.leads },
                  { label: 'Pré-Atendimento', atual: calcAtual.preAtendimento, desejado: calcDes.preAtendimento },
                  { label: 'Qualificados', atual: calcAtual.qualificados, desejado: calcDes.qualificados },
                  { label: 'Vendas', atual: calcAtual.vendas, desejado: calcDes.vendas },
                  { label: 'Faturamento', atual: calcAtual.faturamento, desejado: calcDes.faturamento, currency: true },
                ].map(row => (
                  <tr key={row.label} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 text-muted-foreground font-medium">{row.label}</td>
                    <td className="py-3 text-center font-bold text-white">
                      {row.currency ? `R$ ${row.atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : row.atual.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 text-center font-bold text-amber-400">
                      {row.currency ? `R$ ${row.desejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : row.desejado.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3"><GapIndicator atual={row.atual} desejado={row.desejado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Taxas de Conversão</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Pré-Atend.', atual: calcAtual.taxaPre, desejado: calcDes.taxaPre },
                { label: 'Qualificados', atual: calcAtual.taxaQual, desejado: calcDes.taxaQual },
                { label: 'Vendas', atual: calcAtual.taxaVendas, desejado: calcDes.taxaVendas },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-bold text-white">{item.atual.toFixed(1)}%</span>
                    <span className="text-muted-foreground/50">→</span>
                    <span className="text-sm font-bold text-amber-400">{item.desejado.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-purple-500/20 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-black dark:via-neutral-900 dark:to-black shadow-xl">
        <CardHeader className="border-b border-border dark:border-white/10 pb-4">
          <CardTitle className="flex items-center gap-3 text-lg text-white">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-lg"><GitCompare className="h-4 w-4 text-white" /></div>
            Comparativo Geral — 3 Funis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border dark:border-white/10">
                  <th className="text-left py-3 text-muted-foreground font-medium">Etapa</th>
                  <th className="text-center py-3 text-muted-foreground font-medium">Atual</th>
                  <th className="text-center py-3 text-amber-400/70 font-medium">Desejado</th>
                  <th className="text-center py-3 text-purple-400/70 font-medium">Projetado</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Investimento', a: calcAtual.investimento, d: calcDes.investimento, p: calcProj.investimento, currency: true },
                  { label: 'CPL', a: calcAtual.cpl, d: calcDes.cpl, p: calcProj.cpl, currency: true },
                  { label: 'Leads', a: calcAtual.leads, d: calcDes.leads, p: calcProj.leads },
                  { label: 'Pré-Atendimento', a: calcAtual.preAtendimento, d: calcDes.preAtendimento, p: calcProj.preAtendimento },
                  { label: 'Qualificados', a: calcAtual.qualificados, d: calcDes.qualificados, p: calcProj.qualificados },
                  { label: 'Vendas', a: calcAtual.vendas, d: calcDes.vendas, p: calcProj.vendas },
                  { label: 'Faturamento', a: calcAtual.faturamento, d: calcDes.faturamento, p: calcProj.faturamento, currency: true },
                  { label: 'Custo/Venda', a: calcAtual.custoPorVenda, d: calcDes.custoPorVenda, p: calcProj.custoPorVenda, currency: true },
                ].map(row => (
                  <tr key={row.label} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 text-muted-foreground font-medium">{row.label}</td>
                    <td className="py-3 text-center font-bold text-white">
                      {row.currency ? `R$ ${row.a.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : row.a.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 text-center font-bold text-amber-400">
                      {row.currency ? `R$ ${row.d.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : row.d.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 text-center font-bold text-purple-400">
                      {row.currency ? `R$ ${row.p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : row.p.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-purple-500/20 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-black dark:via-neutral-900 dark:to-black shadow-xl">
        <CardHeader className="border-b border-border dark:border-white/10 pb-4">
          <CardTitle className="flex items-center gap-3 text-lg text-white">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 shadow-lg"><FileText className="h-4 w-4 text-white" /></div>
            Plano de Ação
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">Ações e estratégias para o mês projetado</p>
        </CardHeader>
        <CardContent className="pt-4">
          <Textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)}
            placeholder="Ex: Aumentar investimento em 20%, otimizar landing page, melhorar qualificação de leads..."
            className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 resize-y" />
          <p className="text-[10px] text-muted-foreground/50 mt-2">* As notas serão salvas junto com os comparativos ao clicar em "Salvar"</p>
        </CardContent>
      </Card>
    </div>
  );
}
