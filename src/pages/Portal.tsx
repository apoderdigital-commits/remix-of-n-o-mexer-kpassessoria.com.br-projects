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
      <header className="border-b border-border/40 px-6 h-16 flex items-center">
        <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={kpLogo} alt="KP Assessoria" className="h-9 w-9 rounded-lg" />
            <span className="text-base font-semibold text-foreground">KP Assessoria</span>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <>
                <Link to="/clients">
                  <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <Settings className="h-4 w-4" /> Clientes
                  </Button>
                </Link>
                <Link to="/users">
                  <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <Users className="h-4 w-4" /> Usuários
                  </Button>
                </Link>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={signOut} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-[720px] w-full">
          <div className="mb-10">
            <p className="text-muted-foreground text-sm mb-1">Bem-vindo de volta{firstName ? `, ${firstName}` : ""}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
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
                  <div className="flex items-center gap-4 p-5 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-border/70 transition-all duration-200">
                    <div className={`shrink-0 w-11 h-11 rounded-xl ${project.iconBg} flex items-center justify-center`}>
                      <project.icon className="h-5 w-5 text-foreground/80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-semibold text-foreground leading-tight">{project.title}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground/40">KP Assessoria · Painel interno</p>
      </footer>
    </div>
  );
}
