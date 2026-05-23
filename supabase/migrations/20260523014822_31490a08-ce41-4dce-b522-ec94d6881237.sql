
-- 1) cycle_key on tasks
ALTER TABLE public.squad_tasks ADD COLUMN IF NOT EXISTS cycle_key text;
CREATE INDEX IF NOT EXISTS idx_squad_tasks_cycle ON public.squad_tasks(squad_client_id, list_key, cycle_key);

-- 2) Templates
CREATE TABLE IF NOT EXISTS public.squad_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  list_key text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  due_days_offset integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_squad_list ON public.squad_task_templates(squad_id, list_key);
ALTER TABLE public.squad_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage templates" ON public.squad_task_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Squad members view templates" ON public.squad_task_templates
  FOR SELECT TO authenticated
  USING (user_in_squad(squad_id));
CREATE POLICY "Squad members insert templates" ON public.squad_task_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_in_squad(squad_id) AND created_by = auth.uid());
CREATE POLICY "Squad members update templates" ON public.squad_task_templates
  FOR UPDATE TO authenticated
  USING (user_in_squad(squad_id))
  WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Squad members delete templates" ON public.squad_task_templates
  FOR DELETE TO authenticated
  USING (user_in_squad(squad_id));

CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.squad_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Subtasks
CREATE TABLE IF NOT EXISTS public.squad_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON public.squad_subtasks(task_id, position);
ALTER TABLE public.squad_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subtasks" ON public.squad_subtasks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Squad members view subtasks" ON public.squad_subtasks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.squad_tasks t
    JOIN public.squad_clients sc ON sc.id = t.squad_client_id
    WHERE t.id = squad_subtasks.task_id AND user_in_squad(sc.squad_id)
  ));
CREATE POLICY "Squad members insert subtasks" ON public.squad_subtasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.squad_tasks t
      JOIN public.squad_clients sc ON sc.id = t.squad_client_id
      WHERE t.id = squad_subtasks.task_id AND user_in_squad(sc.squad_id)
    )
  );
CREATE POLICY "Squad members update subtasks" ON public.squad_subtasks
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.squad_tasks t
    JOIN public.squad_clients sc ON sc.id = t.squad_client_id
    WHERE t.id = squad_subtasks.task_id AND user_in_squad(sc.squad_id)
  ));
CREATE POLICY "Subtask author or admin delete" ON public.squad_subtasks
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_subtasks_updated BEFORE UPDATE ON public.squad_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Comments
CREATE TABLE IF NOT EXISTS public.squad_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_task ON public.squad_task_comments(task_id, created_at);
ALTER TABLE public.squad_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Squad members view comments" ON public.squad_task_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.squad_tasks t
    JOIN public.squad_clients sc ON sc.id = t.squad_client_id
    WHERE t.id = squad_task_comments.task_id AND user_in_squad(sc.squad_id)
  ));
CREATE POLICY "Squad members insert comments" ON public.squad_task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.squad_tasks t
      JOIN public.squad_clients sc ON sc.id = t.squad_client_id
      WHERE t.id = squad_task_comments.task_id AND user_in_squad(sc.squad_id)
    )
  );
CREATE POLICY "Comment author or admin delete" ON public.squad_task_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 5) Attachments
CREATE TABLE IF NOT EXISTS public.squad_task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON public.squad_task_attachments(task_id, created_at);
ALTER TABLE public.squad_task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Squad members view attachments" ON public.squad_task_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.squad_tasks t
    JOIN public.squad_clients sc ON sc.id = t.squad_client_id
    WHERE t.id = squad_task_attachments.task_id AND user_in_squad(sc.squad_id)
  ));
CREATE POLICY "Squad members insert attachments" ON public.squad_task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.squad_tasks t
      JOIN public.squad_clients sc ON sc.id = t.squad_client_id
      WHERE t.id = squad_task_attachments.task_id AND user_in_squad(sc.squad_id)
    )
  );
CREATE POLICY "Attachment author or admin delete" ON public.squad_task_attachments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 6) Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Squad members read task files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments' AND (
      has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
        SELECT 1 FROM public.squad_task_attachments a
        JOIN public.squad_tasks t ON t.id = a.task_id
        JOIN public.squad_clients sc ON sc.id = t.squad_client_id
        WHERE a.file_path = storage.objects.name AND user_in_squad(sc.squad_id)
      )
    )
  );

CREATE POLICY "Squad members upload task files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Attachment author or admin delete files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-attachments' AND (
      has_role(auth.uid(), 'admin'::app_role) OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );
