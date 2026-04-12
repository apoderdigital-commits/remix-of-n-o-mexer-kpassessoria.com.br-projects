import { Link } from "react-router-dom";
import { BarChart3, TrendingUp, Settings, LogOut, ChevronRight, Users, Rocket, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import kpLogo from "@/assets/kp-logo.png";

const allProjects = [
  {
    key: "criativos",
    title: "Dashboard de Criativos",
    description: "Performance de criativos, leads qualificados e métricas da Meta Ads",
    icon: BarChart3,
    href: "/criativos",
    iconBg: "bg-primary/15",
  },
  {
    key: "projecao",
    title: "Funil de Projeção de Vendas",
    description: "Simule, compare e otimize suas estratégias de conversão",
    icon: TrendingUp,
    href: "/projecao",
    iconBg: "bg-fuchsia-500/15",
  },
];

const highlights = [
  { icon: Rocket, text: "Aumente seu faturamento com dados reais" },
  { icon: Zap, text: "Otimize seus criativos automaticamente" },
  { icon: Target, text: "Projete vendas com precisão cirúrgica" },
];

export default function Portal() {
  const { isAdmin, signOut, user, dashboards } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";

  const visibleProjects = isAdmin
    ? allProjects
    : allProjects.filter((p) => dashboards.includes(p.key));

  return (
    <div className="min-h-screen flex relative">
      {/* Video background — mobile */}
      <video
        autoPlay loop muted playsInline
        className="fixed inset-0 w-full h-full object-cover lg:hidden"
        src="/videos/portal-bg.mp4"
      />
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm lg:hidden" />

      {/* Left side — video (desktop only) */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center">
        <video
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="/videos/portal-bg.mp4"
        />
        <div className="absolute inset-0 bg-background/50" />

        <div className="relative z-10 text-center px-12 max-w-md">
          <div className="mb-4">
            <img src={kpLogo} alt="KP Assessoria" className="h-[76px] w-[76px] rounded-2xl mx-auto shadow-2xl" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2 tracking-tight">KP Assessoria</h2>
          <p className="text-primary-foreground font-normal text-sm mb-8">
            Aceleradora de vendas para lojas automotivas
          </p>

          <div className="space-y-4 text-left">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-3 bg-card/20 backdrop-blur-md border border-border/20 rounded-xl px-4 py-3">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                  <h.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-foreground/90 font-medium">{h.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — content */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <header className="px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-end">
          <div className="flex items-center gap-0.5 sm:gap-1">
            {isAdmin && (
              <>
                <Link to="/clients">
                  <Button size="icon" variant="ghost" className="h-9 w-9 sm:h-auto sm:w-auto sm:px-3 sm:gap-1.5 text-muted-foreground hover:text-foreground">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm">Clientes</span>
                  </Button>
                </Link>
                <Link to="/users">
                  <Button size="icon" variant="ghost" className="h-9 w-9 sm:h-auto sm:w-auto sm:px-3 sm:gap-1.5 text-muted-foreground hover:text-foreground">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm">Usuários</span>
                  </Button>
                </Link>
              </>
            )}
            <Button size="icon" variant="ghost" onClick={signOut} className="h-9 w-9 sm:h-auto sm:w-auto sm:px-3 sm:gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Sair</span>
            </Button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8">
          <div className="w-full max-w-md">
            {/* Mobile branding */}
            <div className="lg:hidden flex flex-col items-center mb-8">
              <img src={kpLogo} alt="KP Assessoria" className="h-16 w-16 rounded-2xl shadow-2xl mb-3" />
              <h2 className="text-xl font-bold text-foreground tracking-tight">KP Assessoria</h2>
              <p className="text-xs mt-1 text-primary-foreground">Aceleradora de vendas para lojas automotivas</p>
            </div>

            {/* Glass card on mobile */}
            <div className="lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:shadow-none lg:p-0 bg-card/40 backdrop-blur-xl border border-border/30 rounded-2xl p-6 shadow-2xl">
              <div className="mb-6 lg:mb-8">
                <p className="text-muted-foreground text-sm mb-1">Bem-vindo de volta{firstName ? `, ${firstName}` : ""}</p>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  O que vamos analisar hoje?
                </h1>
              </div>

              <div className="grid gap-3">
                {visibleProjects.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum dashboard disponível para seu usuário.</p>
                    <p className="text-xs text-muted-foreground/60 mt-2">Entre em contato com o administrador.</p>
                  </div>
                ) : (
                  visibleProjects.map((project) => (
                    <Link key={project.href} to={project.href} className="group">
                      <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-primary/40 transition-all duration-200">
                        <div className={`shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${project.iconBg} flex items-center justify-center`}>
                          <project.icon className="h-5 w-5 text-foreground/80" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-sm font-semibold text-foreground leading-tight">{project.title}</h2>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">{project.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </Link>
                  ))
                )}
              </div>

              {/* Mobile highlights */}
              <div className="lg:hidden mt-8 space-y-3">
                {highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 bg-card/30 border border-border/20 rounded-xl px-4 py-3">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <h.icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-xs text-foreground/80 font-medium">{h.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground/40 text-center mt-6">
              KP Assessoria · Painel interno
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
