-- "Está no planejamento estratégico?" vira Sim / Não / (não respondido).
-- Antes era boolean NOT NULL DEFAULT false, o que fazia todo mundo nascer como "Não".
ALTER TABLE public.squad_engagement ALTER COLUMN plano_estrategico DROP DEFAULT;
ALTER TABLE public.squad_engagement ALTER COLUMN plano_estrategico DROP NOT NULL;

-- Ninguém respondeu ainda (a coluna nasceu há pouco com default false):
-- zera para NULL = "não respondido", senão todos apareceriam como "Não".
UPDATE public.squad_engagement SET plano_estrategico = NULL WHERE plano_estrategico = false;
