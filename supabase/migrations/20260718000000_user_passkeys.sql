-- Passkeys (login por biometria via WebAuthn)
CREATE TABLE IF NOT EXISTS public.user_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user ON public.user_passkeys(user_id);

-- Usuário vê/remove as próprias chaves; cadastro é feito só pela edge function (service role).
CREATE POLICY "Users view own passkeys" ON public.user_passkeys
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own passkeys" ON public.user_passkeys
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Desafios temporários do WebAuthn (anti-replay); acesso apenas via service role.
CREATE TABLE IF NOT EXISTS public.passkey_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge text NOT NULL,
  kind text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;
