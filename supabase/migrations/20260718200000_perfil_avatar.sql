-- Perfil editável pelo próprio usuário: foto + função segura de atualização
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- O usuário só consegue mexer em nome, telefone e foto — nunca em role/função/dashboards.
CREATE OR REPLACE FUNCTION public.update_own_profile(_full_name text, _phone text, _avatar_url text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles
  SET full_name = _full_name, phone = _phone, avatar_url = _avatar_url
  WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.update_own_profile(text, text, text) FROM anon;

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
