import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Users, DollarSign, TrendingUp, Banknote, ArrowDown } from 'lucide-react';

const TAXA_SIMULACOES = 60;
const TAXA_QUALIFICADOS = 20;
const TAXA_VENDAS = 25;

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (value: number) => Math.ceil(value).toLocaleString('pt-BR');

export function ReverseFunnel() {
  const [vendas, setVendas] = useState('30');
  const [ticketMedio, setTicketMedio] = useState('15000');
  const [cpl, setCpl] = useState('3');

  const vendasNum = parseInt(vendas) || 0;
  const ticketMedioNum = parseFloat(ticketMedio) || 0;
  const cplNum = parseFloat(cpl) || 0;

  const qualificados = vendasNum > 0 ? Math.ceil(vendasNum / (TAXA_VENDAS / 100)) : 0;
  const simulacoes = qualificados > 0 ? Math.ceil(qualificados / (TAXA_QUALIFICADOS / 100)) : 0;
  const leads = simulacoes > 0 ? Math.ceil(simulacoes / (TAXA_SIMULACOES / 100)) : 0;
  const investimento = leads * cplNum;
  const faturamento = vendasNum * ticketMedioNum;

  const funnelSteps = [
    { label: 'Investimento', value: formatCurrency(investimento), icon: DollarSign, gradient: 'from-slate-600 to-slate-700', textColor: 'text-slate-300' },
    { label: 'Leads', value: formatNumber(leads), icon: Users, gradient: 'from-blue-600 to-blue-700', textColor: 'text-blue-300' },
    { label: 'Simulações', value: formatNumber(simulacoes), subtitle: `${TAXA_SIMULACOES}% dos leads`, icon: TrendingUp, gradient: 'from-violet-600 to-violet-700', textColor: 'text-violet-300' },
    { label: 'Qualificados', value: formatNumber(qualificados), subtitle: `${TAXA_QUALIFICADOS}% das simulações`, icon: Target, gradient: 'from-purple-600 to-purple-700', textColor: 'text-purple-300' },
    { label: 'Vendas', value: formatNumber(vendasNum), subtitle: `${TAXA_VENDAS}% dos qualificados`, icon: Target, gradient: 'from-fuchsia-600 to-pink-600', textColor: 'text-fuchsia-300', highlight: true },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 shadow-lg flex items-center justify-center">
              <span className="text-xl">🎯</span>
            </div>
            Funil Reverso
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Informe a meta de vendas e o ticket médio — o sistema calcula o restante do funil automaticamente.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-2"><Target className="h-4 w-4" /> Meta de Vendas (qtd)</Label>
              <Input type="number" value={vendas} onChange={(e) => setVendas(e.target.value)} className="bg-background/50 border-border/50 text-lg font-semibold" placeholder="Ex: 30" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-2"><Banknote className="h-4 w-4" /> Ticket Médio (R$)</Label>
              <Input type="number" value={ticketMedio} onChange={(e) => setTicketMedio(e.target.value)} className="bg-background/50 border-border/50 text-lg font-semibold" placeholder="Ex: 15000" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> CPL (R$)</Label>
              <Input type="number" value={cpl} onChange={(e) => setCpl(e.target.value)} className="bg-background/50 border-border/50 text-lg font-semibold" placeholder="Ex: 3" />
            </div>
          </div>
          <div className="mt-4 px-4 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-muted-foreground">
            Taxas: Simulações {TAXA_SIMULACOES}% · Qualificados {TAXA_QUALIFICADOS}% · Vendas {TAXA_VENDAS}%
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {funnelSteps.map((step, index) => (
          <div key={step.label}>
            <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
              step.highlight ? 'bg-gradient-to-r from-fuchsia-900/40 to-pink-900/40 border-fuchsia-500/40 shadow-lg shadow-fuchsia-500/10' : 'bg-card/60 border-border/30'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${step.gradient} shadow-md`}>
                  <step.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className={`text-sm ${step.textColor}`}>{step.label}</p>
                  {step.subtitle && <p className="text-xs text-muted-foreground">{step.subtitle}</p>}
                </div>
              </div>
              <span className={`text-xl font-bold ${step.highlight ? 'text-fuchsia-300' : 'text-foreground'}`}>{step.value}</span>
            </div>
            {index < funnelSteps.length - 1 && (
              <div className="flex justify-center py-1"><ArrowDown className="h-4 w-4 text-muted-foreground/50" /></div>
            )}
          </div>
        ))}
      </div>

      <Card className="border-green-500/30 bg-gradient-to-r from-green-900/30 to-emerald-900/30 shadow-xl shadow-green-500/5">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                <Banknote className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-400">Faturamento Projetado</p>
                <p className="text-xs text-muted-foreground">{formatNumber(vendasNum)} vendas × {formatCurrency(ticketMedioNum)}</p>
              </div>
            </div>
            <span className="text-3xl font-bold text-green-400">{formatCurrency(faturamento)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
