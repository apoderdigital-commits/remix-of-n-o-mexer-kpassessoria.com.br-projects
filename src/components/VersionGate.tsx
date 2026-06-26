import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

/**
 * Detecta novo deploy comparando o bundle referenciado no index.html servido agora
 * com o que está rodando. Quando muda:
 *  - mostra um toast "Atualizar" (clique manual)
 *  - e recarrega sozinho na próxima navegação do usuário (ponto seguro, sem perder dados)
 *
 * Resolve o problema de usuários presos numa versão antiga em cache.
 */

function currentScriptSrc(): string | null {
  const scripts = Array.from(
    document.querySelectorAll('script[type="module"][src]')
  ) as HTMLScriptElement[];
  const main =
    scripts.find((s) => /\/assets\/index-.*\.js/.test(s.src)) || scripts[0];
  return main ? main.getAttribute("src") : null;
}

async function deployedScriptSrc(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const norm = (s: string) => s.replace(/^https?:\/\/[^/]+/, "").split("?")[0];

export function VersionGate() {
  const location = useLocation();
  const current = useRef<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    current.current = currentScriptSrc();
    let cancelled = false;

    const check = async () => {
      if (pending.current || cancelled || !current.current) return;
      const deployed = await deployedScriptSrc();
      if (!deployed) return;
      if (norm(deployed) !== norm(current.current)) {
        pending.current = true;
        toast("Nova versão disponível", {
          description: "Atualize para ver as últimas mudanças.",
          duration: Infinity,
          action: { label: "Atualizar", onClick: () => window.location.reload() },
        });
      }
    };

    const interval = window.setInterval(check, 2 * 60 * 1000); // a cada 2 min
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    const initial = window.setTimeout(check, 30 * 1000); // 1ª checagem após 30s

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  // Recarrega na próxima navegação se houver versão nova pendente (ponto seguro)
  useEffect(() => {
    if (pending.current) {
      window.location.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}
