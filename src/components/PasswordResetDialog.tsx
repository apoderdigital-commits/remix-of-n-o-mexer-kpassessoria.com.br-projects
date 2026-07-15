import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MessageCircle, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUsername?: string;
}

type Step = "username" | "confirm-phone" | "code" | "new-password" | "done";

export default function PasswordResetDialog({ open, onOpenChange, initialUsername = "" }: Props) {
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState(initialUsername);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep("username");
    setUsername(initialUsername);
    setMaskedPhone("");
    setVerificationId("");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const lookupPhone = async () => {
    if (!username.trim()) {
      toast.error("Digite o usuário");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("request-password-reset", {
      body: { username: username.trim(), send: false },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "Não foi possível localizar o usuário");
      return;
    }
    setMaskedPhone((data as any).masked_phone);
    setStep("confirm-phone");
  };

  const sendCode = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("request-password-reset", {
      body: { username: username.trim(), send: true },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "Erro ao enviar código");
      return;
    }
    setVerificationId((data as any).verification_id);
    toast.success("Código enviado para o WhatsApp");
    setStep("code");
  };

  const verifyCodeStep = () => {
    if (code.trim().length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    setStep("new-password");
  };

  const resetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("confirm-password-reset", {
      body: { verification_id: verificationId, code: code.trim(), new_password: newPassword },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "Erro ao redefinir senha");
      // Wrong code → back to code step so they can retry
      if ((data as any)?.error?.toLowerCase()?.includes("código")) setStep("code");
      return;
    }
    setStep("done");
    toast.success("Senha redefinida! Faça login com a nova senha.");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "username" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Recuperar senha
              </DialogTitle>
              <DialogDescription>
                Digite seu usuário. Enviaremos um código de confirmação para o WhatsApp cadastrado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Label htmlFor="reset-username">Usuário</Label>
              <Input
                id="reset-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu.usuario"
                autoFocus
              />
              <Button onClick={lookupPhone} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
              </Button>
            </div>
          </>
        )}

        {step === "confirm-phone" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" /> Confirme seu WhatsApp
              </DialogTitle>
              <DialogDescription>
                Este é o número cadastrado para <strong>{username}</strong>. Ele é seu?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Número cadastrado</p>
                <p className="text-2xl font-bold tracking-wider text-foreground">{maskedPhone}</p>
              </div>
              <div className="flex gap-2">
                <a
                  href="https://wa.me/message/CX2FK5HG77WOD1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent px-4 py-2 text-sm font-medium transition"
                >
                  <MessageCircle className="h-4 w-4" /> Falar com o suporte
                </a>
                <Button onClick={sendCode} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, enviar código"}
                </Button>
              </div>
              <p className="text-[11px] text-center text-muted-foreground">
                Não é seu número? Fale com o suporte para recuperar seu login. Tempo de resposta: até 1 hora.
              </p>
            </div>
          </>
        )}

        {step === "code" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Código de confirmação
              </DialogTitle>
              <DialogDescription>
                Digite o código de 6 dígitos enviado para <strong>{maskedPhone}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em] font-bold"
                inputMode="numeric"
                autoFocus
              />
              <Button onClick={verifyCodeStep} disabled={loading || code.length !== 6} className="w-full">
                Continuar
              </Button>
              <button
                type="button"
                onClick={sendCode}
                disabled={loading}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition"
              >
                Reenviar código
              </button>
            </div>
          </>
        )}

        {step === "new-password" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Nova senha
              </DialogTitle>
              <DialogDescription>Escolha uma nova senha (mínimo 6 caracteres).</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="new-pw">Nova senha</Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="confirm-pw">Confirmar nova senha</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button onClick={resetPassword} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redefinir senha"}
              </Button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>Senha redefinida ✓</DialogTitle>
              <DialogDescription>Faça login com sua nova senha.</DialogDescription>
            </DialogHeader>
            <Button onClick={() => handleClose(false)} className="w-full">Fechar</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
