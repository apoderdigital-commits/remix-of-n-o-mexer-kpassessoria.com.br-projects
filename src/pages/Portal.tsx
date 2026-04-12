import { Link } from "react-router-dom";
import { BarChart3, TrendingUp, Settings, LogOut, ChevronRight, Users } from "lucide-react";
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

export default function Portal() {
  const { isAdmin, signOut, user, dashboards } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";

  // Admin sees all, others see only their allowed dashboards
  const visibleProjects = isAdmin
    ? allProjects
    : allProjects.filter((p) => dashboards.includes(p.key));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 px-4 sm:px-6 h-14 sm:h-16 flex items-center">
        <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <img src={kpLogo} alt="KP Assessoria" className="h-8 w-8 rounded-lg" />
            <span className="text-sm sm:text-base font-semibold text-foreground hidden sm:inline">KP Assessoria</span>
          </div>
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
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8">
        <div className="max-w-[720px] w-full">
          <div className="mb-8">
            <p className="text-muted-foreground text-sm mb-1">Bem-vindo de volta{firstName ? `, ${firstName}` : ""}</p>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground tracking-tight">
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
                  <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-border/70 transition-all duration-200">
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
        </div>
      </main>

      <footer className="px-4 sm:px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground/40">KP Assessoria · Painel interno</p>
      </footer>
    </div>
  );
}
