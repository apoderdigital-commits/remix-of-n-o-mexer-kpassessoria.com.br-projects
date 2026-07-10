import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isLight = mounted && theme === "light";

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      aria-label={isLight ? "Ativar tema escuro" : "Ativar tema claro"}
      className="h-9 w-9 sm:h-auto sm:w-auto sm:px-3 sm:gap-1.5 text-muted-foreground hover:text-foreground"
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="hidden sm:inline text-sm">{isLight ? "Escuro" : "Claro"}</span>
    </Button>
  );
}
