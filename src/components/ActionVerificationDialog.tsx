import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export type SensitiveAction =
  | "create_user"
  | "delete_user"
  | "purge_user"
  | "create_client"
  | "update_client"
  | "update_client_meta_token"
  | "delete_client"
  | "purge_client";

interface ActionVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: SensitiveAction;
  payload: Record<string, any>;
  /** Human-readable target description (e.g. client name) shown in toasts/log */
  targetLabel?: string;
  /** Title shown in dialog header */
  title?: string;
  /** Toast message when execution succeeds */
  successMessage?: string;
  onSuccess?: (result: any) => void;
}

export function ActionVerificationDialog({
  open,
  onOpenChange,
  action,
  payload,
  targetLabel,
  title = "Verificação por WhatsApp",
  successMessage = "Ação confirmada",
  onSuccess,
}: ActionVerificationDialogProps) {
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setVerificationId(null);
      setCode("");
      setResendCooldown(0);
      void requestCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const requestCode = async () => {
    setRequesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-action-code", {
        body: { action, payload, target_label: targetLabel || "" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setVerificationId(data.verification_id);
      setCode("");
      setResendCooldown(30);
      toast.success("Código enviado para o seu WhatsApp");
    } catch (err: any) {
      toast.error(err.message || "Erro ao solicitar código");
      onOpenChange(false);
    }
    setRequesting(false);
  };

  const handleConfirm = async () => {
    if (!verificationId || code.length !== 6) {
      toast.error("Digite os 6 dígitos");
      return;
    }
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke("confirm-action-code", {
        body: { verification_id: verificationId, code },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(successMessage);
      onOpenChange(false);
      onSuccess?.(data);
    } catch (err: any) {
      toast.error(err.message || "Código inválido");
    }
    setConfirming(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <p className="text-sm">
              {requesting
                ? "Enviando código para o seu WhatsApp..."
                : <>Enviamos um código de 6 dígitos para o <strong>seu WhatsApp</strong> (admin).</>}
            </p>
            {targetLabel && (
              <p className="text-xs text-muted-foreground">
                Ação: <span className="text-foreground font-medium">{targetLabel}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              O código expira em 10 minutos. Confira a mensagem no seu celular.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Label>Código de verificação</Label>
            <InputOTP maxLength={6} value={code} onChange={setCode} disabled={requesting || !verificationId}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex items-center justify-end text-xs text-muted-foreground">
            <button
              type="button"
              disabled={resendCooldown > 0 || requesting || confirming}
              className="hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={requestCode}
            >
              {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
            </button>
          </div>

          <Button
            onClick={handleConfirm}
            className="w-full"
            disabled={confirming || requesting || !verificationId || code.length !== 6}
          >
            {confirming ? "Validando..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
