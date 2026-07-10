import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Botãozinho de alternância de tema claro/escuro (usa next-themes). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = (theme ?? "dark") === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Tema claro" : "Tema escuro"}
      aria-label="Alternar tema claro/escuro"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-background/60 backdrop-blur text-foreground/80 hover:text-foreground hover:bg-background/80 transition-colors ${className}`}
    >
      {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
