ALTER TABLE public.squad_task_templates
  ADD COLUMN IF NOT EXISTS target_client_ids uuid[] NULL;

ALTER TABLE public.squad_tasks
  ADD COLUMN IF NOT EXISTS template_id uuid NULL REFERENCES public.squad_task_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_squad_tasks_template ON public.squad_tasks(template_id);