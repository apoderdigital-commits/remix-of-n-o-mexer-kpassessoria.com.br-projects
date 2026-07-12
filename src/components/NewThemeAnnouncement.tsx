import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Sun, Moon, X } from "lucide-react";

const MIGRATION_KEY = "kp-theme-light-default-v2";

/**
 * Ao logar, força o tema claro como padrão (uma única vez por usuário/dispositivo)
 * e mostra um popup no canto inferior esquerdo avisando da novidade. O usuário pode
 * manter o tema claro ou optar pelo escuro — a escolha vira o padrão dele.
 */
export function NewThemeAnnouncement() {
  const { setTheme } = useTheme();
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    // Só aparece na homepage de escolha de dashboards.
    if (pathname !== "/") return;

    const done = localStorage.getItem(MIGRATION_KEY);
    if (done) return;

    // Novo padrão para todos: tema claro.
    setTheme("light");
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [loading, user, pathname, setTheme]);

  const close = () => {
    setLeaving(true);
    setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, 250);
  };

  const choose = (theme: "light" | "dark") => {
    setTheme(theme);
    localStorage.setItem(MIGRATION_KEY, "1");
    close();
  };

  if (!open) return null;

  return (
    <div
      className={`fixed bottom-24 left-5 z-[60] w-[320px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/10 p-4 transition-all duration-300 ${
        leaving ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"
      }`}
      role="dialog"
      aria-label="Novidade: novo tema padrão"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Fechar aviso"
        className="absolute top-3 right-3 text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Novidade</span>
      </div>

      <p className="text-sm font-semibold text-foreground leading-snug">
        Novo tema padrão claro!
      </p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        Deixamos o tema claro como padrão. Caso queira o tema escuro, escolha abaixo.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose("light")}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold py-2 hover:bg-primary/90 transition-colors"
        >
          <Sun className="h-3.5 w-3.5" /> Manter claro
        </button>
        <button
          type="button"
          onClick={() => choose("dark")}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-secondary/50 text-foreground text-xs font-semibold py-2 hover:bg-secondary transition-colors"
        >
          <Moon className="h-3.5 w-3.5" /> Tema escuro
        </button>
      </div>
    </div>
  );
}
