-- Fase 4: permissões granulares aplicadas no banco (RLS)

-- Helper: o usuário atual tem a permissão _perm?
CREATE OR REPLACE FUNCTION public.crm_has_perm(_perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.crm_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.crm_users u
      WHERE u.auth_user_id = auth.uid()
        AND (u.papel = 'admin' OR coalesce((u.permissoes->>_perm)::boolean, false))
    );
$$;

GRANT EXECUTE ON FUNCTION public.crm_has_perm(text) TO authenticated;

-- Reescreve políticas de cada tabela do CRM

-- crm_conversations
DROP POLICY IF EXISTS crm_conversations_rls ON public.crm_conversations;
CREATE POLICY crm_conversations_select ON public.crm_conversations FOR SELECT
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('ver_conversas')) OR public.crm_is_admin());
CREATE POLICY crm_conversations_write ON public.crm_conversations FOR ALL
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('responder')) OR public.crm_is_admin())
  WITH CHECK ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('responder')) OR public.crm_is_admin());

-- crm_messages
DROP POLICY IF EXISTS crm_messages_rls ON public.crm_messages;
CREATE POLICY crm_messages_select ON public.crm_messages FOR SELECT
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('ver_conversas')) OR public.crm_is_admin());
CREATE POLICY crm_messages_insert ON public.crm_messages FOR INSERT
  WITH CHECK ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('responder')) OR public.crm_is_admin());
CREATE POLICY crm_messages_update ON public.crm_messages FOR UPDATE
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('ver_conversas')) OR public.crm_is_admin())
  WITH CHECK ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('ver_conversas')) OR public.crm_is_admin());
CREATE POLICY crm_messages_delete ON public.crm_messages FOR DELETE
  USING (public.crm_is_admin());

-- crm_contacts
DROP POLICY IF EXISTS crm_contacts_rls ON public.crm_contacts;
CREATE POLICY crm_contacts_select ON public.crm_contacts FOR SELECT
  USING ((cliente_id = public.crm_current_cliente_id() AND (public.crm_has_perm('ver_conversas') OR public.crm_has_perm('ver_oportunidades'))) OR public.crm_is_admin());
CREATE POLICY crm_contacts_insert ON public.crm_contacts FOR INSERT
  WITH CHECK ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('add_contato')) OR public.crm_is_admin());
CREATE POLICY crm_contacts_update ON public.crm_contacts FOR UPDATE
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('editar_contato')) OR public.crm_is_admin())
  WITH CHECK ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('editar_contato')) OR public.crm_is_admin());
CREATE POLICY crm_contacts_delete ON public.crm_contacts FOR DELETE
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('excluir_contato')) OR public.crm_is_admin());

-- crm_opportunities
DROP POLICY IF EXISTS crm_opportunities_rls ON public.crm_opportunities;
CREATE POLICY crm_opportunities_select ON public.crm_opportunities FOR SELECT
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('ver_oportunidades')) OR public.crm_is_admin());
CREATE POLICY crm_opportunities_write ON public.crm_opportunities FOR ALL
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('gerir_oportunidades')) OR public.crm_is_admin())
  WITH CHECK ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('gerir_oportunidades')) OR public.crm_is_admin());

-- crm_pipelines
DROP POLICY IF EXISTS crm_pipelines_rls ON public.crm_pipelines;
CREATE POLICY crm_pipelines_select ON public.crm_pipelines FOR SELECT
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('ver_oportunidades')) OR public.crm_is_admin());
CREATE POLICY crm_pipelines_write ON public.crm_pipelines FOR ALL
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('gerir_oportunidades')) OR public.crm_is_admin())
  WITH CHECK ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('gerir_oportunidades')) OR public.crm_is_admin());

-- crm_pipeline_stages
DROP POLICY IF EXISTS crm_pipeline_stages_rls ON public.crm_pipeline_stages;
CREATE POLICY crm_pipeline_stages_select ON public.crm_pipeline_stages FOR SELECT
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('ver_oportunidades')) OR public.crm_is_admin());
CREATE POLICY crm_pipeline_stages_write ON public.crm_pipeline_stages FOR ALL
  USING ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('gerir_oportunidades')) OR public.crm_is_admin())
  WITH CHECK ((cliente_id = public.crm_current_cliente_id() AND public.crm_has_perm('gerir_oportunidades')) OR public.crm_is_admin());
