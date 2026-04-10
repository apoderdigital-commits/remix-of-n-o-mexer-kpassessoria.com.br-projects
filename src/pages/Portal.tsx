import { Link } from "react-router-dom";
import { BarChart3, TrendingUp, Plus, Settings, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import kpLogo from "@/assets/kp-logo.png";

const projects = [
  {
    title: "Dashboard de Criativos",
    description: "Performance de criativos, leads qualificados e métricas da Meta Ads",
    icon: BarChart3,
    href: "/criativos",
    color: "from-primary to-purple-400",
  },
  {
    title: "Funil de Projeção de Vendas",
    description: "Simule, compare e otimize suas estratégias de conversão",
    icon: TrendingUp,
    href: "/projecao",
    color: "from-fuchsia-500 to-pink-500",
  },
];

export default function Portal() {
  const { isAdmin, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={kpLogo} alt="KP Assessoria" className="h-10 w-10 rounded-lg" />
            <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              KP Assessoria
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/clients">
                <Button size="sm" variant="ghost" className="gap-2">
                  <Settings className="h-4 w-4" /> Clientes
                </Button>
              </Link>
            )}
            <Button size="sm" variant="ghost" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-[900px] w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Portal de Dashboards
            </h1>
            <p className="text-muted-foreground">
              Selecione o dashboard que deseja acessar
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.href} to={project.href}>
                <Card className="glass-card border-border/50 hover:border-primary/40 transition-all duration-300 hover:scale-[1.02] cursor-pointer h-full">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${project.color} flex items-center justify-center mb-2`}>
                      <project.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-lg">{project.title}</CardTitle>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}

            {/* Placeholder card for future projects */}
            <Card className="border-dashed border-2 border-border/30 bg-transparent flex items-center justify-center min-h-[180px] opacity-50">
              <CardContent className="flex flex-col items-center gap-2 text-muted-foreground p-6">
                <Plus className="h-8 w-8" />
                <span className="text-sm">Em breve</span>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
