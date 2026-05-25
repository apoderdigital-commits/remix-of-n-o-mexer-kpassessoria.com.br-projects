-- 1. Templates: novos campos
ALTER TABLE public.squad_task_templates
  ADD COLUMN IF NOT EXISTS default_assignee_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_mode text,
  ADD COLUMN IF NOT EXISTS recurrence_weekdays int[] DEFAULT '{}'::int[],
  ADD COLUMN IF NOT EXISTS recurrence_interval_days int;

ALTER TABLE public.squad_task_templates
  DROP CONSTRAINT IF EXISTS squad_task_templates_recurrence_mode_check;
ALTER TABLE public.squad_task_templates
  ADD CONSTRAINT squad_task_templates_recurrence_mode_check
  CHECK (recurrence_mode IS NULL OR recurrence_mode IN ('weekdays','interval'));

-- 2. Tasks: status standby + motivo
ALTER TABLE public.squad_tasks
  DROP CONSTRAINT IF EXISTS squad_tasks_status_check;
ALTER TABLE public.squad_tasks
  ADD CONSTRAINT squad_tasks_status_check
  CHECK (status IN ('todo','doing','standby','done'));

ALTER TABLE public.squad_tasks
  ADD COLUMN IF NOT EXISTS standby_reason text,
  ADD COLUMN IF NOT EXISTS standby_at timestamptz;

-- 3. Auditoria de mudança de data
CREATE TABLE IF NOT EXISTS public.squad_task_date_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.squad_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  old_due_date date,
  new_due_date date,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_date_changes_task ON public.squad_task_date_changes(task_id);

ALTER TABLE public.squad_task_date_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Squad members view date changes" ON public.squad_task_date_changes;
CREATE POLICY "Squad members view date changes"
  ON public.squad_task_date_changes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.squad_tasks t
    JOIN public.squad_clients sc ON sc.id = t.squad_client_id
    WHERE t.id = squad_task_date_changes.task_id
      AND public.user_in_squad(sc.squad_id)
  ));

DROP POLICY IF EXISTS "Author insert date changes" ON public.squad_task_date_changes;
CREATE POLICY "Author insert date changes"
  ON public.squad_task_date_changes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.squad_tasks t
      JOIN public.squad_clients sc ON sc.id = t.squad_client_id
      WHERE t.id = squad_task_date_changes.task_id
        AND public.user_in_squad(sc.squad_id)
    )
  );

DROP POLICY IF EXISTS "Admin manage date changes" ON public.squad_task_date_changes;
CREATE POLICY "Admin manage date changes"
  ON public.squad_task_date_changes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));