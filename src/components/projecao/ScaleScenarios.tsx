import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Rocket, TrendingUp, Zap, Target, Crown, Banknote } from 'lucide-react';

const TAXA_SIMULACOES = 60;
const TAXA_QUALIFICADOS = 25;
const TAXA_VENDAS = 30;

export function ScaleScenarios() {
  const [baseInvestimento, setBaseInvestimento] = useState('10000');
  const [cpl, setCpl] = useState(15);
  const [ticketMedio, setTicketMedio] = useState('15000');

  const baseInvestimentoNum = parseFloat(baseInvestimento) || 0;
  const ticketMedioNum = parseFloat(ticketMedio) || 0;

  const calculateScenario = (multiplier: number) => {
    const investimento = baseInvestimentoNum * multiplier;
    const leads = cpl > 0 ? Math.floor(investimento / cpl) : 0;
    const simulacoes = Math.floor(leads * (TAXA_SIMULACOES / 100));
    const qualificados = Math.floor(simulacoes * (TAXA_QUALIFICADOS / 100));
    const vendas = Math.floor(qualificados * (TAXA_VENDAS / 100));
    const faturamento = vendas * ticketMedioNum;
    return { investimento, leads, simulacoes, qualificados, vendas, faturamento };
  };

  const scenarios = [
    { multiplier: 1, label: 'Base', icon: Target, gradient: 'from-slate-500 to-slate-600' },
    { multiplier: 1.5, label: '1.5x', icon: Zap, gradient: 'from-blue-500 to-cyan-500' },
    { multiplier: 2, label: '2x', icon: Rocket, gradient: 'from-violet-500 to-purple-600' },
    { multiplier: 3, label: '3x', icon: Crown, gradient: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg flex items-center justify-center">
              <span className="text-xl">🚀</span>
            </div>
            Configuração Base
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Investimento Base (R$)</Label>
              <Input type="number" placeholder="10000" value={baseInvestimento} onChange={(e) => setBaseInvestimento(e.target.value)}
                className="bg-background/50 border-border/50 focus:border-primary text-lg font-bold h-12" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Ticket Médio (R$)</Label>
              <Input type="number" placeholder="15000" value={ticketMedio} onChange={(e) => setTicketMedio(e.target.value)}
                className="bg-background/50 border-border/50 focus:border-primary text-lg font-bold h-12" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-muted-foreground text-sm">CPL</Label>
                <span className="font-bold text-accent">R$ {cpl.toFixed(2)}</span>
              </div>
              <Slider value={[cpl]} onValueChange={(v) => setCpl(v[0])} min={1} max={100} step={1} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/30">
              <span className="text-xs text-muted-foreground">Lead → Sim.</span>
              <span className="font-bold text-primary text-sm">60%</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/30">
              <span className="text-xs text-muted-foreground">Sim. → Qual.</span>
              <span className="font-bold text-accent text-sm">25%</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/30">
              <span className="text-xs text-muted-foreground">Qual. → Venda</span>
              <span className="font-bold text-primary text-sm">30%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {scenarios.map((scenario) => {
          const data = calculateScenario(scenario.multiplier);
          const isBase = scenario.multiplier === 1;
          const Icon = scenario.icon;
          
          return (
            <Card key={scenario.multiplier}
              className={`border-border/50 bg-gradient-to-br from-card to-card/80 shadow-xl transition-all hover:scale-105 hover:shadow-2xl ${!isBase ? 'ring-1 ring-primary/20' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${scenario.gradient} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className={`text-lg ${!isBase ? 'text-primary' : ''}`}>{scenario.label}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-background/30">
                    <span className="text-muted-foreground text-sm">Investimento</span>
                    <span className="font-bold">R$ {data.investimento.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-background/30">
                    <span className="text-muted-foreground text-sm">Leads</span>
                    <span className="font-bold">{data.leads.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-background/30">
                    <span className="text-muted-foreground text-sm">Qualificações Realizadas</span>
                    <span className="font-bold">{data.simulacoes.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-background/30">
                    <span className="text-muted-foreground text-sm">Qualificados</span>
                    <span className="font-bold">{data.qualificados.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                <div className={`flex justify-between items-center py-3 px-4 rounded-xl bg-gradient-to-r ${scenario.gradient}`}>
                  <span className="text-muted-foreground text-sm font-medium">Vendas</span>
                  <span className="font-bold text-foreground text-xl">{data.vendas.toLocaleString('pt-BR')}</span>
                </div>
                {ticketMedioNum > 0 && (
                  <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground text-sm font-medium">Faturamento</span>
                    </div>
                    <span className="font-bold text-foreground text-lg">R$ {data.faturamento.toLocaleString('pt-BR')}</span>
                  </div>
                )}
                {!isBase && (
                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium">
                    <TrendingUp className="h-4 w-4" />
                    +{((scenario.multiplier - 1) * 100).toFixed(0)}% investimento
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
