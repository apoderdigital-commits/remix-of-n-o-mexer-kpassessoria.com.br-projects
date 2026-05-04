
-- 1. Add 'collaborator' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collaborator';

-- 2. Squads table
CREATE TABLE public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#8B5CF6',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

-- 3. Squad members
CREATE TABLE public.squad_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (squad_id, user_id)
);
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_squad_members_user ON public.squad_members(user_id);

-- 4. Helper function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.user_in_squad(_squad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_id = _squad_id AND user_id = auth.uid()
    )
$$;

-- 5. Squad clients
CREATE TABLE public.squad_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  name text NOT NULL,
  niche text,
  services text,
  entry_date date,
  due_date date,
  renewal_60d boolean DEFAULT false,
  curve_abc text,
  sprint text,
  prioritization text,
  bm_verified boolean DEFAULT false,
  invested_tp text,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.squad_clients ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_squad_clients_squad ON public.squad_clients(squad_id);

-- 6. RLS policies

-- squads: admin manages, members can view their squads
CREATE POLICY "Admins manage squads"
  ON public.squads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members view their squads"
  ON public.squads FOR SELECT TO authenticated
  USING (user_in_squad(id));

-- squad_members
CREATE POLICY "Admins manage squad members"
  ON public.squad_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own squad memberships"
  ON public.squad_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- squad_clients
CREATE POLICY "Admins manage all squad clients"
  ON public.squad_clients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Squad members view squad clients"
  ON public.squad_clients FOR SELECT TO authenticated
  USING (user_in_squad(squad_id));

CREATE POLICY "Squad members insert squad clients"
  ON public.squad_clients FOR INSERT TO authenticated
  WITH CHECK (user_in_squad(squad_id));

CREATE POLICY "Squad members update squad clients"
  ON public.squad_clients FOR UPDATE TO authenticated
  USING (user_in_squad(squad_id))
  WITH CHECK (user_in_squad(squad_id));

CREATE POLICY "Squad members delete squad clients"
  ON public.squad_clients FOR DELETE TO authenticated
  USING (user_in_squad(squad_id));

-- 7. updated_at triggers
CREATE TRIGGER squads_updated_at BEFORE UPDATE ON public.squads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER squad_clients_updated_at BEFORE UPDATE ON public.squad_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Insert initial squad "CS KP"
INSERT INTO public.squads (name, color, description)
VALUES ('Squad CS KP', '#8B5CF6', 'Squad de Customer Success da KP Agency');
