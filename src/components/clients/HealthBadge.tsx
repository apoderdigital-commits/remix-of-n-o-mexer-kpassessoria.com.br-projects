import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ClientHealth, HealthLevel } from "@/hooks/useClientHealth";

const LEVEL_STYLES: Record<HealthLevel, { dot: string; ring: string; label: string }> = {
  green: {
    dot: "bg-green-400",
    ring: "ring-green-400/30 bg-green-400/10",
    label: "Saudável",
  },
  yellow: {
    dot: "bg-amber-400",
    ring: "ring-amber-400/30 bg-amber-400/10",
    label: "Atenção",
  },
  red: {
    dot: "bg-red-500",
    ring: "ring-red-500/30 bg-red-500/10",
    label: "Crítico",
  },
};

export function HealthBadge({ health }: { health?: ClientHealth }) {
  if (!health) {
    return (
      <span
        className="inline-flex h-2.5 w-2.5 rounded-full bg-muted-foreground/30"
        title="Sem dados"
      />
    );
  }
  const styles = LEVEL_STYLES[health.level];

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center justify-center h-4 w-4 rounded-full ring-2 ${styles.ring} cursor-help`}
            aria-label={`Saúde: ${styles.label}`}
          >
            <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-card border-border/60">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
              {styles.label}
            </div>
            {health.failing.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todas as metas do funil sendo atingidas.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Metas com problema
                </p>
                <ul className="text-xs space-y-0.5 list-disc list-inside">
                  {health.failing.map((f) => (
                    <li key={f} className="text-foreground/90">{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
