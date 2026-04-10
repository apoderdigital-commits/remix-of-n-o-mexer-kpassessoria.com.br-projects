
-- Drop the incorrectly created comparison_notes table
DROP TABLE IF EXISTS public.comparison_notes;

-- Create comparisons table
CREATE TABLE public.comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  investimento DECIMAL(12,2) NOT NULL DEFAULT 0,
  cpl DECIMAL(10,2) NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  pre_atendimento INTEGER NOT NULL DEFAULT 0,
  qualificados INTEGER NOT NULL DEFAULT 0,
  vendas INTEGER NOT NULL DEFAULT 0,
  ticket_medio DECIMAL(12,2) NOT NULL DEFAULT 0,
  reference_month INTEGER NOT NULL,
  reference_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, tipo, reference_month, reference_year)
);

ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comparisons" ON public.comparisons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all comparisons" ON public.comparisons FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own comparisons" ON public.comparisons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comparisons" ON public.comparisons FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comparisons" ON public.comparisons FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Recreate comparison_notes with correct schema
CREATE TABLE public.comparison_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reference_month INTEGER NOT NULL,
  reference_year INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, reference_month, reference_year)
);

ALTER TABLE public.comparison_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON public.comparison_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all notes" ON public.comparison_notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own notes" ON public.comparison_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.comparison_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.comparison_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
