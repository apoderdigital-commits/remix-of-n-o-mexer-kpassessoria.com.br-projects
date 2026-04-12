import { useState } from "react";
import { Sparkles, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface CreativeGuideButtonProps {
  creativeName: string;
  category: "cpf" | "consortium" | "financing";
  count: number;
  percentage: number;
  compact?: boolean;
}

export function CreativeGuideButton({ creativeName, category, count, percentage, compact }: CreativeGuideButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);

  const isUrl = creativeName.startsWith("http");

  const handleGenerate = async () => {
    if (!isUrl) {
      toast.error("Guia disponível apenas para criativos com URL");
      return;
    }

    setOpen(true);
    setLoading(true);
    setGuide(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-creative-guide", {
        body: { creativeUrl: creativeName, category, count, percentage },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setOpen(false);
        return;
      }

      setGuide(data.guide);
    } catch (err) {
      console.error("Guide error:", err);
      toast.error("Erro ao gerar guia de criativos");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (guide) {
      navigator.clipboard.writeText(guide);
      toast.success("Guia copiado!");
    }
  };

  if (!isUrl) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleGenerate}
        className={`gap-1.5 border-primary/30 text-primary hover:bg-primary/10 ${compact ? "text-xs px-2 h-7" : "text-xs"}`}
        title="Gerar guia de criativo com IA"
      >
        <Sparkles className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {compact ? "Guia IA" : "Gerar Guia com IA"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Guia de Criativo com IA
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative">
                <div className="h-10 w-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                <Sparkles className="h-4 w-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">Analisando criativo...</p>
                <p className="text-xs text-muted-foreground">A IA está assistindo o vídeo e gerando o guia</p>
              </div>
            </div>
          ) : guide ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 text-xs">
                  <Copy className="h-3.5 w-3.5" /> Copiar guia
                </Button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground">
                <ReactMarkdown>{guide}</ReactMarkdown>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
