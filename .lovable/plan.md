# Reforma da página de Tarefas

## 1. Limpeza
- Apagar **todos** os registros em `squad_task_templates` (você relatou que o último template bugou).

## 2. Banco — novos campos e tabelas

**`squad_task_templates`** (templates de tarefas)
- `default_assignee_id uuid` — responsável padrão pré-selecionado.
- `recurrence_mode text` (`weekdays` | `interval`) — como repetir.
- `recurrence_weekdays int[]` — dias da semana (0=dom … 6=sáb) quando `weekdays`.
- `recurrence_interval_days int` — "a cada N dias" quando `interval`.
- (campos atuais `priority`, `description`, `due_days_offset` continuam.)

**`squad_tasks`**
- Novo status permitido: `standby`.
- `standby_reason text` — preenchido quando status vira `standby`.
- `standby_at timestamptz`.

**Nova tabela `squad_task_date_changes`** (auditoria para o gestor)
- `task_id`, `user_id`, `old_due_date`, `new_due_date`, `reason text`, `created_at`.
- RLS: membros do squad veem; quem alterou insere.

## 3. UI — renomeações
- "Gerar ciclo" → **Criar tarefa recorrente**.
- "Templates" (botão na lista) → **Templates de tarefas**.

## 4. Formulário de **template** (Templates de tarefas)
Adiciona/expõe:
- Título, **Descrição** (já existe, fica em destaque),
- **Responsável padrão** (dropdown dos membros do squad),
- **Prioridade** (já existe),
- **Vencimento (dias após gerar)** (já existe).

## 5. Diálogo **Criar tarefa recorrente** (substitui o popover "Gerar ciclo")
- Escopo: só este cliente / todos os clientes do squad (como hoje).
- **Quando recriar** (modo de recorrência):
  - `Dias da semana` → checkboxes Dom–Sáb.
  - `A cada N dias` → input numérico.
- Pré-preenche com o que estiver salvo no template; permite override por execução.
- Persistido no template para uso posterior.

> Observação: a regeneração automática continua manual (botão), mas o `cycle_key` e as datas geradas passam a respeitar a recorrência escolhida.

## 6. Nova aba **Home** (vira a tela inicial)
- Substitui o auto-select do primeiro cliente.
- Mostra: "Tarefas de hoje" agrupadas **por squad → por cliente**, com contadores (a fazer / em andamento / stand by / atrasadas).
- Clicar num cliente abre a visão "Por cliente" naquele cliente.
- Card com totais do dia no topo (estilo ClickUp Home da sua referência).

## 7. Sidebar "Por cliente" agrupada por squad
- Lista de clientes na sidebar passa a ser **agrupada por squad** (com header e contagem por squad), em vez de tudo misturado. Casa com a estrutura "Squad 01 → clientes" da sua referência.

## 8. Conclusão de tarefa com confirmação
- Ao marcar `done` via checkbox/dialog, abre um mini-dialog: **"Concluir tarefa?"** com botão Confirmar/Cancelar.

## 9. Status **Stand By** com motivo
- Novo item nos selects de status: "Stand By".
- Ao escolher Stand By, abre dialog pedindo o motivo (obrigatório). Salva em `standby_reason` + `standby_at`.
- Badge laranja-amarelado na linha da tarefa; tooltip mostra o motivo.

## 10. Mudança de data na **Melhoria Contínua** com justificativa
- Ao alterar `due_date` de uma tarefa cujo `list_key = 'melhoria_continua'`, antes de salvar abre dialog **"Por que está mudando a data?"** (motivo obrigatório).
- Cada alteração grava em `squad_task_date_changes`, visível só pro gestor (admin) num bloco "Auditoria de prazos" no topo do cliente (lista enxuta: tarefa, de → para, motivo, autor, data).

## Fora de escopo
- Não vou mexer em pipeline comercial / Meta ADS / GHL.
- Não vou criar recorrência automática agendada (cron). A geração continua disparada pelo botão "Criar tarefa recorrente".
- Templates atuais serão apagados — você vai recriar com os campos novos.

Confirma pra eu aplicar?
