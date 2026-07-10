-- Deixa usuários com acesso ao cliente LEREM a config de relatório (p/ disparar do painel).
-- A ESCRITA (definir/trocar o JID) continua restrita a admin/manager (política existente).
DROP POLICY IF EXISTS "Users read report config for their clients" ON public.client_report_configs;
CREATE POLICY "Users read report config for their clients"
ON public.client_report_configs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_client_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.client_id = client_report_configs.client_id
  )
);
