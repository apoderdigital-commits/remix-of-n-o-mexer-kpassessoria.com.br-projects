import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Portal from "./pages/Portal.tsx";
import Criativos from "./pages/Criativos.tsx";
import Projecao from "./pages/Projecao.tsx";
import Clients from "./pages/Clients.tsx";
import UsersPage from "./pages/UsersPage.tsx";
import Squad from "./pages/Squad.tsx";
import SquadAdmin from "./pages/SquadAdmin.tsx";
import Comercial from "./pages/Comercial.tsx";
import Tarefas from "./pages/Tarefas.tsx";
import Login from "./pages/Login.tsx";
import NotFound from "./pages/NotFound.tsx";
import ClientView from "./pages/ClientView.tsx";
import { SupportWhatsAppButton } from "./components/SupportWhatsAppButton";
import { NewThemeAnnouncement } from "./components/NewThemeAnnouncement";
import { VersionGate } from "./components/VersionGate";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false, dashboardKey }: { children: React.ReactNode; adminOnly?: boolean; dashboardKey?: string }) {
  const { user, loading, isAdmin, dashboards } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  if (dashboardKey && !isAdmin && !dashboards.includes(dashboardKey)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route path="/" element={<ProtectedRoute><Portal /></ProtectedRoute>} />
    <Route path="/criativos" element={<ProtectedRoute dashboardKey="criativos"><Criativos /></ProtectedRoute>} />
    <Route path="/projecao" element={<ProtectedRoute dashboardKey="projecao"><Projecao /></ProtectedRoute>} />
    <Route path="/clients" element={<ProtectedRoute adminOnly><Clients /></ProtectedRoute>} />
    <Route path="/users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
    <Route path="/squad" element={<ProtectedRoute><Squad /></ProtectedRoute>} />
    <Route path="/squad/admin" element={<ProtectedRoute adminOnly><SquadAdmin /></ProtectedRoute>} />
    <Route path="/comercial" element={<ProtectedRoute><Comercial /></ProtectedRoute>} />
    <Route path="/tarefas" element={<ProtectedRoute><Tarefas /></ProtectedRoute>} />
    {/* Rota pública — iframe embutido no GHL por subconta */}
    <Route path="/view" element={<ClientView />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="kp-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <VersionGate />
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
          <SupportWhatsAppButton />
          <NewThemeAnnouncement />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
