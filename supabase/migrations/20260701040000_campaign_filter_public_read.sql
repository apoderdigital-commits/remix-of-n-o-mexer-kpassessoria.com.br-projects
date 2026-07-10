-- Deixa a tela pública do cliente (/view, sem login) LER o filtro de campanhas.
-- Só leitura; escrita continua restrita a admin/manager.
DROP POLICY IF EXISTS "Public read campaign filter" ON public.client_campaign_filters;
CREATE POLICY "Public read campaign filter" ON public.client_campaign_filters
FOR SELECT TO anon USING (true);
