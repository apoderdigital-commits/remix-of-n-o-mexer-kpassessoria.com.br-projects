-- ============================================================================
-- CRM · Ajuste 3b — TODO admin do app enxerga o CRM
-- Aponta a função crm_is_admin() (usada na RLS) para a MESMA fonte de admin do
-- app: public.user_roles (role='admin'). Assim, qualquer admin do painel já vê
-- o CRM, sem precisar cadastrar linha em crm_users.
-- Rode depois dos passos 1 e 3. É só um "create or replace" — idempotente e seguro.
-- ============================================================================

create or replace function public.crm_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  )
  or exists (
    select 1 from public.crm_users
    where auth_user_id = auth.uid() and papel = 'admin'
  );
$$;