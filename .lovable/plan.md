
# Plataforma de Tarefas (estilo ClickUp)

Nova página `/tarefas` para gestão de tarefas dos squads, organizada por cliente → lista → tarefa, com responsáveis vinculados às funções dos usuários.

## Estrutura conceitual

```
Cliente (pasta — vem de squad_clients)
 └─ Lista (8 fixas)
     ├─ Jornada Inicial          (única)
     ├─ Gestor de Tráfego Sem.   (semanal)
     ├─ Gestor de Tráfego Mensal (mensal)
     ├─ Head Semanal             (semanal)
     ├─ Head Mensal              (mensal)
     ├─ Ex. de Projetos Sem.     (semanal)
     ├─ Ex. de Projetos Mensal   (mensal)
     └─ Melhoria Contínua        (avulso)
        └─ Tarefa (título, responsável, prioridade, vencimento, status)
```

As 8 listas são **fixas no código** (não viram tabela) — cada tarefa apenas guarda a chave da lista. Isso garante padronização entre clientes.

## Fase 1 — escopo entregue agora

1. **Cadastro de função do usuário** (tela Usuários)
   - Novo campo "Função no squad": `gestor_trafego` | `head` | `especialista_projetos` | `sem_funcao`.
   - Mudou ali → reflete como responsável-padrão em todos os clientes.
2. **Override por cliente** (tela do cliente, área admin)
   - Admin pode trocar quem é o Gestor/Head/Especialista naquele cliente específico, sem mexer no global.
3. **Página `/tarefas`**
   - Sidebar esquerda: lista de clientes do squad (busca + contador de tarefas abertas).
   - Conteúdo: 8 listas em accordion/colunas, cada uma com contador (abertas/total) e botão "+ Nova tarefa".
   - Linha de tarefa: checkbox status, título editável, badge de prioridade, data de vencimento, avatar do responsável.
   - Filtros no topo: minhas tarefas / todas, status, prioridade.
4. **CRUD de tarefa** via dialog: título, descrição, lista, responsável (default = quem tem a função daquela lista no cliente), prioridade, vencimento, status.
5. **Acesso**
   - Admin: vê e edita tudo.
   - Colaborador: vê todos os clientes do(s) seu(s) squad(s), mas só edita/conclui tarefas **atribuídas a ele**. Pode criar tarefas em "Melhoria Contínua".

**Fora da Fase 1** (fica para depois, conforme você validou):
- Templates por função/cadência + recorrência automática.
- Visões "Minhas tarefas" e "Por cadência" como páginas próprias (na Fase 1 só o filtro "minhas" dentro do cliente).
- Comentários, anexos, subtarefas.

## Detalhes técnicos

### Banco (migration)

```sql
-- Função do colaborador no squad (1 por usuário)
alter table profiles add column squad_function text;
  -- valores: 'gestor_trafego' | 'head' | 'especialista_projetos' | null

-- Override por cliente (opcional)
create table squad_client_assignments (
  id uuid pk,
  squad_client_id uuid not null,   -- FK squad_clients.id
  function text not null,          -- gestor_trafego | head | especialista_projetos
  user_id uuid not null,           -- auth.users.id
  unique(squad_client_id, function)
);

-- Tarefas
create table squad_tasks (
  id uuid pk,
  squad_client_id uuid not null,   -- FK squad_clients.id
  list_key text not null,          -- 'jornada_inicial' | 'gt_semanal' | 'gt_mensal'
                                   --  'head_semanal' | 'head_mensal'
                                   --  'ep_semanal' | 'ep_mensal' | 'melhoria_continua'
  title text not null,
  description text,
  assignee_id uuid,                -- auth.users.id (resolvido na criação)
  priority text default 'normal',  -- urgent | high | normal | low
  status text default 'todo',      -- todo | doing | done
  due_date date,
  created_by uuid,
  created_at, updated_at, completed_at
);
create index on squad_tasks(squad_client_id, list_key, status);
```

RLS:
- `squad_tasks` SELECT: admin OR `user_in_squad(squad_client → squad_id)`.
- UPDATE/DELETE: admin OR `assignee_id = auth.uid()` OR criador.
- INSERT: admin OR membro do squad (sempre setando `created_by = auth.uid()`).
- `squad_client_assignments`: admin gerencia; membros do squad leem.
- `profiles.squad_function`: admin atualiza qualquer; usuário lê o próprio (já coberto).

### Frontend

- Rota nova `/tarefas` em `src/App.tsx` (ProtectedRoute, sem `adminOnly` — qualquer usuário logado entra; quem não tem squad vê estado vazio).
- Card novo no Portal "Tarefas do Squad" acima do "Painel Comercial KP".
- Páginas/arquivos:
  - `src/pages/Tarefas.tsx` — layout sidebar de clientes + listas.
  - `src/components/tarefas/ClientSidebar.tsx`
  - `src/components/tarefas/TaskList.tsx` (uma das 8 listas)
  - `src/components/tarefas/TaskRow.tsx`
  - `src/components/tarefas/TaskDialog.tsx` (criar/editar)
  - `src/components/tarefas/ClientAssignmentsCard.tsx` (admin, override por cliente)
- Em `src/pages/UsersPage.tsx`: adicionar seletor de "Função no squad" por usuário.
- Resolver responsável padrão: `assignment override` do cliente, senão primeiro `profiles.squad_function = X` do squad daquele cliente.
- Mantém tema dark glassmorphism + roxo já existente (semantic tokens do `index.css`).

## Próximo passo

Aprova esse plano que eu já parto para a migration + UI.
