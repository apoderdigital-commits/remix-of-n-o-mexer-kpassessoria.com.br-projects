import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Botão de alternância de tema claro/escuro (usa next-themes). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = (theme ?? "light") === "dark";
  const Icon = mounted && isDark ? Sun : Moon;
  const label = isDark ? "Mudar para tema claro" : "Mudar para tema escuro";

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={label}
      aria-label={label}
      className={`h-9 w-9 sm:h-auto sm:w-auto sm:px-3 sm:gap-1.5 text-muted-foreground hover:text-foreground ${className}`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline text-sm">Mudar tema</span>
    </Button>
  );
}
