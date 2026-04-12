-- Adicionar coluna client_id referenciando clients
ALTER TABLE public.simulations ADD COLUMN client_id uuid REFERENCES public.clients(id);

-- Limpar simulações antigas
DELETE FROM public.simulations;