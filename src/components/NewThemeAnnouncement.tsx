import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Palette, Sun, Moon, X } from "lucide-react";

const MIGRATION_KEY_BASE = "kp-theme-light-default-v2";

/**
 * Ao logar e acessar a homepage de escolha de dashboards, mostra uma única vez
 * um popup avisando sobre o novo tema padrão claro. O usuário pode manter o
 * claro ou optar pelo escuro — a escolha vira o padrão dele e o popup nunca
 * mais aparece (marcador é por usuário).
 */
export function NewThemeAnnouncement() {
  const { theme, setTheme } = useTheme();
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const storageKey = user ? `${MIGRATION_KEY_BASE}:${user.id}` : null;

  useEffect(() => {
    if (loading || !user || !storageKey) return;

    if (pathname !== "/") {
      setOpen(false);
      setLeaving(false);
      return;
    }

    // Migração de chave antiga (global) para chave por usuário.
    const legacy = localStorage.getItem(MIGRATION_KEY_BASE);
    if (legacy && !localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "1");
    }

    if (localStorage.getItem(storageKey)) return;

    // Não força mais o tema — respeita a escolha atual do usuário.
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [loading, user, pathname, storageKey]);

  const markSeen = () => {
    if (storageKey) localStorage.setItem(storageKey, "1");
  };

  const close = () => {
    markSeen();
    setLeaving(true);
    setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, 250);
  };

  const choose = (next: "light" | "dark") => {
    setTheme(next);
    close();
  };

  if (!open) return null;

  return (
    <div
      className={`fixed bottom-8 left-5 z-[60] w-[320px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/10 p-4 transition-all duration-300 ${
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
          <Palette className="h-4 w-4" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Novidade</span>
      </div>

      <p className="text-sm font-semibold text-foreground leading-snug">
        Novo tema padrão claro!
      </p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        Deixamos o tema claro como padrão. Caso queira o tema escuro, escolha abaixo.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choose("light")}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold h-9 px-2 hover:bg-primary/90 transition-colors"
        >
          <Sun className="h-3.5 w-3.5" /> Manter claro
        </button>
        <button
          type="button"
          onClick={() => choose("dark")}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-secondary/50 text-foreground text-xs font-semibold h-9 px-2 hover:bg-secondary transition-colors"
        >
          <Moon className="h-3.5 w-3.5" /> Tema escuro
        </button>
      </div>
    </div>
  );
}
