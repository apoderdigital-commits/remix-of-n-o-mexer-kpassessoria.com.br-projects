
-- Auto-prioritization for squad_clients
ALTER TABLE public.squad_clients
  ADD COLUMN IF NOT EXISTS priority_score integer NOT NULL DEFAULT 99;

CREATE OR REPLACE FUNCTION public.compute_squad_client_priority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c text := upper(coalesce(NEW.curve_abc, ''));
  s text := upper(coalesce(NEW.sprint, ''));
  cs int;
  ss int;
BEGIN
  IF c IN ('A','B','C') AND s IN ('A','B','C') THEN
    NEW.prioritization := c || s;
    cs := CASE c WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END;
    ss := CASE s WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END;
    NEW.priority_score := cs * 3 + ss;
  ELSE
    NEW.priority_score := 99;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_squad_client_priority ON public.squad_clients;
CREATE TRIGGER trg_squad_client_priority
  BEFORE INSERT OR UPDATE ON public.squad_clients
  FOR EACH ROW EXECUTE FUNCTION public.compute_squad_client_priority();

-- Backfill
UPDATE public.squad_clients SET curve_abc = curve_abc;

-- Monthly metrics
CREATE TABLE IF NOT EXISTS public.squad_monthly_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  reference_month date NOT NULL,
  active_clients integer,
  out_of_target integer,
  churn_count integer,
  new_clients integer,
  renewals integer,
  churn_reason text,
  monthly_clients integer,
  calls_delivered_pct numeric,
  upsell_amount text,
  lifetime text,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (squad_id, reference_month)
);

ALTER TABLE public.squad_monthly_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage squad metrics" ON public.squad_monthly_metrics
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Members view squad metrics" ON public.squad_monthly_metrics
  FOR SELECT TO authenticated USING (user_in_squad(squad_id));
CREATE POLICY "Members insert squad metrics" ON public.squad_monthly_metrics
  FOR INSERT TO authenticated WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members update squad metrics" ON public.squad_monthly_metrics
  FOR UPDATE TO authenticated USING (user_in_squad(squad_id)) WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members delete squad metrics" ON public.squad_monthly_metrics
  FOR DELETE TO authenticated USING (user_in_squad(squad_id));

CREATE TRIGGER trg_squad_metrics_updated
  BEFORE UPDATE ON public.squad_monthly_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Churn
CREATE TABLE IF NOT EXISTS public.squad_churn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  client_name text NOT NULL,
  entry_month date,
  churn_month date,
  reason text,
  months_active text,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.squad_churn ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage squad churn" ON public.squad_churn
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Members view squad churn" ON public.squad_churn
  FOR SELECT TO authenticated USING (user_in_squad(squad_id));
CREATE POLICY "Members insert squad churn" ON public.squad_churn
  FOR INSERT TO authenticated WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members update squad churn" ON public.squad_churn
  FOR UPDATE TO authenticated USING (user_in_squad(squad_id)) WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members delete squad churn" ON public.squad_churn
  FOR DELETE TO authenticated USING (user_in_squad(squad_id));

CREATE TRIGGER trg_squad_churn_updated
  BEFORE UPDATE ON public.squad_churn
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed historical churn from spreadsheet (single record known)
INSERT INTO public.squad_churn (squad_id, client_name, entry_month, churn_month, reason, months_active)
SELECT id, 'SHINERAY BEBERIBE', '2025-09-01', '2026-01-01', NULL, '4 MESES'
FROM public.squads
WHERE name ILIKE '%CS%' OR name ILIKE '%Squad%'
LIMIT 1
ON CONFLICT DO NOTHING;
