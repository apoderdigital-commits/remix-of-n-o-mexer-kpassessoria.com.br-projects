import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Save, TrendingUp, Users, Target, DollarSign, Calculator, Award, Sparkles, Banknote,
  History, Trash2, Calendar, ChevronDown, Share2, FolderOpen, Plus, Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Client {
  id: string;
  name: string;
  ticket_medio: number | null;
}

interface Simulation {
  id: string;
  client_name: string;
  investimento: number;
  cpl: number;
  leads: number;
  taxa_simulacoes: number;
  simulacoes: number;
  taxa_qualificados: number;
  qualificados: number;
  taxa_vendas: number;
  vendas: number;
  created_at: string;
  reference_month: number | null;
  reference_year: number | null;
  reference_week: number | null;
}

const TAXA_SIMULACOES = 60;
const TAXA_QUALIFICADOS = 20;
const TAXA_VENDAS = 20;

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
];

export function FunnelAnalysis() {
  const { user } = useAuth();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [customClientName, setCustomClientName] = useState('');
  
  const [investimento, setInvestimento] = useState('10000');
  const [cpl, setCpl] = useState('15');
  const [ticketMedio, setTicketMedio] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [saveMonth, setSaveMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [saveYear, setSaveYear] = useState<string>(String(new Date().getFullYear()));
  
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedSimulation, setSelectedSimulation] = useState<Simulation | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;
      const { data } = await supabase.from('clients').select('id, name, ticket_medio').order('name');
      setClients((data as any[]) || []);
    };
    fetchClients();
  }, [user]);

  useEffect(() => {
    const fetchSimulations = async () => {
      if (!user || !selectedClient || selectedClient === 'custom') {
        setSimulations([]);
        return;
      }
      
      setLoading(true);
      
      const { data, error } = await supabase
        .from('simulations')
        .select('*')
        .eq('client_id', selectedClient)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Erro ao carregar histórico');
      } else {
        setSimulations((data as any[]) || []);
      }
      setLoading(false);
    };

    fetchSimulations();
  }, [user, selectedClient]);

  useEffect(() => {
    if (selectedClient && selectedClient !== 'custom') {
      const client = clients.find(c => c.id === selectedClient);
      if (client?.ticket_medio) {
        setTicketMedio(String(client.ticket_medio));
      }
    }
  }, [selectedClient, clients]);

  const investimentoNum = parseFloat(investimento) || 0;
  const ticketMedioNum = parseFloat(ticketMedio) || 0;
  const cplNum = parseFloat(cpl) || 0;
  
  const leads = cplNum > 0 ? Math.floor(investimentoNum / cplNum) : 0;
  const simulacoes = Math.floor(leads * (TAXA_SIMULACOES / 100));
  const qualificados = Math.floor(simulacoes * (TAXA_QUALIFICADOS / 100));
  const vendas = Math.floor(qualificados * (TAXA_VENDAS / 100));
  const faturamentoProjetado = vendas * ticketMedioNum;
  const custoPorVenda = vendas > 0 ? investimentoNum / vendas : 0;
  const custoPorPreAtendimento = simulacoes > 0 ? investimentoNum / simulacoes : 0;
  const custoPorQualificado = qualificados > 0 ? investimentoNum / qualificados : 0;

  const clientName = selectedClient === 'custom' ? customClientName : clients.find(c => c.id === selectedClient)?.name || '';

  const availableMonths = [...new Set(simulations.map(sim => sim.reference_month).filter(m => m !== null))] as number[];
  const availableYears = [...new Set(simulations.map(sim => sim.reference_year).filter(y => y !== null))].sort((a, b) => (b as number) - (a as number)) as number[];

  const filteredSimulations = simulations.filter(sim => {
    if (selectedYear !== 'all' && sim.reference_year !== parseInt(selectedYear)) return false;
    if (selectedMonth !== 'all' && sim.reference_month !== parseInt(selectedMonth)) return false;
    return true;
  });

  const handleSave = async () => {
    if (!clientName.trim()) {
      toast.error('Selecione ou digite o nome do cliente');
      return;
    }

    setSaving(true);
    const { error, data } = await supabase.from('simulations').insert({
      user_id: user?.id,
      client_name: clientName,
      client_id: selectedClient !== 'custom' ? selectedClient : null,
      investimento: investimentoNum,
      cpl: cplNum,
      leads,
      taxa_simulacoes: TAXA_SIMULACOES,
      simulacoes,
      taxa_qualificados: TAXA_QUALIFICADOS,
      qualificados,
      taxa_vendas: TAXA_VENDAS,
      vendas,
      reference_month: parseInt(saveMonth),
      reference_year: parseInt(saveYear),
      reference_week: null,
    } as any).select();
    setSaving(false);

    if (error) {
      toast.error('Erro ao salvar projeção');
    } else {
      toast.success('Projeção salva com sucesso!');
      if (data && data.length > 0) {
        setSimulations([data[0] as any, ...simulations]);
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('simulations').delete().eq('id', id);
    
    if (error) {
      toast.error('Erro ao excluir simulação');
    } else {
      toast.success('Projeção excluída');
      setSimulations(simulations.filter((s) => s.id !== id));
      if (selectedSimulation?.id === id) {
        setSelectedSimulation(null);
      }
    }
  };

  const calculateCosts = (sim: Simulation) => {
    const investimento = Number(sim.investimento);
    const custoPorPreAtendimento = sim.simulacoes > 0 ? investimento / sim.simulacoes : 0;
    const custoPorQualificado = sim.qualificados > 0 ? investimento / sim.qualificados : 0;
    const custoPorVenda = sim.vendas > 0 ? investimento / sim.vendas : 0;
    const faturamento = sim.vendas * ticketMedioNum;
    return { custoPorPreAtendimento, custoPorQualificado, custoPorVenda, faturamento };
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const funnelSteps = [
    { label: 'Investimento', value: `R$ ${investimentoNum.toLocaleString('pt-BR')}`, icon: DollarSign, gradient: 'from-violet-500 to-purple-600' },
    { label: 'Leads', value: leads.toLocaleString('pt-BR'), icon: Users, gradient: 'from-purple-500 to-fuchsia-600' },
    { label: 'Qualificações Realizadas', value: simulacoes.toLocaleString('pt-BR'), subtext: `${TAXA_SIMULACOES}%`, costPerUnit: `R$ ${custoPorPreAtendimento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Calculator, gradient: 'from-fuchsia-500 to-pink-600' },
    { label: 'Qualificados', value: qualificados.toLocaleString('pt-BR'), subtext: `${TAXA_QUALIFICADOS}%`, costPerUnit: `R$ ${custoPorQualificado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Target, gradient: 'from-pink-500 to-rose-600' },
    { label: 'Vendas', value: vendas.toLocaleString('pt-BR'), subtext: `${TAXA_VENDAS}%`, icon: Award, gradient: 'from-rose-500 to-orange-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <Card className="border-purple-500/20 bg-neutral-900/50 shadow-xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[200px] bg-gradient-to-r from-purple-600 to-purple-700 border-purple-500/50 text-white">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-purple-500/30">
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id} className="text-white hover:bg-purple-600/20">
                    {client.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom" className="text-white hover:bg-purple-600/20">+ Digitar novo nome</SelectItem>
              </SelectContent>
            </Select>

            {selectedClient === 'custom' && (
              <Input
                placeholder="Nome do cliente"
                value={customClientName}
                onChange={(e) => setCustomClientName(e.target.value)}
                className="w-[180px] bg-neutral-900 border-neutral-700"
              />
            )}

            {selectedClient && selectedClient !== 'custom' && simulations.length > 0 && (
              <>
                <div className="h-8 w-px bg-white/20 mx-2" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[130px] bg-neutral-900 border-neutral-700">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700">
                    <SelectItem value="all">Todos</SelectItem>
                    {MONTHS.filter(m => availableMonths.includes(m.value)).map(month => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px] bg-neutral-900 border-neutral-700">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700">
                    <SelectItem value="all">Todos</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedClient ? (
        <Card className="border-purple-500/20 bg-neutral-900/50 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-purple-500/10 mb-4">
              <TrendingUp className="h-10 w-10 text-purple-400" />
            </div>
            <p className="text-lg text-white/70">Selecione um cliente para começar</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Inputs */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Investimento & CPL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Investimento (R$)</Label>
                  <Input type="number" placeholder="10000" value={investimento} onChange={(e) => setInvestimento(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary text-lg font-bold h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">CPL (Custo por Lead) (R$)</Label>
                  <Input type="number" step="0.01" placeholder="15.00" value={cpl} onChange={(e) => setCpl(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary text-lg font-bold h-12" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-accent" />
                  Ticket Médio & Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Ticket Médio (R$)</Label>
                  <Input type="number" placeholder="15000" value={ticketMedio} onChange={(e) => setTicketMedio(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary text-lg font-bold h-12" />
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
                  <p className="text-sm text-muted-foreground mb-1">Faturamento Projetado</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    R$ {faturamentoProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground font-medium">Taxas de Conversão (fixas):</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-background/30 text-center">
                      <p className="text-xs text-muted-foreground">Lead → Sim.</p>
                      <p className="font-bold text-primary">{TAXA_SIMULACOES}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background/30 text-center">
                      <p className="text-xs text-muted-foreground">Sim. → Qual.</p>
                      <p className="font-bold text-accent">{TAXA_QUALIFICADOS}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background/30 text-center">
                      <p className="text-xs text-muted-foreground">Qual. → Venda</p>
                      <p className="font-bold text-primary">{TAXA_VENDAS}%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Funnel Visualization Cards */}
          <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl">Funil Projetado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {funnelSteps.map((step, index) => (
                  <div key={step.label} className="relative group">
                    <div className="flex flex-col items-center p-4 rounded-2xl bg-background/30 border border-border/30 hover:border-primary/50 transition-all hover:scale-105 hover:shadow-lg">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${step.gradient} shadow-lg mb-3`}>
                        <step.icon className="h-6 w-6 text-white" />
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{step.label}</p>
                      <p className="text-lg md:text-xl font-bold text-foreground">{step.value}</p>
                      {step.subtext && <p className="text-sm text-muted-foreground mt-1">({step.subtext})</p>}
                      {step.costPerUnit && <p className="text-xs text-primary mt-1 font-medium">{step.costPerUnit}/un</p>}
                    </div>
                    {index < funnelSteps.length - 1 && (
                      <div className="hidden md:block absolute top-1/2 -right-3 text-muted-foreground/50 text-xl">→</div>
                    )}
                  </div>
                ))}
              </div>

              {ticketMedioNum > 0 && (
                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border border-primary/30 text-center">
                    <p className="text-lg font-medium text-foreground mb-2">💰 Faturamento Projetado</p>
                    <p className="text-4xl font-bold text-foreground">
                      R$ {faturamentoProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {vendas} vendas × R$ {ticketMedioNum.toLocaleString('pt-BR')} ticket médio
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-500/20 via-orange-500/20 to-rose-500/20 border border-rose-500/30 text-center">
                    <p className="text-lg font-medium text-foreground mb-2">💵 Custo por Venda</p>
                    <p className="text-4xl font-bold text-foreground">
                      R$ {custoPorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      R$ {investimentoNum.toLocaleString('pt-BR')} ÷ {vendas} vendas
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visual Funnel Shape */}
          <Card className="border-border/50 bg-gradient-to-br from-black via-neutral-900 to-black shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-xl flex items-center gap-2 text-white">
                <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
                Visualização do Funil
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-8 py-8">
              <div className="relative flex flex-col items-center space-y-3 py-4">
                <div className="relative group" style={{ width: '100%' }}>
                  <div className="relative rounded-t-3xl bg-gradient-to-r from-purple-600 via-violet-500 to-purple-600 px-6 py-5 border border-purple-400/15 shadow-lg">
                    <div className="relative flex items-center justify-between text-white gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/15">
                          <Users className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-purple-200 uppercase tracking-wider">Leads</p>
                          <p className="text-2xl md:text-3xl font-bold">{leads.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 bg-white/10 rounded-xl px-4 py-2">
                        <p className="text-xs text-purple-200 uppercase tracking-wider">CPL</p>
                        <p className="text-lg md:text-xl font-bold">R$ {cplNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-0.5 h-4 bg-gradient-to-b from-purple-500 to-fuchsia-500 rounded-full" />
                <div className="relative group" style={{ width: '85%' }}>
                  <div className="relative bg-gradient-to-r from-fuchsia-600 via-pink-500 to-fuchsia-600 px-6 py-5 rounded-2xl border border-fuchsia-400/15 shadow-lg">
                    <div className="relative flex items-center justify-between text-white gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/15">
                          <Calculator className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-fuchsia-200 uppercase tracking-wider">Pré-Atendimento</p>
                          <p className="text-xl md:text-2xl font-bold">{simulacoes.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 bg-white/10 rounded-xl px-4 py-2">
                        <p className="text-lg md:text-xl font-bold">{TAXA_SIMULACOES}%</p>
                        <p className="text-xs text-fuchsia-200">R$ {custoPorPreAtendimento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/un</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-0.5 h-4 bg-gradient-to-b from-fuchsia-500 to-pink-500 rounded-full" />
                <div className="relative group" style={{ width: '70%' }}>
                  <div className="relative bg-gradient-to-r from-pink-600 via-rose-500 to-pink-600 px-6 py-5 rounded-2xl border border-pink-400/15 shadow-lg">
                    <div className="relative flex items-center justify-between text-white gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/15">
                          <Target className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-pink-200 uppercase tracking-wider">Qualificados</p>
                          <p className="text-xl md:text-2xl font-bold">{qualificados.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 bg-white/10 rounded-xl px-4 py-2">
                        <p className="text-lg md:text-xl font-bold">{TAXA_QUALIFICADOS}%</p>
                        <p className="text-xs text-pink-200">R$ {custoPorQualificado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/un</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-0.5 h-4 bg-gradient-to-b from-pink-500 to-orange-500 rounded-full" />
                <div className="relative group" style={{ width: '55%' }}>
                  <div className="relative rounded-b-3xl bg-gradient-to-r from-rose-600 via-orange-500 to-rose-600 px-6 py-5 border border-orange-400/15 shadow-lg">
                    <div className="relative flex items-center justify-between text-white gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/15">
                          <Award className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-orange-200 uppercase tracking-wider">Vendas</p>
                          <p className="text-xl md:text-2xl font-bold">{vendas.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 bg-white/10 rounded-xl px-4 py-2">
                        <p className="text-lg md:text-xl font-bold">{TAXA_VENDAS}%</p>
                        <p className="text-xs text-orange-200">R$ {custoPorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/un</p>
                      </div>
                    </div>
                  </div>
                </div>

                {ticketMedioNum > 0 && (
                  <>
                    <div className="flex flex-col items-center mt-4">
                      <div className="w-0.5 h-6 bg-gradient-to-b from-orange-500 to-emerald-500 rounded-full" />
                      <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-emerald-500" />
                    </div>
                    <div className="relative group mt-2" style={{ width: '60%' }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl blur-xl opacity-25 group-hover:opacity-40 transition-opacity duration-500 animate-pulse" style={{ animationDuration: '2s' }} />
                      <div className="relative p-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 border border-emerald-400/18 shadow-lg text-white text-center">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-neutral-900 rounded-full border-2 border-emerald-400">
                          <span className="text-emerald-400 text-sm font-bold tracking-wider flex items-center gap-2">💰 FATURAMENTO</span>
                        </div>
                        <p className="text-2xl md:text-3xl font-bold mt-3 tracking-tight">
                          R$ {faturamentoProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm text-emerald-200 mt-2 font-medium">
                          {vendas} vendas × R$ {ticketMedioNum.toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save Section */}
          <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Save className="h-5 w-5 text-primary" />
                Salvar Análise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Mês</Label>
                  <Select value={saveMonth} onValueChange={setSaveMonth}>
                    <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(month => (
                        <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Ano</Label>
                  <Select value={saveYear} onValueChange={setSaveYear}>
                    <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-xl shadow-primary/25" size="lg">
                <Save className="mr-2 h-5 w-5" />
                {saving ? 'Salvando...' : 'Salvar Projeção'}
              </Button>
            </CardContent>
          </Card>

          {/* History */}
          {selectedClient && selectedClient !== 'custom' && (
            <Card className="border-purple-500/20 bg-neutral-900/50 shadow-xl">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center gap-3 text-xl text-white">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 shadow-lg">
                    <History className="h-5 w-5 text-white" />
                  </div>
                  Histórico de Análises
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-pulse text-white/60">Carregando histórico...</div>
                  </div>
                ) : filteredSimulations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-purple-500/10 mb-4">
                      <History className="h-8 w-8 text-purple-400" />
                    </div>
                    <p className="text-white/70">Nenhuma análise salva</p>
                    <p className="text-sm text-white/50 mt-1">Salve uma análise para ver o histórico</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSimulations.map((sim) => {
                      const costs = calculateCosts(sim);
                      const monthName = MONTHS.find(m => m.value === sim.reference_month)?.label || '';
                      
                      return (
                        <div key={sim.id}>
                          <Card 
                            className={`border-purple-500/20 bg-neutral-900/50 overflow-hidden cursor-pointer transition-all hover:bg-neutral-900/70 ${
                              selectedSimulation?.id === sim.id ? 'ring-2 ring-purple-500 bg-neutral-900/70' : ''
                            }`}
                            onClick={() => setSelectedSimulation(selectedSimulation?.id === sim.id ? null : sim)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center text-lg font-bold text-white">
                                    {sim.client_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-white">{sim.client_name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-white/50">
                                      <Calendar className="h-3 w-3" />
                                      {monthName} {sim.reference_year}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-xs text-white/50">Vendas</p>
                                    <p className="font-bold text-emerald-400">{sim.vendas}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-white/50">Faturamento</p>
                                    <p className="font-bold text-primary">R$ {costs.faturamento.toLocaleString('pt-BR')}</p>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(sim.id); }}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/20">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <ChevronDown className={`h-5 w-5 text-white/50 transition-transform ${selectedSimulation?.id === sim.id ? 'rotate-180' : ''}`} />
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {selectedSimulation?.id === sim.id && (
                            <Card className="mt-2 border-purple-500/20 bg-gradient-to-br from-black via-neutral-900 to-black shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                              <CardContent className="p-6">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                                  {[
                                    { label: 'Investimento', value: `R$ ${Number(sim.investimento).toLocaleString('pt-BR')}`, icon: DollarSign, gradient: 'from-violet-500 to-purple-600' },
                                    { label: 'Leads', value: sim.leads.toLocaleString('pt-BR'), icon: Users, gradient: 'from-purple-500 to-fuchsia-600' },
                                    { label: 'Qualificações Realizadas', value: sim.simulacoes.toLocaleString('pt-BR'), subtext: `${sim.taxa_simulacoes}%`, costPerUnit: `R$ ${costs.custoPorPreAtendimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Calculator, gradient: 'from-fuchsia-500 to-pink-600' },
                                    { label: 'Qualificados', value: sim.qualificados.toLocaleString('pt-BR'), subtext: `${sim.taxa_qualificados}%`, costPerUnit: `R$ ${costs.custoPorQualificado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Target, gradient: 'from-pink-500 to-rose-600' },
                                    { label: 'Vendas', value: sim.vendas.toLocaleString('pt-BR'), subtext: `${sim.taxa_vendas}%`, icon: Award, gradient: 'from-rose-500 to-orange-500' },
                                  ].map((step, index) => (
                                    <div key={step.label} className="relative">
                                      <div className="flex flex-col items-center p-4 rounded-2xl bg-background/30 border border-border/30">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${step.gradient} shadow-lg mb-3`}>
                                          <step.icon className="h-6 w-6 text-white" />
                                        </div>
                                        <p className="text-xs text-white/60 mb-1">{step.label}</p>
                                        <p className="text-lg font-bold text-white">{step.value}</p>
                                        {step.subtext && <p className="text-sm text-white/50 mt-1">({step.subtext})</p>}
                                        {step.costPerUnit && <p className="text-xs text-primary mt-1 font-medium">{step.costPerUnit}/un</p>}
                                      </div>
                                      {index < 4 && <div className="hidden md:block absolute top-1/2 -right-3 text-white/30 text-xl">→</div>}
                                    </div>
                                  ))}
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                  <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border border-primary/30 text-center">
                                    <p className="text-lg font-medium text-white mb-2">💰 Faturamento Projetado</p>
                                    <p className="text-4xl font-bold text-white">R$ {costs.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    <p className="text-sm text-white/60 mt-2">{sim.vendas} vendas × R$ {ticketMedioNum.toLocaleString('pt-BR')} ticket médio</p>
                                  </div>
                                  <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-500/20 via-orange-500/20 to-rose-500/20 border border-rose-500/30 text-center">
                                    <p className="text-lg font-medium text-white mb-2">💵 Custo por Venda</p>
                                    <p className="text-4xl font-bold text-white">R$ {costs.custoPorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="text-sm text-white/60 mt-2">R$ {Number(sim.investimento).toLocaleString('pt-BR')} ÷ {sim.vendas} vendas</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
