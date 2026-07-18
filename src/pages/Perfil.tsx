import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, Fingerprint, KeyRound, LogOut, Save, Shield, Trash2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";
import PasswordResetDialog from "@/components/PasswordResetDialog";
import { isValidBrPhone, normalizeBrPhone } from "@/lib/phone";
import { resolveAvatarUrl } from "@/lib/avatar";

const EMAIL_DOMAIN = "@kp.local";
const FUNCOES: Record<string, string> = {
  gestor_trafego: "Gestor de Tráfego",
  head: "Head",
  especialista_projetos: "Especialista de Projetos",
};
const DASH_LABELS: Record<string, string> = {
  criativos: "Dashboard de Criativos",
  projecao: "Funil de Projeção de Vendas",
  comercial: "Dashboard Comercial",
};

export default function Perfil() {
  const { user, isAdmin, dashboards, clientId, squadCount, signOut } = useAuth();
  const username = (user?.email || "").replace(EMAIL_DOMAIN, "");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [squadFunction, setSquadFunction] = useState<string | null>(null);
  const [avatarSupported, setAvatarSupported] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [passSaving, setPassSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const [passkeys, setPasskeys] = useState<{ id: string; device_name: string | null; created_at: string; last_used_at: string | null }[]>([]);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      let { data, error } = await (supabase as any)
        .from("profiles")
        .select("full_name, phone, squad_function, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        // coluna avatar_url ainda sem migração — segue sem foto
        setAvatarSupported(false);
        const r2 = await (supabase as any)
          .from("profiles")
          .select("full_name, phone, squad_function")
          .eq("user_id", user.id)
          .maybeSingle();
        data = r2.data;
      }
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setSquadFunction(data.squad_function || null);
        const signed = await resolveAvatarUrl((data as any).avatar_url || null);
        setAvatarUrl(signed);
      }
    })();
    void loadPasskeys();
    (window as any).PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()
      .then((ok: boolean) => setBioSupported(!!ok))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadPasskeys = async () => {
    const { data } = await (supabase as any)
      .from("user_passkeys")
      .select("id, device_name, created_at, last_used_at")
      .order("created_at");
    setPasskeys(data || []);
  };

  const persistProfile = async (avatar: string | null) => {
    const rawPhone = phone.trim();
    if (rawPhone && !isValidBrPhone(rawPhone)) {
      throw new Error("Telefone inválido. Use DDD + número (ex.: 81985048696).");
    }
    const normalizedPhone = rawPhone ? normalizeBrPhone(rawPhone) : null;
    const { error } = await (supabase as any).rpc("update_own_profile", {
      _full_name: fullName.trim() || null,
      _phone: normalizedPhone,
      _avatar_url: avatar,
    });
    if (normalizedPhone) setPhone(normalizedPhone);
    if (error) {
      if (/update_own_profile/i.test(error.message || "")) throw new Error("A edição de perfil precisa da migração (peça ao Lovable).");
      throw new Error(error.message);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await persistProfile(avatarUrl);
      toast.success("Perfil atualizado!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (!avatarSupported) {
      toast.error("A foto de perfil precisa da migração (peça ao Lovable).");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      await persistProfile(data.publicUrl);
      toast.success("Foto atualizada!");
    } catch (e: any) {
      toast.error(/bucket/i.test(e?.message || "") ? "A foto de perfil precisa da migração (peça ao Lovable)." : e?.message || "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async () => {
    if (!user?.email) return;
    if (newPass.length < 6) { toast.error("A nova senha precisa de pelo menos 6 caracteres."); return; }
    if (newPass !== newPass2) { toast.error("A confirmação da nova senha não confere."); return; }
    setPassSaving(true);
    try {
      const check = await supabase.auth.signInWithPassword({ email: user.email, password: curPass });
      if (check.error) { toast.error("Senha atual incorreta."); return; }
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      setCurPass(""); setNewPass(""); setNewPass2("");
      toast.success("Senha alterada!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao alterar a senha");
    } finally {
      setPassSaving(false);
    }
  };

  const enrollBio = async () => {
    setBioBusy(true);
    try {
      const { data: opts, error } = await supabase.functions.invoke("passkey-auth", { body: { mode: "register-options" } });
      if (error || !opts?.options) throw new Error(opts?.error || "Função de biometria indisponível");
      const att = await startRegistration({ optionsJSON: opts.options });
      const { data: ver, error: vErr } = await supabase.functions.invoke("passkey-auth", {
        body: { mode: "register-verify", challengeId: opts.challengeId, response: att },
      });
      if (vErr || !ver?.verified) throw new Error(ver?.error || "Não foi possível validar a biometria");
      localStorage.setItem("kp-passkey-enrolled", "1");
      toast.success("Biometria ativada neste aparelho!");
      void loadPasskeys();
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "AbortError") toast.info("Cadastro de biometria cancelado.");
      else toast.error(e?.message || "Erro ao ativar a biometria");
    } finally {
      setBioBusy(false);
    }
  };

  const removePasskey = async (id: string) => {
    const { error } = await (supabase as any).from("user_passkeys").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    localStorage.removeItem("kp-passkey-enrolled");
    toast.success("Biometria removida.");
    void loadPasskeys();
  };

  const tipo = isAdmin ? "Administrador" : clientId ? "Cliente" : "Colaborador";
  const inicial = (fullName || username || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[420px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>

      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button size="icon" variant="ghost" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-primary" /> Editar perfil
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Dados básicos */}
        <section className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-6 space-y-5">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="h-20 w-20 rounded-2xl object-cover shadow-lg ring-1 ring-border/40" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-primary/15 flex items-center justify-center text-2xl font-bold text-primary shadow-lg ring-1 ring-border/40">
                  {inicial}
                </div>
              )}
              <label className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:opacity-90 transition">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.currentTarget.value = ""; }}
                />
              </label>
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{fullName || username}</p>
              <p className="text-xs text-muted-foreground">@{username}</p>
              {uploading && <p className="text-[11px] text-primary mt-1">Enviando foto...</p>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone (WhatsApp)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex.: 5581985048696" />
              <p className="text-xs text-muted-foreground">Formato: 55 + DDD + número (o 55 é adicionado automaticamente se faltar).</p>
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </section>

        {/* Senha */}
        <section className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Alterar senha</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} placeholder="Senha atual" autoComplete="current-password" />
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Nova senha" autoComplete="new-password" />
            <Input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} placeholder="Confirmar nova senha" autoComplete="new-password" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={changePassword} disabled={passSaving || !curPass || !newPass} className="gap-2">
              <KeyRound className="h-4 w-4" /> {passSaving ? "Alterando..." : "Alterar senha"}
            </Button>
            <button type="button" onClick={() => setResetOpen(true)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              Não sei minha senha atual
            </button>
          </div>
        </section>

        {/* Biometria */}
        <section className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Fingerprint className="h-4 w-4 text-primary" /> Login por biometria</h2>
          <p className="text-xs text-muted-foreground">
            Entre sem digitar a senha usando Touch ID, Windows Hello ou a digital do celular. A ativação vale para <strong>este aparelho</strong>.
          </p>
          {passkeys.length > 0 && (
            <div className="space-y-2">
              {passkeys.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-card/40 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Fingerprint className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.device_name || "Dispositivo"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        ativada em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        {p.last_used_at ? ` · último uso ${new Date(p.last_used_at).toLocaleDateString("pt-BR")}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-destructive shrink-0" onClick={() => void removePasskey(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                </div>
              ))}
            </div>
          )}
          {bioSupported ? (
            <Button onClick={enrollBio} disabled={bioBusy} variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
              <Fingerprint className="h-4 w-4" /> {bioBusy ? "Aguardando biometria..." : "Ativar neste aparelho"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Este aparelho não tem biometria disponível.</p>
          )}
        </section>

        {/* Informações da conta (somente leitura) */}
        <section className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-6 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Informações da conta</h2>
          <p className="text-xs text-muted-foreground">Definidas pelo administrador — para mudar, fale com a gestão.</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary">{tipo}</Badge>
            {squadFunction && <Badge variant="outline">{FUNCOES[squadFunction] || squadFunction}</Badge>}
            {squadCount > 0 && <Badge variant="outline">{squadCount} squad{squadCount > 1 ? "s" : ""}</Badge>}
            {(isAdmin ? Object.keys(DASH_LABELS) : dashboards).map((d) => (
              <Badge key={d} variant="outline" className="text-muted-foreground">{DASH_LABELS[d] || d}</Badge>
            ))}
          </div>
        </section>

        {/* Sair */}
        <div className="pt-2">
          <Button
            onClick={signOut}
            variant="outline"
            className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sair da conta
          </Button>
        </div>
      </main>

      <PasswordResetDialog open={resetOpen} onOpenChange={setResetOpen} initialUsername={username} />
    </div>
  );
}
