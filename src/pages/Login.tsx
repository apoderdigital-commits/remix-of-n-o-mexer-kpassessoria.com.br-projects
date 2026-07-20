import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Lock, User, Shield, Briefcase, AlertTriangle, Fingerprint } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import kpLogo from "@/assets/kp-logo.png";
import brazilFlag from "@/assets/brazil-flag.png";
import loginBgPartners from "@/assets/login-team.jpg.asset.json";
import PasswordResetDialog from "@/components/PasswordResetDialog";

const EMAIL_DOMAIN = "@kp.local";

type LoginType = "collaborator" | "client" | null;
type Step = "type" | "credentials";

export default function Login() {
  const [loginType, setLoginType] = useState<LoginType>(null);
  const [step, setStep] = useState<Step>("type");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [screenTransition, setScreenTransition] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("kp-login-remember");
    if (saved) {
      try {
        const { loginType: savedType, username: savedUsername } = JSON.parse(saved);
        if (savedType && savedUsername) {
          setLoginType(savedType);
          setUsername(savedUsername);
          setRememberMe(true);
          setStep("credentials");
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tryPlay = () => { video.play().catch(() => {}); };
    video.load();
    tryPlay();
    const onVisibility = () => { if (!document.hidden) tryPlay(); };
    document.addEventListener("visibilitychange", onVisibility);
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
    if (step === "credentials") setTimeout(() => {
      if (username) passwordRef.current?.focus();
      else usernameRef.current?.focus();
    }, 350);
  }, [step]);

  const selectType = (type: LoginType) => {
    setLoginType(type);
    setScreenTransition(true);
    setTimeout(() => {
      setAnimating(true);
      setTimeout(() => {
        setStep("credentials");
        setAnimating(false);
      }, 200);
      setScreenTransition(false);
    }, 500);
  };

  const goBack = () => {
    setUsername("");
    setPassword("");
    setLoginType(null);
    setRememberMe(false);
    setScreenTransition(true);
    setTimeout(() => {
      setStep("type");
      setScreenTransition(false);
    }, 300);
  };

  // ── Login por biometria (passkey/WebAuthn: Touch ID, Windows Hello, digital) ──
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  // Só mostra o botão depois que a biometria foi ativada neste aparelho (no Portal ou em Editar perfil).
  const [bioEnrolled] = useState(() => { try { return !!localStorage.getItem("kp-passkey-enrolled"); } catch { return false; } });
  useEffect(() => {
    (window as any).PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()
      .then((ok: boolean) => setBioAvailable(!!ok))
      .catch(() => {});
  }, []);

  const handleBioLogin = async (auto = false) => {
    setBioLoading(true);
    try {
      const { data: opts, error } = await supabase.functions.invoke("passkey-auth", { body: { mode: "login-options" } });
      if (error || !opts?.options) throw new Error(opts?.error || "Biometria indisponível no momento");
      const assertion = await startAuthentication({ optionsJSON: opts.options });
      const { data: ver, error: vErr } = await supabase.functions.invoke("passkey-auth", {
        body: { mode: "login-verify", challengeId: opts.challengeId, response: assertion },
      });
      if (vErr || !ver?.token_hash) throw new Error(ver?.error || "Biometria não reconhecida — entre com a senha e ative de novo");
      let res = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: ver.token_hash });
      if (res.error) res = await supabase.auth.verifyOtp({ type: "email", token_hash: ver.token_hash });
      if (res.error) throw res.error;
      toast.success("Bem-vindo de volta!");
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "AbortError") { if (!auto) toast.info("Biometria cancelada."); }
      else toast.error(e?.message || "Não foi possível entrar com biometria");
    } finally {
      setBioLoading(false);
    }
  };

  // Aparelho já cadastrado: pede a biometria sozinho ao abrir a tela.
  // Uma tentativa só por visita; se cancelar, o formulário normal continua.
  // Depois de "Sair" não dispara (senão o logout vira briga com o login).
  const autoBioTried = useRef(false);
  useEffect(() => {
    if (autoBioTried.current || !bioAvailable || !bioEnrolled) return;
    try {
      if (sessionStorage.getItem("kp-bio-skip-once")) {
        sessionStorage.removeItem("kp-bio-skip-once");
        autoBioTried.current = true;
        return;
      }
    } catch { /* sem sessionStorage */ }
    autoBioTried.current = true;
    const t = window.setTimeout(() => { void handleBioLogin(true); }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioAvailable]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
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
      if (rememberMe) {
        localStorage.setItem("kp-login-remember", JSON.stringify({
          loginType,
          username: username.trim().toLowerCase(),
        }));
      } else {
        localStorage.removeItem("kp-login-remember");
      }
    }
    setLoading(false);
  };

  const typeLabel = loginType === "collaborator" ? "Colaborador" : "Cliente";
  const isCredentialStep = step === "credentials";

  return (
    <div className="min-h-[100dvh] h-[100dvh] relative overflow-hidden bg-[#080810]">
      {/* Preloaded video — always in DOM */}
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

      {/* Screen 1: Type selection */}
      <div
        className={`absolute inset-0 flex flex-col transition-all duration-500 ${
          isCredentialStep ? "opacity-0 pointer-events-none scale-105" : "opacity-100 scale-100"
        } ${screenTransition && !isCredentialStep ? "opacity-0 scale-105" : ""}`}
        style={{ zIndex: isCredentialStep ? 0 : 10 }}
      >
        <div className="lg:absolute lg:inset-0 shrink-0">
          <img
            src={loginBgPartners.url}
            alt="Time KP Assessoria"
            className="w-full h-full object-cover object-center lg:absolute lg:inset-0"
            style={{ aspectRatio: "16/9" }}
          />
          <div className="hidden lg:block absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#080810] to-transparent" />
        </div>

        {/* Glassmorphism bottom bar */}
        <div className="flex-1 lg:flex-none lg:absolute lg:bottom-0 lg:left-0 lg:right-0 z-10 bg-background/80 border-t border-white/5 lg:bg-background/75 lg:backdrop-blur-xl shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
          <div className="max-w-5xl mx-auto px-6 py-5 lg:py-8 flex flex-col h-full lg:h-auto">
            {/* Mobile branding */}
            <div className="lg:hidden flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-primary/30 blur-md" />
                <img src={kpLogo} alt="KP Assessoria" className="relative h-10 w-10 rounded-xl shadow-lg" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground tracking-tight">KP Assessoria</h2>
                <p className="text-xs text-foreground/60">Aceleradora de vendas</p>
              </div>
            </div>

            {/* Motivational phrase — mobile */}
            <div className="lg:hidden flex-1 flex flex-col items-center justify-center text-center mb-4 relative">
              <img src={brazilFlag} alt="Brasil" className="absolute w-[450%] h-auto object-contain opacity-10 pointer-events-none z-0 top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 rotate-[15deg]" />
              <div className="relative z-10">
                <p className="text-xl font-black text-foreground/90 uppercase tracking-wide leading-tight">
                  Resultado não é opção
                </p>
                <p className="text-xl font-black text-primary uppercase tracking-wide leading-tight drop-shadow-[0_0_20px_rgba(139,92,246,0.5)]">
                  É obrigação!
                </p>
                <p className="mt-4 max-w-[280px] leading-relaxed text-foreground/70 text-base font-medium mx-auto">
                  Uma dashboard completa que te traz previsibilidade de verdade de saber o que está dando certo para escalar ainda mais as vendas!
                </p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
              {/* Desktop branding */}
              <div className="hidden lg:flex items-center gap-4 shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-primary/25 blur-lg" />
                  <img src={kpLogo} alt="KP Assessoria" className="relative h-12 w-12 rounded-xl shadow-lg" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground tracking-tight">KP Assessoria</h2>
                  <p className="text-xs text-foreground/50">Aceleradora de vendas para lojas automotivas</p>
                </div>
              </div>

              <div className="hidden lg:block w-px h-12 bg-white/8" />

              <div className="hidden lg:flex items-center gap-2 shrink-0">
                <div className="text-xs font-bold uppercase tracking-wider leading-tight">
                  <span className="text-foreground/70">Resultado não é opção.</span>
                  <br />
                  <span className="text-primary drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]">É obrigação!</span>
                  <span className="ml-1">🇧🇷</span>
                </div>
              </div>

              <div className="hidden lg:block w-px h-12 bg-white/8" />

              <div className="flex-1">
                <div className={`transition-all duration-200 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
                  <p className="text-sm font-semibold text-foreground/80 mb-3">Como você deseja acessar?</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => selectType("collaborator")}
                      className="flex-1 flex items-center gap-4 px-5 py-3.5 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 hover:border-primary/50 hover:shadow-[0_0_25px_rgba(139,92,246,0.15)] transition-all duration-200 text-left group"
                    >
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center group-hover:from-primary/40 group-hover:to-primary/20 transition-all duration-200">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Colaborador</p>
                        <p className="text-[11px] text-muted-foreground">Equipe interna</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>

                    <button
                      onClick={() => selectType("client")}
                      className="flex-1 flex items-center gap-4 px-5 py-3.5 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 hover:border-primary/50 hover:shadow-[0_0_25px_rgba(139,92,246,0.15)] transition-all duration-200 text-left group"
                    >
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center group-hover:from-primary/40 group-hover:to-primary/20 transition-all duration-200">
                        <Briefcase className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Cliente</p>
                        <p className="text-[11px] text-muted-foreground">Seus dashboards</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 lg:mt-3">
              <div className="h-1 w-8 rounded-full bg-primary shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
              <div className="h-1 w-8 rounded-full bg-white/15" />
              <span className="text-xs text-muted-foreground/40 ml-auto tracking-wide">Acesso restrito</span>
            </div>
          </div>
        </div>
      </div>

      {/* Screen 2: Credentials */}
      <div
        className={`absolute inset-0 flex transition-all duration-500 ${
          isCredentialStep ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: isCredentialStep ? 10 : 0 }}
      >
        {/* Mobile overlay */}
        <div className="fixed inset-0 bg-[#080810]/20 backdrop-blur-[2px] lg:hidden" style={{ zIndex: 1 }} />

        {/* Left — video (desktop) */}
        <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-[#080810]/10 via-transparent to-background" style={{ zIndex: 1 }} />

          <div className="relative z-10 text-center px-8">
            <div className="relative inline-block mb-5">
              <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-xl scale-110" />
              <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-md" />
              <img src={kpLogo} alt="KP Assessoria" className="relative h-20 w-20 rounded-2xl shadow-2xl ring-1 ring-white/10" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">KP Assessoria</h1>
            <p className="text-sm text-foreground/50 mt-1.5 font-medium">Aceleradora de vendas para lojas automotivas</p>
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <span className="text-xs text-foreground/60 font-medium">Acessando como</span>
              <span className="text-xs text-primary font-bold">{typeLabel}</span>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex-1 flex items-center justify-center relative z-10 lg:bg-background">
          <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/4 w-48 h-48 rounded-full bg-primary/3 blur-3xl pointer-events-none" />

          <div className="w-full max-w-md px-8 relative z-10">
            {/* Mobile branding */}
            <div className="lg:hidden text-center mb-8">
              <div className="relative inline-block mb-3">
                <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl scale-110" />
                <img src={kpLogo} alt="KP Assessoria" className="relative h-14 w-14 rounded-2xl shadow-2xl ring-1 ring-white/10" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">KP Assessoria</h1>
            </div>

            <div className={`transition-all duration-200 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-foreground">Bem-vindo de volta!</h2>
                <p className="text-sm text-foreground/50 mt-1">
                  Entrando como{" "}
                  <span className="text-primary font-semibold">{typeLabel}</span>
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    ref={usernameRef}
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Usuário"
                    required
                    className="pl-11 h-13 text-sm bg-secondary/50 border-border/60 text-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all placeholder:text-muted-foreground"
                  />
                </div>

                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    ref={passwordRef}
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha"
                    required
                    className="pl-11 h-13 text-sm bg-secondary/50 border-border/60 text-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all placeholder:text-muted-foreground"
                  />
                </div>

                <div className="flex items-center justify-between pt-1 pb-1">
                  <label className="flex items-center gap-2.5 cursor-pointer group/check">
                    <div
                      onClick={() => setRememberMe((v) => !v)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                        rememberMe
                          ? "bg-primary border-primary"
                          : "border-border/60 bg-secondary/50 hover:border-primary/50"
                      }`}
                    >
                      {rememberMe && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span
                      onClick={() => setRememberMe((v) => !v)}
                      className="text-xs text-foreground/60 group-hover/check:text-foreground/80 transition-colors select-none cursor-pointer"
                    >
                      Lembrar neste dispositivo
                    </span>
                  </label>
                  {failedAttempts >= 1 && (
                    <button
                      type="button"
                      onClick={() => setResetOpen(true)}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>

                {failedAttempts >= 1 && (
                  <button
                    type="button"
                    onClick={() => setResetOpen(true)}
                    className="w-full flex flex-col items-center justify-center gap-1 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-xs font-semibold text-primary transition-all text-center"
                  >
                    <span>💬</span>
                    <span>Recuperar senha</span>
                  </button>
                )}


                {failedAttempts >= 3 && (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/8">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <p className="font-semibold text-destructive mb-1">Muitas tentativas incorretas</p>
                      <p className="text-foreground/70">
                        Você errou {failedAttempts} vezes. Entre em contato com o time pelo WhatsApp para recuperar o acesso.
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-13 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-[0_4px_24px_rgba(139,92,246,0.35)] hover:shadow-[0_4px_32px_rgba(139,92,246,0.5)] transition-all duration-200 disabled:shadow-none"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Entrando...
                    </span>
                  ) : "Entrar"}
                </Button>

                {bioAvailable && bioEnrolled && (
                  <button
                    type="button"
                    onClick={() => void handleBioLogin()}
                    disabled={bioLoading}
                    className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-sm font-semibold text-primary transition-all disabled:opacity-60"
                  >
                    <Fingerprint className="h-4 w-4" />
                    {bioLoading ? "Aguardando biometria..." : "Entrar com biometria"}
                  </button>
                )}
              </form>

              <button
                type="button"
                onClick={goBack}
                className="w-full flex items-center justify-center gap-1.5 mt-5 text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" /> Trocar tipo de acesso
              </button>
            </div>
          </div>
        </div>
      </div>

      <PasswordResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        initialUsername={username}
      />
    </div>
  );
}
