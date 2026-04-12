import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Lock, User, Shield, Users, Briefcase } from "lucide-react";
import kpLogo from "@/assets/kp-logo.png";

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
    <div className="min-h-screen flex">
      {/* Left side — branding */}
      <div
        className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center"
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="/videos/login-bg.mp4"
        />
        <div className="absolute inset-0 bg-background/60" />

        <div className="relative z-10 text-center px-12 max-w-md" style={{ marginTop: "-40%" }}>
          <div className="mb-8">
            <img src={kpLogo} alt="KP Assessoria" className="h-20 w-20 rounded-2xl mx-auto shadow-2xl" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-3 tracking-tight">KP Assessoria</h2>
          <p className="text-muted-foreground leading-relaxed">
            Plataforma integrada de performance, projeções e inteligência de dados para sua operação.
          </p>
          <div className="mt-10 flex items-center gap-3 justify-center">
            <div className={`h-1 w-8 rounded-full ${step === "type" ? "bg-primary/60" : "bg-primary/20"}`} />
            <div className={`h-1 w-8 rounded-full ${step === "username" ? "bg-primary/60" : "bg-primary/20"}`} />
            <div className={`h-1 w-8 rounded-full ${step === "password" ? "bg-primary/60" : "bg-primary/20"}`} />
          </div>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <img src={kpLogo} alt="KP Assessoria" className="h-10 w-10 rounded-xl" />
            <span className="text-lg font-semibold text-foreground">KP Assessoria</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
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
              <div className="space-y-3">
                <button
                  onClick={() => selectType("collaborator")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-primary/40 transition-all duration-200 text-left group"
                >
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Colaborador KP Assessoria</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Equipe interna — admin ou usuário</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => selectType("client")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-primary/40 transition-all duration-200 text-left group"
                >
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-fuchsia-500/15 flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-fuchsia-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Entrar como Cliente</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Acesse os dashboards da sua operação</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-fuchsia-400 group-hover:translate-x-0.5 transition-all" />
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

          <p className="text-xs text-muted-foreground/60 text-center mt-8">
            Acesso restrito a usuários autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
