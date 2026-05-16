import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Lock, User, Shield, Briefcase, AlertTriangle } from "lucide-react";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import kpLogo from "@/assets/kp-logo.png";
import brazilFlag from "@/assets/brazil-flag.png";
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
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [screenTransition, setScreenTransition] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Force autoplay on mobile
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.play().catch(() => {});
    };

    video.load();
    tryPlay();

    // Retry on visibility change (e.g. tab focus)
    const onVisibility = () => {
      if (!document.hidden) tryPlay();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Retry on user interaction (some mobile browsers require it)
    const onInteraction = () => {
      tryPlay();
      window.removeEventListener("touchstart", onInteraction);
      window.removeEventListener("click", onInteraction);
    };
    window.addEventListener("touchstart", onInteraction, { once: true });
    window.addEventListener("click", onInteraction, { once: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("touchstart", onInteraction);
      window.removeEventListener("click", onInteraction);
    };
  }, []);

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
    setScreenTransition(true);
    setTimeout(() => {
      goTo("username");
      setScreenTransition(false);
    }, 500);
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
      setLoginType(null);
      goTo("type");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const email = username.trim().toLowerCase() + EMAIL_DOMAIN;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setFailedAttempts((n) => n + 1);
      toast.error(
        error.message === "Invalid login credentials"
          ? "Usuário ou senha incorretos"
          : error.message === "Email not confirmed"
          ? "Conta não confirmada"
          : error.message
      );
    } else {
      setFailedAttempts(0);
    }
    setLoading(false);
  };

  const typeLabel = loginType === "collaborator" ? "colaborador" : "cliente";
  const isCredentialStep = step === "username" || step === "password";

  // Both screens rendered together — video always mounted for preloading
  return (
    <div className="min-h-[100dvh] h-[100dvh] relative overflow-hidden">
      {/* Preloaded video — always in DOM, hidden on screen 1 */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        src="/videos/login-bg.mp4"
        className={`fixed inset-0 w-full h-full object-cover transition-opacity duration-500 lg:w-[45%] lg:right-auto ${isCredentialStep ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ zIndex: 0 }}
      />

      {/* Screen 1: Type selection with team photo */}
      <div
        className={`absolute inset-0 flex flex-col transition-all duration-500 ${
          isCredentialStep ? "opacity-0 pointer-events-none scale-105" : "opacity-100 scale-100"
        } ${screenTransition ? "opacity-0 scale-105" : ""}`}
        style={{ zIndex: isCredentialStep ? 0 : 10 }}
      >
        {/* Team image */}
        <div className="lg:absolute lg:inset-0 shrink-0">
          <img
            src={teamBg}
            alt="Equipe KP Assessoria"
            className="w-full h-full object-cover object-center lg:absolute lg:inset-0"
            style={{ aspectRatio: '16/9' }}
          />
          <div className="hidden lg:block absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-background/20" />
        </div>

        {/* Bottom bar */}
        <div className="flex-1 lg:flex-none lg:absolute lg:bottom-0 lg:left-0 lg:right-0 z-10 bg-background border-t border-border/30 lg:bg-background/90 lg:backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-6 py-5 lg:py-8 flex flex-col h-full lg:h-auto">
            {/* Mobile branding */}
            <div className="lg:hidden flex items-center gap-3 mb-3">
              <img src={kpLogo} alt="KP Assessoria" className="h-10 w-10 rounded-xl shadow-lg" />
              <div>
                <h2 className="text-sm font-bold text-foreground tracking-tight">KP Assessoria</h2>
                <p className="text-xs text-foreground/60">Aceleradora de vendas</p>
              </div>
            </div>

            {/* Motivational phrase + description — mobile */}
            <div className="lg:hidden flex-1 flex flex-col items-center justify-center text-center mb-4 relative">
              <img src={brazilFlag} alt="Brasil" className="absolute w-[450%] h-auto object-contain opacity-15 pointer-events-none z-0 top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 rotate-[15deg]" />
              <div className="relative z-10">
                <p className="text-xl font-black text-foreground/90 uppercase tracking-wide leading-tight">
                  Resultado não é opção
                </p>
                <p className="text-xl font-black text-primary uppercase tracking-wide leading-tight">
                  É obrigação!
                </p>

                <p className="mt-4 max-w-[280px] leading-relaxed text-foreground/80 text-base font-medium mx-auto">
                  Uma dashboard completa que te traz previsibilidade de verdade de saber o que está dando certo para escalar ainda mais as vendas!
                </p>
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

              <div className="hidden lg:block w-px h-12 bg-border/40" />

              {/* Motivational phrase — desktop */}
              <div className="hidden lg:flex items-center gap-2 shrink-0">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground/70 leading-tight">
                  <span>Resultado não é opção.</span>
                  <br />
                  <span className="text-primary">É obrigação!</span>
                  <span className="ml-1">🇧🇷</span>
                </div>
              </div>

              <div className="hidden lg:block w-px h-12 bg-border/40" />

              {/* Type selection */}
              <div className="flex-1">
                <div className={`transition-all duration-200 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
                  <p className="text-sm font-semibold text-foreground mb-3">Como você deseja acessar?</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => selectType("collaborator")}
                      className="flex-1 flex items-center gap-4 px-5 py-3.5 rounded-lg border border-border/60 bg-secondary/80 hover:bg-secondary hover:border-primary/40 transition-all duration-200 text-left group"
                    >
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Colaborador</p>
                        <p className="text-[11px] text-muted-foreground">Equipe interna</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>

                    <button
                      onClick={() => selectType("client")}
                      className="flex-1 flex items-center gap-4 px-5 py-3.5 rounded-lg border border-border/60 bg-secondary/80 hover:bg-secondary hover:border-primary/40 transition-all duration-200 text-left group"
                    >
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                        <Briefcase className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Cliente</p>
                        <p className="text-[11px] text-muted-foreground">Seus dashboards</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 lg:mt-3">
              <div className="h-1 w-8 rounded-full bg-primary transition-all duration-300" />
              <div className="h-1 w-8 rounded-full bg-foreground/20 transition-all duration-300" />
              <div className="h-1 w-8 rounded-full bg-foreground/20 transition-all duration-300" />
              <span className="text-xs text-muted-foreground/50 ml-auto">Acesso restrito</span>
            </div>
          </div>
        </div>
      </div>

      {/* Screen 2: Credentials — overlaid on video */}
      <div
        className={`absolute inset-0 flex transition-all duration-500 ${
          isCredentialStep ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: isCredentialStep ? 10 : 0 }}
      >
        {/* Video overlay — mobile */}
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm lg:hidden" style={{ zIndex: 1 }} />

        {/* Left side — video (desktop only) */}
        <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-start justify-center">
          <div className="absolute inset-0 bg-background/30" />
          <div className="relative z-10 text-center px-8 pt-10">
            <img src={kpLogo} alt="KP Assessoria" className="h-20 w-20 rounded-2xl shadow-2xl mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground tracking-tight">KP Assessoria</h1>
            <p className="text-base text-foreground/70 mt-1">Aceleradora de vendas para lojas automotivas!</p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <div className="h-1 w-8 rounded-full bg-primary/40" />
              <div className={`h-1 w-8 rounded-full ${step === "username" ? "bg-primary" : "bg-foreground/20"}`} />
              <div className={`h-1 w-8 rounded-full ${step === "password" ? "bg-primary" : "bg-foreground/20"}`} />
            </div>
          </div>
        </div>

        {/* Right side — form */}
        <div className="flex-1 flex items-center justify-center relative z-10 lg:bg-background">
          <div className="w-full max-w-md px-8">
            {/* Mobile branding */}
            <div className="lg:hidden text-center mb-8">
              <img src={kpLogo} alt="KP Assessoria" className="h-14 w-14 rounded-2xl shadow-2xl mx-auto mb-3" />
              <h1 className="text-xl font-bold text-foreground tracking-tight">KP Assessoria</h1>
            </div>

            <div className={`transition-all duration-200 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
              <h2 className="text-2xl font-bold text-foreground mb-1">
                Entrar como {typeLabel}
              </h2>
              <button type="button" onClick={goBack} className="text-primary hover:underline inline-flex items-center gap-1 text-sm mb-8">
                <ArrowLeft className="h-3 w-3" /> Voltar
              </button>

              {step === "username" && (
                <form onSubmit={goToPassword} className="space-y-5">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={usernameRef}
                      type="text"
                      name="username"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="seu.usuario"
                      required
                      autoFocus
                      className="pl-11 h-14 text-sm bg-secondary/50 border-border/60 focus:border-primary/50 rounded-xl"
                    />
                  </div>
                  <Button type="submit" className="w-full h-14 text-sm font-semibold gap-2 rounded-xl">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              )}

              {step === "password" && (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={passwordRef}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pl-11 h-14 text-sm bg-secondary/50 border-border/60 focus:border-primary/50 rounded-xl"
                    />
                  </div>
                  {failedAttempts >= 3 && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/40 bg-destructive/10">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div className="text-xs leading-relaxed text-foreground">
                        <p className="font-semibold text-destructive mb-1">Muitas tentativas incorretas</p>
                        <p className="text-foreground/80">
                          Você errou a senha {failedAttempts} vezes. Por favor, entre em contato com o time pelo grupo do WhatsApp para recuperar seu acesso.
                        </p>
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full h-14 text-sm font-semibold rounded-xl" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              )}

              <p className="text-xs text-muted-foreground/50 text-center mt-6">Acesso restrito a usuários autorizados</p>

              {/* Mobile step indicators */}
              <div className="lg:hidden flex items-center justify-center gap-3 mt-4">
                <div className="h-1 w-8 rounded-full bg-primary/40" />
                <div className={`h-1 w-8 rounded-full ${step === "username" ? "bg-primary" : "bg-foreground/20"}`} />
                <div className={`h-1 w-8 rounded-full ${step === "password" ? "bg-primary" : "bg-foreground/20"}`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
