
-- 1. Função no squad (no profiles)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS squad_function text
  CHECK (squad_function IN ('gestor_trafego','head','especialista_projetos'));

-- 2. Overrides de responsável por cliente
CREATE TABLE public.squad_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_client_id uuid NOT NULL REFERENCES public.squad_clients(id) ON DELETE CASCADE,
  function text NOT NULL CHECK (function IN ('gestor_trafego','head','especialista_projetos')),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(squad_client_id, function)
);

ALTER TABLE public.squad_client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client assignments"
  ON public.squad_client_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Squad members view client assignments"
  ON public.squad_client_assignments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.squad_clients sc
    WHERE sc.id = squad_client_id AND public.user_in_squad(sc.squad_id)
  ));

CREATE TRIGGER trg_squad_client_assignments_updated
  BEFORE UPDATE ON public.squad_client_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tarefas
CREATE TABLE public.squad_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_client_id uuid NOT NULL REFERENCES public.squad_clients(id) ON DELETE CASCADE,
  list_key text NOT NULL CHECK (list_key IN (
    'jornada_inicial','gt_semanal','gt_mensal','head_semanal','head_mensal',
    'ep_semanal','ep_mensal','melhoria_continua'
  )),
  title text NOT NULL,
  description text,
  assignee_id uuid,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  due_date date,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_squad_tasks_client_list_status
  ON public.squad_tasks(squad_client_id, list_key, status);
CREATE INDEX idx_squad_tasks_assignee
  ON public.squad_tasks(assignee_id);

ALTER TABLE public.squad_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all tasks"
  ON public.squad_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Squad members view tasks"
  ON public.squad_tasks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.squad_clients sc
    WHERE sc.id = squad_client_id AND public.user_in_squad(sc.squad_id)
  ));

CREATE POLICY "Squad members insert tasks"
  ON public.squad_tasks FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.squad_clients sc
      WHERE sc.id = squad_client_id AND public.user_in_squad(sc.squad_id)
    )
  );

CREATE POLICY "Assignee or creator update tasks"
  ON public.squad_tasks FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (assignee_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Creator delete tasks"
  ON public.squad_tasks FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE TRIGGER trg_squad_tasks_updated
  BEFORE UPDATE ON public.squad_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
