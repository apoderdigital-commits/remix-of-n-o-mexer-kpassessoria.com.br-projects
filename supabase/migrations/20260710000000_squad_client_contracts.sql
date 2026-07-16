-- Contrato (PDF) por cliente do squad.
-- Leitura: qualquer usuário autenticado (todos da dash do squad).
-- Anexar / substituir / remover: SOMENTE admin.

-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Contratos leitura" ON storage.objects;
CREATE POLICY "Contratos leitura" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'contratos');

DROP POLICY IF EXISTS "Contratos insert admin" ON storage.objects;
CREATE POLICY "Contratos insert admin" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Contratos update admin" ON storage.objects;
CREATE POLICY "Contratos update admin" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'contratos' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Contratos delete admin" ON storage.objects;
CREATE POLICY "Contratos delete admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'contratos' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Referência do contrato no cliente do squad
ALTER TABLE public.squad_clients
  ADD COLUMN IF NOT EXISTS contract_file_url text,
  ADD COLUMN IF NOT EXISTS contract_file_name text;
