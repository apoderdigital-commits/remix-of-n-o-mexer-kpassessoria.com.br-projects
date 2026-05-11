ALTER TABLE public.squad_clients ADD COLUMN IF NOT EXISTS contract_value numeric;
ALTER TABLE public.squad_churn ADD COLUMN IF NOT EXISTS contract_value numeric;