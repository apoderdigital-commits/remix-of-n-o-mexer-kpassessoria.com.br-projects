import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Lock, User } from "lucide-react";
import kpLogo from "@/assets/kp-logo.png";

const EMAIL_DOMAIN = "@kp.local";

export default function Login() {
  const [step, setStep] = useState<"username" | "password">("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "password") {
      setTimeout(() => passwordRef.current?.focus(), 350);
    }
    if (step === "username") {
      setTimeout(() => usernameRef.current?.focus(), 350);
    }
  }, [step]);

  const goToPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setAnimating(true);
    setTimeout(() => {
      setStep("password");
      setAnimating(false);
    }, 200);
  };

  const goBackToUsername = () => {
    setAnimating(true);
    setTimeout(() => {
      setStep("username");
      setPassword("");
      setAnimating(false);
    }, 200);
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

  return (
    <div className="min-h-screen flex">
      {/* Left side — branding */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center"
        style={{ background: "linear-gradient(135deg, hsl(263 70% 20%) 0%, hsl(222 47% 6%) 50%, hsl(263 50% 12%) 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(263 70% 58%) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-48 -right-24 w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, hsl(263 70% 58%) 0%, transparent 70%)" }} />
        <div className="absolute top-1/3 right-0 w-64 h-64 rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, hsl(199 89% 48%) 0%, transparent 70%)" }} />

        <div className="relative z-10 text-center px-12 max-w-md">
          <div className="mb-8">
            <img src={kpLogo} alt="KP Assessoria" className="h-20 w-20 rounded-2xl mx-auto shadow-2xl" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-3 tracking-tight">
            KP Assessoria
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Plataforma integrada de performance, projeções e inteligência de dados para sua operação.
          </p>
          <div className="mt-10 flex items-center gap-3 justify-center">
            <div className="h-1 w-8 rounded-full bg-primary/60" />
            <div className="h-1 w-8 rounded-full bg-primary/20" />
            <div className="h-1 w-8 rounded-full bg-primary/20" />
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
              {step === "username" ? "Acessar plataforma" : "Digite sua senha"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              {step === "username"
                ? "Insira seu usuário para continuar"
                : (
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={goBackToUsername}
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      {username}
                    </button>
                  </span>
                )}
            </p>
          </div>

          <div
            className={`transition-all duration-200 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
          >
            {step === "username" ? (
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
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            ) : (
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
