

## Plano: Reorganizar Stats Cards com Clareza e Contagem de Criativos

### Problema
Os cards estão misturando dados de fontes diferentes (Meta, Planilha, GHL) sem clareza. O usuário quer uma ordem lógica e adicionar contagens de criativos únicos que trouxeram CPFs aprovados e vendas.

### Nova ordem dos cards (2 linhas de 5)

**Linha 1 — Funil de aquisição:**
1. Investimento (Meta)
2. Total de Leads (Meta)
3. Custo / Lead (Meta)
4. Simulações (GHL) — indicador Sim/Leads ≥ 60%
5. CPF Aprovado (GHL) — indicador Aprov/Sim ≥ 15%

**Linha 2 — Resultados:**
6. CPF Não Aprovado (GHL)
7. Vendas Financiamento (Planilha) — indicador Fin/Aprov ≥ 20%
8. Vendas Consórcio (Planilha)
9. Criativos com CPF Aprovado (Planilha) — quantidade de criativos únicos
10. Criativos com Vendas (Planilha) — quantidade de criativos únicos (financiamento + consórcio)

### Alterações técnicas

**`src/pages/Criativos.tsx`**
- Calcular `uniqueCreativesCpf` = número de criativos únicos com status `cpf_approved`
- Calcular `uniqueCreativesSales` = número de criativos únicos com status `sale_financing` ou `sale_consortium`
- Passar esses valores para `StatsCards`

**`src/components/dashboard/StatsCards.tsx`**
- Adicionar props `uniqueCreativesCpf` e `uniqueCreativesSales`
- Reorganizar os cards na ordem acima
- Adicionar 2 novos cards com ícone de imagem/criativo
- Remover card "Custo / Qualificado" e "Custo / Venda" para dar espaço (ou manter se couber)

### Arquivos afetados
- `src/components/dashboard/StatsCards.tsx` — reorganizar cards, adicionar novos
- `src/pages/Criativos.tsx` — calcular criativos únicos e passar como props

