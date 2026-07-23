-- ============================================================================
-- CRM Multi-conta · Fase 1 (banco) — papéis, permissões e RLS de agência
-- Modelo estilo GoHighLevel:
--   • AGÊNCIA  = admin do app (public.user_roles role='admin')  -> vê TODAS as subcontas
--   • ADMIN    = crm_users.papel='admin'    -> administra só a SUA subconta
--   • USUÁRIO  = crm_users.papel='usuario'  -> limitado pelas permissões (jsonb)
-- Cada subconta = uma linha em crm_clients (conversas/contatos/oportunidades/Z-API próprias).
-- Rode depois dos passos anteriores. Idempotente.
-- ============================================================================

-- 1) papel: só 'admin' (adm da subconta) e 'usuario' (limitado) -------------
update public.crm_users set papel = 'admin'   where papel = 'gestor';
update public.crm_users set papel = 'usuario' where papel = 'atendente';
alter table public.crm_users drop constraint if exists crm_users_papel_check;
alter table public.crm_users add constraint crm_users_papel_check check (papel in ('admin','usuario'));
alter table public.crm_users alter column papel set default 'usuario';

-- 2) permissões granulares por usuário (usadas quando papel='usuario') ------
--    ex.: { "ver_conversas": true, "responder": true, "add_contato": false, ... }
alter table public.crm_users add column if not exists permissoes jsonb not null default '{}'::jsonb;

-- 3) AGÊNCIA = admin do app. crm_is_agencia() é a fonte; crm_is_admin() vira
--    alias pra não quebrar as policies que já a usam. IMPORTANTE: a partir daqui
--    um adm de subconta (crm_users.papel='admin') NÃO enxerga outras subcontas —
--    só a dele. Quem vê tudo é a agência (admin do app).
create or replace function public.crm_is_agencia()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.crm_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.crm_is_agencia();
$$;
