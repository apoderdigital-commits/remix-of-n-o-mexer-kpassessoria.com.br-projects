# Portal Squad CS — Dashboard interna dos colaboradores

Migrar a planilha "Dashboard CS KP Agency" para dentro do Lovable, com isolamento por **squad**: cada colaborador só enxerga os clientes do(s) squad(s) ao qual o admin o associou. Vamos por fases para não quebrar nada.

---

## Modelo de acesso

- Nova role: **`collaborator`** (admin/manager seguem como hoje).
- Novas tabelas:
  - `squads` — cada planilha vira 1 squad (nome, cor, descrição).
  - `squad_members` — relação `user_id ↔ squad_id` (admin define).
  - Cada cliente/registro do squad pertence a 1 squad → RLS filtra por squad do usuário.
- Admin: vê tudo e gerencia squads e membros.
- Colaborador: vê só os squads em que foi adicionado.
- **Não mistura** com a base de "Clientes" da dash de Criativos — é um banco separado (tabelas `squad_*`).

## Onde aparece

- Novo card **"Dash do Squad"** na home (`/`), posicionado **acima** do "Dashboard de Criativos".
- Visível só para `admin`, `manager` e `collaborator`. Cliente final nunca vê.
- Rota: `/squad`.

---

## Fase 1 — Fundação + Dados Clientes (começar por aqui)

**Backend**
- Adicionar role `collaborator` ao enum.
- Tabelas: `squads`, `squad_members`, `squad_clients`.
- `squad_clients` (campos da aba "Dados Clientes"): cliente, nicho, serviços (CRM/TP/COM), data entrada, data vencimento, dias para vencer (calculado), renovação 60d, curva ABC, sprint, priorização, BM verificada, valor investido TP, observações.
- RLS:
  - Admin: tudo.
  - Colaborador/manager: só linhas cujo `squad_id` está em `squad_members` do usuário.
- Função `user_squads()` (security definer) para evitar recursão.

**Frontend**
- Card novo na home (acima do card de Criativos), só para equipe interna.
- Página `/squad`: seletor de squad → tabela de clientes editável (CRUD).
- Página admin `/squad/admin`: criar squads, adicionar/remover membros.

**Importação**
- Importo a aba "Dados Clientes" da planilha como squad inicial **"Squad CS KP"**. ~200 clientes preenchidos.

## Fase 2 — Métricas CS mensais + Motivo de Churn
- Tabela `squad_monthly_metrics` (mês, ativos, fora da meta, churn, entradas, renovação, motivo, qtde mensais, % calls, upsell, LT).
- Tabela `squad_churn` (cliente, mês entrada, mês churn, motivo, meses vigentes).
- Telas de visualização + edição mensal.
- Importo histórico existente.

## Fase 3 — NPS + Engajamento mensal
- Tabela `squad_nps` (período, clientes, respostas, detratores/neutros/promotores, NPS, engajamento médio).
- Tabela `squad_engagement` (mês, cliente, ponto de contato, curva, sprint, nota engajamento 1-5, NPS, observação).
- Importo as 4 abas mensais existentes (JAN/FEV/MAR/ABRIL 2026).

## Fase 4 — Agenda mensal de consultoria
- Tabela `squad_agenda` (mês, categoria, cliente, responsável, data reunião, horário, realizada).
- Tela de calendário/lista por mês.
- Importo as 4 agendas mensais existentes.

---

## Detalhes técnicos (resumo)

```
squads (id, name, color, description, created_at)
squad_members (id, squad_id, user_id, added_by, created_at)  UNIQUE(squad_id,user_id)
squad_clients (id, squad_id, name, niche, services, entry_date, due_date,
               renewal_60d, curve_abc, sprint, prioritization, bm_verified,
               invested_tp, observations, created_at, updated_at)
squad_monthly_metrics (id, squad_id, month, ...)
squad_churn (id, squad_id, client_name, entry_month, churn_month, reason, ...)
squad_nps (id, squad_id, period, ...)
squad_engagement (id, squad_id, month, client_name, contact, ...)
squad_agenda (id, squad_id, month, category, client_name, responsible, meeting_date, time, done)
```

Helper SQL:
```sql
create function user_in_squad(_sid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select has_role(auth.uid(),'admin')
      or exists(select 1 from squad_members where squad_id=_sid and user_id=auth.uid())
$$;
```

RLS padrão em todas as tabelas `squad_*`: `USING (user_in_squad(squad_id))`. Admin tem policy ALL separada.

---

## O que vou entregar no próximo passo (Fase 1)

1. Migration: role `collaborator`, tabelas `squads`, `squad_members`, `squad_clients` + RLS.
2. Card "Dash do Squad" na home (acima do card de Criativos), visível só para equipe.
3. Página `/squad` com seletor de squad e tabela CRUD de clientes.
4. Página `/squad/admin` para admin criar squads e atribuir colaboradores.
5. Import inicial: squad "CS KP" + ~200 clientes da aba "Dados Clientes".

Fases 2/3/4 só depois que a Fase 1 estiver validada por você.
