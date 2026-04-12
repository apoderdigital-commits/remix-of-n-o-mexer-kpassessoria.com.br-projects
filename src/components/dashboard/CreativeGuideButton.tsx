import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CreativeGuideButtonProps {
  creativeName: string;
  category: "cpf" | "consortium" | "financing";
  count: number;
  percentage: number;
  compact?: boolean;
}

export function CreativeGuideButton({ creativeName, compact }: CreativeGuideButtonProps) {
  const isUrl = creativeName.startsWith("http");

  if (!isUrl) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => toast.info("🚧 Em construção — estamos trabalhando para trazer essa funcionalidade em breve!")}
      className={`gap-1.5 border-primary/30 text-primary hover:bg-primary/10 ${compact ? "text-xs px-2 h-7" : "text-xs"}`}
      title="Funcionalidade em construção"
    >
      <Sparkles className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {compact ? "Guia IA" : "Guia IA (Em breve)"}
    </Button>
  );
}
