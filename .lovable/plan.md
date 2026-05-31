## Objetivo

No painel **Comercial → aba Tráfego**, permitir clicar nos números do funil e nos cards Lead A/B/C para ver **quem são os contatos** (nome). Além disso, ajustar o funil para esconder a etapa de MQLs quando um filtro específico (Lead A/B/C) estiver ativo.

## O que muda

### 1. Funil de Tráfego clicável (etapas: Leads gerados, MQLs, Agendamentos, Comparecimentos)

- Cada barra do funil passa a ser clicável.
- Ao clicar, abre um diálogo (modal) listando os **nomes dos contatos** daquela etapa, respeitando o filtro de categoria ativo (Todos / Lead A / Lead B / Lead C).

### 2. Cards Lead A / Lead B / Lead C (abaixo do funil) clicáveis

- Cada card vira clicável e abre o mesmo diálogo, mostrando os nomes dos contatos daquela categoria.

### 3. Funil sem MQLs quando filtrado por categoria

- Filtro **"Todos"**: funil mostra as 4 etapas (Leads gerados, MQLs, Agendamentos, Comparecimentos) — comportamento atual.
- Filtros **Lead A / Lead B / Lead C**: funil mostra apenas **Leads gerados, Agendamentos e Comparecimentos** (sem MQLs).

## Detalhes técnicos

### Backend — `supabase/functions/kp-comercial-snapshot/index.ts`

- Hoje o funil de tráfego (`trafego`) guarda só contagens (`CatCounts`). Vou adicionar listas de nomes por etapa.
- Criar `trafegoLists` no payload com 4 arrays:
  - `leads`, `mqls`, `agendamentos`, `comparecimentos`
  - Cada item: `{ nome: string; category: "A" | "B" | "C" | "Outro" }`
  - `nome` montado como nos outros pontos do arquivo: ``${c.firstName||""} ${c.lastName||""}`.trim() || c.contactName || c.email || "—"`
- Preencher essas listas nos mesmos laços que já calculam as contagens (linhas ~786–822), sem alterar a lógica de filtragem por tag existente.
- Retornar `trafegoLists` junto de `funis` no objeto de resposta (linha ~916).
- Redeploy automático da função.

```text
trafegoLists = {
  leads:           [{ nome, category }, ...],
  mqls:            [{ nome, category }, ...],
  agendamentos:    [{ nome, category }, ...],
  comparecimentos: [{ nome, category }, ...],
}
```

### Frontend — `src/components/comercial/FunisView.tsx`

- Estender o tipo `FunisData` (ou passar prop separada) com `trafegoLists`.
- `FunnelChart`/`FunnelCard`: aceitar `onStageClick(stageKey)` e tornar cada barra um botão clicável (cursor pointer + hover).
- `TrafegoFunnel`:
  - Receber `trafegoLists` e um callback para abrir o diálogo.
  - Quando `filter !== "Geral"` (ou seja, Lead A/B/C), remover a etapa **MQLs** do array `stages`.
  - Tornar `CatSummary` clicável: cada card (A/B/C) chama o callback com a categoria correspondente.

### Frontend — `src/pages/Comercial.tsx`

- Guardar `trafegoLists` no estado a partir do payload (`applyPayload`).
- Novo estado para o diálogo de detalhe, ex.: `trafegoDrill: { title: string; nomes: string[] } | null`.
- Função que monta a lista filtrada: dada a etapa e o filtro de categoria atual, filtra `trafegoLists[etapa]` por `category` (ou todos quando "Geral") e extrai os nomes.
- Renderizar um `Dialog` reaproveitando o padrão já usado na página, listando os nomes (lista simples de nomes, ordenada).

## Observações

- Os cards inferiores Lead A/B/C hoje refletem a contagem de **MQLs** por categoria; ao clicar, mostrarão os nomes dos MQLs daquela categoria (consistente com o número exibido).
- Snapshots em cache não terão `trafegoLists`; será necessário clicar em **Atualizar** uma vez para popular as listas. Vou tratar ausência de dados com um estado vazio amigável no diálogo.
- Nenhuma mudança de schema/banco é necessária.

&nbsp;