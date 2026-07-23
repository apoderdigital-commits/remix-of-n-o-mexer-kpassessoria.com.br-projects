import { useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LayoutDashboard, MessageSquare, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Hub() {
  const { user, loading, isAdmin, hasCrm, signOut } = useAuth();
  const navigate = useNavigate();

  // Dashboard access: admin, ou dashboards, ou é cliente, ou é squad
  const hasDashboard = isAdmin; // qualquer login não-CRM entra no Portal (que já filtra internamente)
  // Considera dashboard sempre disponível para qualquer usuário logado que não seja *apenas* CRM.
  // Estratégia: se o usuário tiver algum acesso além do CRM, mostra dashboard.
  // Simplificação: mostra dashboard se isAdmin OU (não é apenas CRM).
  // Para manter conservador: sempre mostra dashboard (o Portal já lida com falta de permissão).
  const showDashboard = true;
  const showCrm = hasCrm;

  useEffect(() => {
    if (loading || !user) return;
    // Se só tem uma opção disponível, redireciona direto — mas o usuário pediu "sempre mostrar hub".
    // Mantemos o hub visível.
  }, [loading, user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="px-6 h-16 flex items-center justify-between">
        <div className="text-sm font-semibold tracking-wide text-muted-foreground">KP · Central</div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => { void signOut(); navigate("/login"); }} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="max-w-3xl w-full text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Para onde você quer ir?</h1>
          <p className="mt-3 text-muted-foreground">Escolha uma das áreas abaixo para continuar.</p>
        </div>

        <div className={`grid gap-6 w-full max-w-4xl ${showCrm && showDashboard ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-md"}`}>
          {showDashboard && (
            <Link
              to="/"
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm hover:shadow-xl hover:border-primary/50 transition-all hover:-translate-y-1"
            >
              <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl group-hover:bg-primary/20 transition" />
              <div className="relative">
                <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                  <LayoutDashboard className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
                <p className="mt-2 text-sm text-muted-foreground">Métricas, criativos, projeções, squad e gestão de clientes.</p>
                <div className="mt-6 inline-flex items-center text-sm font-medium text-primary">
                  Entrar no Dashboard →
                </div>
              </div>
            </Link>
          )}

          {showCrm && (
            <Link
              to="/crm"
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm hover:shadow-xl hover:border-primary/50 transition-all hover:-translate-y-1"
            >
              <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl group-hover:bg-emerald-500/20 transition" />
              <div className="relative">
                <div className="h-14 w-14 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-5">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">CRM</h2>
                <p className="mt-2 text-sm text-muted-foreground">Conversas WhatsApp, contatos, grupos e atendimento em tempo real.</p>
                <div className="mt-6 inline-flex items-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Entrar no CRM →
                </div>
              </div>
            </Link>
          )}
        </div>

        {!showCrm && !isAdmin && (
          <p className="mt-8 text-xs text-muted-foreground">Precisa de acesso ao CRM? Fale com um administrador.</p>
        )}
      </main>
    </div>
  );
}
