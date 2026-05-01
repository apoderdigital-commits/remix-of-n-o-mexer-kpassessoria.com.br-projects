## Mudança no Resumo Executivo

Simplificar o bloco "Resumo Executivo" no topo da dashboard, removendo o que não agrega e mantendo só o que o gestor quer ver de relance.

### O que sai

- **Badge de Status** (Saudável / Atenção / Crítico + score X/100) no canto superior direito.
- **Card "Ritmo do mês"** (coluna 1) — vendas projetadas, realizadas, CPFs.
- **Card "Por que esse status"** (coluna 3) — lista de motivos do health score.
- Toda a lógica de cálculo de health score e pacing some junto (não fica código morto).

### O que fica

- **Header** do bloco (ícone + título "Status da operação · {mês}") — mantido como cabeçalho do bloco.
- **Card "vs período anterior"** — agora ocupando posição de destaque, com Leads, CPFs aprovados, Vendas e CPL.
- **Sugestões de Escalar / Avaliar pausa** — os dois cards de criativos em alta/queda, logo abaixo.

### Layout resultante

```text
┌──────────────────────────────────────────────────────────────┐
│  ✦ RESUMO EXECUTIVO                                           │
│    Status da operação · Maio                                  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ~ vs período anterior                                  │  │
│  │  Leads              ↗ +45.0%                            │  │
│  │  CPFs aprovados     ↗ +31.0%                            │  │
│  │  Vendas             ↗ +12.5%                            │  │
│  │  CPL                ↘ -10.3%                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │ ↗ SUGESTÃO · ESCALAR    │  │ ↘ AVALIAR PAUSA         │   │
│  │ insta.com/p/X subiu     │  │ insta.com/p/Y caiu      │   │
│  │ +100% nos últimos 7d.   │  │ -67% vs semana anterior │   │
│  └─────────────────────────┘  └─────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

Talvez valha repensar até o nome do bloco — "Resumo Executivo / Status da operação" deixa de fazer tanto sentido sem o status. Sugestão: renomear para algo como **"Destaques do período"** ou **"O que mudou"**. Pergunto isso abaixo.

### Detalhes técnicos

- Arquivo afetado: `src/components/dashboard/ExecutiveSummary.tsx`.
- Remover: bloco `health` (useMemo), bloco `pacing` (useMemo), `statusConfig`, badge no header, coluna de pacing, coluna de "Por que esse status".
- Remover imports não usados: `CheckCircle2`, `AlertTriangle`, `Target`, `Activity` (manter só os que sobrarem).
- Manter: `deltas`, `movers`, helpers `fmtPct`, `deltaPct`, `shortenName`, componente `DeltaRow`.
- O grid principal deixa de ser 3 colunas — o card "vs período anterior" passa a ocupar a largura inteira (ou ~60% num layout mais respirado).
- Em `src/pages/Criativos.tsx`, as props `simulacoes`, `cpfAprovado`, `vendasFinanciamento`, `vendasConsorcio`, `totalSpent`, `cpl` deixam de ser usadas internamente para health score, mas seguem sendo necessárias pra calcular os deltas — então a chamada do componente continua igual.
- Nada de mudança de schema/banco.
