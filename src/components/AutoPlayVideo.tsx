import { useRef, useEffect } from "react";

interface AutoPlayVideoProps {
  src: string;
  className?: string;
}

export function AutoPlayVideo({ src, className }: AutoPlayVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("webkit-playsinline", "");
    el.play().catch(() => {});
  }, []);

  return (
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
  );
}
