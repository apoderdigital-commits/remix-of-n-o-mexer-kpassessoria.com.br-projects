import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Lock, User, Shield, Briefcase } from "lucide-react";
import kpLogo from "@/assets/kp-logo.png";
import teamBg from "@/assets/team-bg.jpg";

const EMAIL_DOMAIN = "@kp.local";

type LoginType = "collaborator" | "client" | null;
type Step = "type" | "username" | "password";

export default function Login() {
  const [loginType, setLoginType] = useState<LoginType>(null);
  const [step, setStep] = useState<Step>("type");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "password") setTimeout(() => passwordRef.current?.focus(), 350);
    if (step === "username") setTimeout(() => usernameRef.current?.focus(), 350);
  }, [step]);

  const goTo = (nextStep: Step) => {
    setAnimating(true);
    setTimeout(() => {
      setStep(nextStep);
      setAnimating(false);
    }, 200);
  };

  const selectType = (type: LoginType) => {
    setLoginType(type);
    goTo("username");
  };

  const goToPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    goTo("password");
  };

  const goBack = () => {
    if (step === "password") {
      setPassword("");
      goTo("username");
    } else if (step === "username") {
      setUsername("");
      setPassword("");
      goTo("type");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const email = username.trim().toLowerCase() + EMAIL_DOMAIN;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Usuário ou senha incorretos"
          : error.message === "Email not confirmed"
          ? "Conta não confirmada"
          : error.message
      );
    }
    setLoading(false);
  };

  const typeLabel = loginType === "collaborator" ? "colaborador" : "cliente";

  return (
    <div className="min-h-[100dvh] h-[100dvh] relative overflow-hidden">
      {/* Full-screen image background */}
      <img
        src={teamBg}
        alt="Equipe KP Assessoria"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />

      {/* Desktop branding — bottom left */}
      <div className="hidden lg:flex absolute bottom-0 left-0 z-20 p-10 pb-12 items-end gap-4">
        <img src={kpLogo} alt="KP Assessoria" className="h-14 w-14 rounded-2xl shadow-2xl" />
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">KP Assessoria</h2>
          <p className="text-sm text-foreground/70">Aceleradora de vendas para lojas automotivas</p>
          <div className="flex items-center gap-3 mt-3">
            <div className={`h-1 w-10 rounded-full transition-all duration-300 ${step === "type" ? "bg-primary" : "bg-foreground/20"}`} />
            <div className={`h-1 w-10 rounded-full transition-all duration-300 ${step === "username" ? "bg-primary" : "bg-foreground/20"}`} />
            <div className={`h-1 w-10 rounded-full transition-all duration-300 ${step === "password" ? "bg-primary" : "bg-foreground/20"}`} />
          </div>
        </div>
      </div>

      {/* Form — centered */}
      <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile branding */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="mb-4">
              <img src={kpLogo} alt="KP Assessoria" className="h-16 w-16 rounded-2xl shadow-2xl" />
            </div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">KP Assessoria</h2>
            <p className="text-xs mt-1 text-foreground/70">Aceleradora de vendas para lojas automotivas</p>
            <div className="mt-4 flex items-center gap-2 justify-center">
              <div className={`h-1 w-6 rounded-full transition-all duration-300 ${step === "type" ? "bg-primary" : "bg-foreground/20"}`} />
              <div className={`h-1 w-6 rounded-full transition-all duration-300 ${step === "username" ? "bg-primary" : "bg-foreground/20"}`} />
              <div className={`h-1 w-6 rounded-full transition-all duration-300 ${step === "password" ? "bg-primary" : "bg-foreground/20"}`} />
            </div>
          </div>

          {/* Glass card wrapper for mobile */}
          <div className="lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:shadow-none lg:p-0 bg-card/40 backdrop-blur-xl border border-border/30 rounded-2xl p-6 shadow-2xl">
            <div className="mb-6 lg:mb-8">
              <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">
                {step === "type" && "Acessar plataforma"}
                {step === "username" && `Entrar como ${typeLabel}`}
                {step === "password" && "Digite sua senha"}
              </h1>
              <p className="text-muted-foreground text-sm mt-1.5">
                {step === "type" && "Como você deseja acessar?"}
                {step === "username" && (
                  <button type="button" onClick={goBack} className="text-primary hover:underline inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Voltar
                  </button>
                )}
                {step === "password" && (
                  <button type="button" onClick={goBack} className="text-primary hover:underline inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> {username}
                  </button>
                )}
              </p>
            </div>

            <div className={`transition-all duration-200 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
              {step === "type" && (
                <div className="space-y-4">
                  <button
                    onClick={() => selectType("collaborator")}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent hover:from-primary/20 hover:via-primary/10 hover:border-primary/40 hover:shadow-[0_0_24px_-6px_hsl(var(--primary)/0.3)] transition-all duration-300 text-left group"
                  >
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-lg shadow-primary/10 group-hover:shadow-primary/20 group-hover:scale-105 transition-all duration-300">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground tracking-tight">Colaborador KP Assessoria</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Equipe interna — admin ou usuário</p>
                    </div>
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300">
                      <ArrowRight className="h-4 w-4 text-primary/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
                    </div>
                  </button>

                  <button
                    onClick={() => selectType("client")}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent hover:from-primary/20 hover:via-primary/10 hover:border-primary/40 hover:shadow-[0_0_24px_-6px_hsl(var(--primary)/0.3)] transition-all duration-300 text-left group"
                  >
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-lg shadow-primary/10 group-hover:shadow-primary/20 group-hover:scale-105 transition-all duration-300">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground tracking-tight">Entrar como Cliente</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Acesse os dashboards da sua operação</p>
                    </div>
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300">
                      <ArrowRight className="h-4 w-4 text-primary/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
                    </div>
                  </button>
                </div>
              )}

              {step === "username" && (
                <form onSubmit={goToPassword} className="space-y-5">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={usernameRef}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="seu.usuario"
                      required
                      autoFocus
                      className="pl-10 h-12 text-sm bg-secondary/50 border-border/60 focus:border-primary/50"
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 text-sm font-medium gap-2">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              )}

              {step === "password" && (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={passwordRef}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pl-10 h-12 text-sm bg-secondary/50 border-border/60 focus:border-primary/50"
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 text-sm font-medium" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 text-center mt-6">
            Acesso restrito a usuários autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
