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
      {/* Subtle gradient overlay — keeps image sharp */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-background/20" />


      {/* Bottom bar — full width */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-background/90 backdrop-blur-md border-t border-border/30">
        <div className="max-w-5xl mx-auto px-6 py-6 lg:py-8">
          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-3 mb-5">
            <img src={kpLogo} alt="KP Assessoria" className="h-10 w-10 rounded-xl shadow-lg" />
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">KP Assessoria</h2>
              <p className="text-xs text-foreground/60">Aceleradora de vendas</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
            {/* Desktop branding */}
            <div className="hidden lg:flex items-center gap-4 shrink-0">
              <img src={kpLogo} alt="KP Assessoria" className="h-12 w-12 rounded-xl shadow-lg" />
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight">KP Assessoria</h2>
                <p className="text-xs text-foreground/60">Aceleradora de vendas para lojas automotivas</p>
              </div>
            </div>

            {/* Divider desktop */}
            <div className="hidden lg:block w-px h-12 bg-border/40" />

            {/* Form area */}
            <div className="flex-1">
              <div className={`transition-all duration-200 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
                {step === "type" && (
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-3">Como você deseja acessar?</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => selectType("collaborator")}
                        className="flex-1 flex items-center gap-3 px-5 py-4 rounded-xl border border-primary/30 bg-card hover:border-primary/50 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.4)] transition-all duration-300 text-left group"
                      >
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Shield className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">Colaborador</p>
                          <p className="text-xs text-muted-foreground">Equipe interna</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </button>

                      <button
                        onClick={() => selectType("client")}
                        className="flex-1 flex items-center gap-3 px-5 py-4 rounded-xl border border-primary/30 bg-card hover:border-primary/50 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.4)] transition-all duration-300 text-left group"
                      >
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Briefcase className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">Cliente</p>
                          <p className="text-xs text-muted-foreground">Seus dashboards</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </button>
                    </div>
                  </div>
                )}

                {step === "username" && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <button type="button" onClick={goBack} className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                        <ArrowLeft className="h-3 w-3" /> Voltar
                      </button>
                      <span className="text-muted-foreground text-sm">· Entrar como {typeLabel}</span>
                    </div>
                    <form onSubmit={goToPassword} className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
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
                      <Button type="submit" className="h-12 px-8 text-sm font-medium gap-2 shrink-0">
                        Continuar <ArrowRight className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                )}

                {step === "password" && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <button type="button" onClick={goBack} className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                        <ArrowLeft className="h-3 w-3" /> {username}
                      </button>
                      <span className="text-muted-foreground text-sm">· Digite sua senha</span>
                    </div>
                    <form onSubmit={handleLogin} className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
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
                      <Button type="submit" className="h-12 px-8 text-sm font-medium shrink-0" disabled={loading}>
                        {loading ? "Entrando..." : "Entrar"}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 lg:mt-3">
            <div className={`h-1 w-8 rounded-full transition-all duration-300 ${step === "type" ? "bg-primary" : "bg-foreground/20"}`} />
            <div className={`h-1 w-8 rounded-full transition-all duration-300 ${step === "username" ? "bg-primary" : "bg-foreground/20"}`} />
            <div className={`h-1 w-8 rounded-full transition-all duration-300 ${step === "password" ? "bg-primary" : "bg-foreground/20"}`} />
            <span className="text-xs text-muted-foreground/50 ml-auto">Acesso restrito</span>
          </div>
        </div>
      </div>
    </div>
  );
}
