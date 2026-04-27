-- 1. Add soft-delete column
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON public.clients(deleted_at);

-- 2. Replace SELECT policies to hide soft-deleted from regular queries
DROP POLICY IF EXISTS "Authorized users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Client users can view own client" ON public.clients;
DROP POLICY IF EXISTS "Admins can view trashed clients" ON public.clients;

CREATE POLICY "Authorized users can view active clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Client users can view own active client"
ON public.clients
FOR SELECT
TO authenticated
USING (deleted_at IS NULL AND user_id = auth.uid());

CREATE POLICY "Admins can view trashed clients"
ON public.clients
FOR SELECT
TO authenticated
USING (deleted_at IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
