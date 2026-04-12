

## Unificação de Clientes — Plano Seguro

### Contexto

O Dashboard de Criativos já usa `client_id` (UUID) em todas as tabelas (`meta_campaigns`, `qualified_leads`). **Nenhuma query ou lógica do dashboard de criativos será alterada.** O risco é zero para essa parte.

O Funil de Projeção usa `client_name` (texto) na tabela `simulations` — mas você confirmou que pode apagar as simulações existentes e recomeçar.

---

### Etapas

**1. Migration: adicionar `client_id` à tabela `simulations` e limpar dados antigos**
```sql
-- Adicionar coluna client_id referenciando clients
ALTER TABLE public.simulations ADD COLUMN client_id uuid REFERENCES public.clients(id);

-- Limpar simulações antigas (conforme autorizado)
DELETE FROM public.simulations;
```

**2. Expandir formulário de clientes (`src/pages/Clients.tsx`)**
- Adicionar campo "Ticket Médio" ao dialog de criar/editar
- Adicionar coluna "Ticket Médio" na tabela de listagem
- Campo já existe no banco (`ticket_medio` na tabela `clients`)

**3. Remover aba "Clientes" do Funil de Projeção (`src/pages/Projecao.tsx`)**
- Remover import e TabContent do `ClientManager`
- Reduzir de 5 para 4 abas

**4. Deletar `src/components/projecao/ClientManager.tsx`**

**5. Atualizar `FunnelAnalysis.tsx` para usar `client_id`**
- Salvar simulações com `client_id` em vez de `client_name`
- Buscar simulações por `client_id` em vez de `client_name`
- Manter toda lógica de cálculo intacta (não mexe em fórmulas)

**6. Atualizar `FunnelComparison.tsx`, `ScaleScenarios.tsx`, `ReverseFunnel.tsx`**
- Onde houver referência a `client_name` para queries, trocar por `client_id`

---

### O que NÃO muda
- Nenhuma query do Dashboard de Criativos
- Nenhum cálculo do funil (CPL, leads, vendas, taxas)
- Nenhuma edge function
- Nenhuma tabela de meta_campaigns ou qualified_leads
- RLS policies existentes

