import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, Upload, Square, CheckCircle2 } from "lucide-react";

const TARGET = 3600; // 1 hora em segundos

interface Props {
  open: boolean;
  onClose: () => void;
  squadId: string;
  referenceMonth: string; // YYYY-MM
  clients: { id: string; name: string }[];
}

export function MonthlyMeetingDialog({ open, onClose, squadId, referenceMonth, clients }: Props) {
  const [clientName, setClientName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [endReason, setEndReason] = useState("");
  const [ending, setEnding] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    if (startedAt) {
      timer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
      return () => window.clearInterval(timer.current);
    }
  }, [startedAt]);

  const reset = () => {
    setClientName(""); setSessionId(null); setStartedAt(null); setElapsed(0);
    setFile(null); setUploaded(false); setEndReason(""); setEnding(false);
  };

  const start = async () => {
    if (!clientName) { toast.error("Selecione o cliente"); return; }
    const { data, error } = await supabase
      .from("squad_monthly_sessions")
      .insert({ squad_id: squadId, client_name: clientName, reference_month: `${referenceMonth}-01`, started_at: new Date().toISOString() })
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    setSessionId((data as any).id);
    setStartedAt(Date.now());
  };

  const upload = async () => {
    if (!file || !sessionId) return;
    setUploading(true);
    const path = `${squadId}/${sessionId}/${file.name}`;
    const { error } = await supabase.storage.from("projecoes").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload: " + error.message); setUploading(false); return; }
    await supabase.from("squad_monthly_sessions").update({ projection_file_url: path, projection_file_name: file.name }).eq("id", sessionId);
    setUploaded(true);
    setUploading(false);
    toast.success("Projeção anexada à reunião!");
  };

  const end = async () => {
    if (!sessionId) return;
    const early = elapsed < TARGET;
    if (early && !endReason.trim()) {
      toast.error("Encerrando antes de 1h — informe o motivo.");
      return;
    }
    setEnding(true);
    const { error } = await supabase.from("squad_monthly_sessions").update({
      ended_at: new Date().toISOString(),
      early_end_reason: early ? endReason.trim() : null,
    }).eq("id", sessionId);
    setEnding(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reunião mensal encerrada e guardada!");
    reset();
    onClose();
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const early = elapsed < TARGET;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md bg-card border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" /> Reunião Mensal
          </DialogTitle>
        </DialogHeader>

        {!sessionId ? (
          <div className="space-y-3 py-2">
            <Label className="text-xs text-muted-foreground">Cliente</Label>
            <Select value={clientName} onValueChange={setClientName}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={start} className="w-full gap-2">
              <Play className="h-4 w-4" /> Iniciar Mensal (meta 1h)
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="text-center rounded-xl border border-border/30 bg-background/30 p-4">
              <p className="text-sm text-muted-foreground">{clientName}</p>
              <p className={`text-5xl font-black tabular-nums mt-1 ${early ? "text-amber-300" : "text-emerald-300"}`}>{fmt(elapsed)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {early ? `faltam ${fmt(TARGET - elapsed)} para 1h` : "1 hora completa ✓"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Projeção exportada (anexar)</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setUploaded(false); }} />
              <Button onClick={upload} disabled={!file || uploading || uploaded} variant="outline" className="w-full gap-2">
                {uploaded ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Upload className="h-4 w-4" />}
                {uploaded ? "Anexado ✓" : uploading ? "Enviando..." : "Anexar arquivo"}
              </Button>
            </div>

            {early && (
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-300">Encerrando antes de 1h — motivo *</Label>
                <Textarea value={endReason} onChange={(e) => setEndReason(e.target.value)} rows={2}
                  placeholder="Ex: cliente precisou sair, alinhamento rápido, tudo certo..." />
              </div>
            )}

            <Button onClick={end} disabled={ending} className="w-full gap-2 bg-gradient-to-r from-primary to-fuchsia-600">
              <Square className="h-4 w-4" /> {ending ? "Encerrando..." : "Encerrar Reunião"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
