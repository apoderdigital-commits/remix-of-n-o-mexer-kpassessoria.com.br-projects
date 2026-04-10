
-- Tabela simulations
CREATE TABLE public.simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  investimento DECIMAL(12,2) NOT NULL,
  cpl DECIMAL(10,2) NOT NULL,
  leads INTEGER NOT NULL,
  taxa_simulacoes DECIMAL(5,2) DEFAULT 30,
  simulacoes INTEGER NOT NULL,
  taxa_qualificados DECIMAL(5,2) DEFAULT 50,
  qualificados INTEGER NOT NULL,
  taxa_vendas DECIMAL(5,2) DEFAULT 20,
  vendas INTEGER NOT NULL,
  reference_month INTEGER,
  reference_year INTEGER,
  reference_week INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own simulations"
ON public.simulations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all simulations"
ON public.simulations FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own simulations"
ON public.simulations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own simulations"
ON public.simulations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own simulations"
ON public.simulations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Tabela comparison_notes
CREATE TABLE public.comparison_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  section TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.comparison_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
ON public.comparison_notes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notes"
ON public.comparison_notes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own notes"
ON public.comparison_notes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
ON public.comparison_notes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
ON public.comparison_notes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Adicionar colunas na tabela clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ticket_medio DECIMAL(12,2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');
