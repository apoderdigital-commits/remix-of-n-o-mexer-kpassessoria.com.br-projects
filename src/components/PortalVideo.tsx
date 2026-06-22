import { useRef, useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

interface PortalVideoProps {
  src: string;
  className?: string;
  /** Volume baixo padrão (0 a 1) */
  defaultVolume?: number;
  /** Mostra o controle de volume/mute no canto inferior direito */
  showControls?: boolean;
}

const LOW_VOLUME = 0.096;

export function PortalVideo({
  src,
  className,
  defaultVolume = LOW_VOLUME,
  showControls = false,
}: PortalVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(defaultVolume);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("webkit-playsinline", "");
    el.volume = volume;

    // 1) Autoplay MUDO garante que o vídeo toca de forma suave (nunca trava).
    el.muted = true;
    el.play().catch(() => {});

    // 2) Logo em seguida tenta LIGAR O SOM. Para quem já interagiu com o site
    //    (Chrome confia no domínio), o som entra de imediato. Se o navegador
    //    bloquear, voltamos pro mudo e esperamos a 1ª interação (passo 3).
    const trySound = () => {
      el.muted = false;
      el.volume = volume;
      el.play()
        .then(() => setMuted(false))
        .catch(() => {
          el.muted = true;
          setMuted(true);
        });
    };
    const t = window.setTimeout(trySound, 150);

    // 3) Na primeira interação do usuário (clique, tecla, scroll, toque),
    //    liga o som em volume baixo.
    const onInteraction = () => {
      const v = ref.current;
      if (v && v.muted) {
        v.muted = false;
        v.volume = volume;
        v.play().catch(() => {});
        setMuted(false);
      }
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      window.removeEventListener("touchstart", onInteraction);
      window.removeEventListener("scroll", onInteraction);
    };
    window.addEventListener("pointerdown", onInteraction);
    window.addEventListener("keydown", onInteraction);
    window.addEventListener("touchstart", onInteraction, { passive: true });
    window.addEventListener("scroll", onInteraction, { passive: true });

    return () => {
      window.clearTimeout(t);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const el = ref.current;
    if (!el) return;
    const next = !muted;
    el.muted = next;
    if (!next) {
      el.volume = volume > 0 ? volume : defaultVolume;
      if (volume === 0) setVolume(defaultVolume);
      el.play().catch(() => {});
    }
    setMuted(next);
  };

  const handleVolumeChange = (value: number) => {
    const el = ref.current;
    if (!el) return;
    setVolume(value);
    el.volume = value;
    const shouldMute = value === 0;
    el.muted = shouldMute;
    setMuted(shouldMute);
    if (!shouldMute) el.play().catch(() => {});
  };

  return (
    <>
      <video
        ref={ref}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={className}
        src={src}
      />

      {showControls && (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 group/vol">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            aria-label="Volume"
            className="w-0 opacity-0 group-hover/vol:w-24 group-hover/vol:opacity-100 transition-all duration-300 h-1 cursor-pointer accent-primary"
          />
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Ativar som" : "Silenciar"}
            className="shrink-0 w-10 h-10 rounded-full bg-background/60 backdrop-blur-md border border-border/40 flex items-center justify-center text-foreground/90 hover:bg-background/80 hover:text-foreground transition-all shadow-lg"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      )}
    </>
  );
}
