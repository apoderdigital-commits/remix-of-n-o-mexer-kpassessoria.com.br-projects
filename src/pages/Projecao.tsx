import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FunnelAnalysis } from '@/components/projecao/FunnelAnalysis';
import { FunnelComparison } from '@/components/projecao/FunnelComparison';
import { ScaleScenarios } from '@/components/projecao/ScaleScenarios';
import { ReverseFunnel } from '@/components/projecao/ReverseFunnel';
import { useAuth } from '@/hooks/useAuth';

import wallpaperKp from '@/assets/wallpaper-kp.png';
import kpLogo from '@/assets/kp-logo.png';
import { ArrowLeft, Calculator, GitCompare, Rocket, Target } from 'lucide-react';

export default function Projecao() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${wallpaperKp})` }} />
      <div className="fixed inset-0 bg-background/85 dark:bg-black/70 backdrop-blur-[2px]" />

      <header className="sticky top-0 z-50 bg-transparent">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <Button variant="outline" size="sm" className="bg-foreground/5 dark:bg-white/10 backdrop-blur-md border-border dark:border-white/20 text-foreground dark:text-white hover:bg-foreground/10 dark:hover:bg-white/20 hover:text-foreground dark:hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" /> Portal
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground dark:text-white/80 hidden sm:block px-4 py-2 rounded-full bg-foreground/5 dark:bg-white/10 backdrop-blur-md border border-border dark:border-white/20">
            {user?.email}
          </span>
        </div>
      </header>

      <section className="relative z-10 py-10 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-8">
            <div className="relative group">
              <div className="absolute -inset-3 bg-gradient-to-br from-purple-600/40 via-fuchsia-500/30 to-purple-800/40 rounded-[2rem] blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-80" />
              <div className="absolute -inset-1 bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 rounded-[1.8rem]" />
              <img src={kpLogo} alt="KP Assessoria" className="relative w-28 h-28 md:w-36 md:h-36 rounded-[1.5rem] object-cover shadow-2xl shadow-purple-900/50 border border-white/10" />
            </div>
          </div>

          <div className="inline-block mb-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/50 via-fuchsia-500/50 to-purple-600/50 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative px-12 py-4 bg-gradient-to-r from-purple-700/90 via-fuchsia-600/90 to-purple-700/90 rounded-full border border-purple-400/30 backdrop-blur-sm shadow-2xl shadow-purple-900/40">
                <span className="text-xl md:text-2xl font-bold text-white tracking-[0.15em] uppercase">KP Assessoria</span>
              </div>
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-3 tracking-tight leading-tight">
            Funil de Projeção de Vendas
          </h1>
          <p className="text-base md:text-lg text-white/50 max-w-xl mx-auto mb-12 font-light">
            Simule, compare e otimize suas estratégias de conversão
          </p>

          <div className="w-full mx-auto px-2">
            <Tabs defaultValue="calculator" className="space-y-8">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-black/80 backdrop-blur-xl border border-purple-500/30 p-2 rounded-2xl h-auto gap-2 shadow-2xl">
                <TabsTrigger value="calculator" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 text-white/70 rounded-xl py-3 px-4 transition-all duration-300 hover:text-white hover:bg-white/10">
                  <Calculator className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Análise & Histórico</span>
                  <span className="sm:hidden font-medium">Análise</span>
                </TabsTrigger>
                <TabsTrigger value="comparison" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 text-white/70 rounded-xl py-3 px-4 transition-all duration-300 hover:text-white hover:bg-white/10">
                  <GitCompare className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Comparativo</span>
                  <span className="sm:hidden font-medium">Comp.</span>
                </TabsTrigger>
                <TabsTrigger value="scale" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 text-white/70 rounded-xl py-3 px-4 transition-all duration-300 hover:text-white hover:bg-white/10">
                  <Rocket className="h-4 w-4" />
                  <span className="font-medium">Cenários</span>
                </TabsTrigger>
                <TabsTrigger value="reverse" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 text-white/70 rounded-xl py-3 px-4 transition-all duration-300 hover:text-white hover:bg-white/10">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Funil Reverso</span>
                  <span className="sm:hidden font-medium">Reverso</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-6">
                <div className="flex-1 bg-black/60 backdrop-blur-xl rounded-3xl border border-purple-500/20 shadow-2xl p-6 md:p-8">
                  <TabsContent value="calculator" className="mt-0"><FunnelAnalysis /></TabsContent>
                  <TabsContent value="comparison" className="mt-0"><FunnelComparison /></TabsContent>
                  <TabsContent value="scale" className="mt-0"><ScaleScenarios /></TabsContent>
                  <TabsContent value="reverse" className="mt-0"><ReverseFunnel /></TabsContent>
                </div>
              </div>
            </Tabs>
          </div>
        </div>
      </section>
    </div>
  );
}
