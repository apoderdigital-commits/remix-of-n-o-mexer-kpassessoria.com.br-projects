## Diagnóstico

A dashboard hoje é rica em dados mas sofre de 3 problemas que o gestor/dono sente:

1. **Densidade alta sem hierarquia** — 10 stats cards, 3 rankings de criativos, 3 de vendedores, funil, evolução. Tudo no mesmo nível visual: o gestor não sabe pra onde olhar primeiro.
2. **Falta de "régua"** — números aparecem mas não fica claro se é bom ou ruim. Existe meta, mas falta comparar com mês anterior, ritmo do mês, e benchmark de criativos individuais.
3. **Análise dos criativos é manual** — vê-se quem é o top 1, mas não se ele está acelerando, perdendo força ou se tem criativo subindo rápido que merece escala.

A proposta abaixo é uma evolução em 4 camadas, na ordem de maior impacto para o dono.

---

## Camada 1 — Resumo Executivo (topo da página)

Uma faixa única acima de tudo, substituindo a leitura visual de 10 cards.

```text
┌─────────────────────────────────────────────────────────────────────┐
│  STATUS DA OPERAÇÃO · Abril/2026 · Atualizado há 12 min             │
│                                                                      │
│  ● SAUDÁVEL  ·  Ritmo p/ fechar 142 vendas (meta 150)               │
│  ▲ +18% leads  ▲ +9% aprovados  ▼ -4% conversão fin/aprov vs Março │
│                                                                      │
│  3 ações sugeridas:                                                  │
│    🔺 Escalar: criativo "fb.me/8ve…" subiu 47% essa semana          │
│    ⏸  Pausar: criativo "fb.me/63w…" caiu 60% nos últimos 7 dias    │
│    ⚠  Conversão de Welton caiu 22% — checar pipeline                │
└─────────────────────────────────────────────────────────────────────┘
```

- Calculado a partir dos dados que já existem (sem novas integrações).
- Health score: combinação de (ritmo vs meta mensal, taxa fin/aprov, % criativos validados ativos).
- Botão "ver detalhes" leva ao bloco correspondente.

---

## Camada 2 — Comparativo Mês vs Mês

Toggle no topo do filtro de data: **"Comparar com período anterior"**.

Quando ativo, cada KPI passa a mostrar:

```text
Total de Leads
2.847
▲ +18%  (vs 2.412 em Março)
```

Aplicado a: Investimento, Leads, CPL, Simulações, CPF Aprovado, Vendas Fin, Vendas Cons, e nas barras do funil.

Adicionalmente, uma nova seção **"Tendência mensal"** (1 gráfico):
- Barras agrupadas dos últimos 3-6 meses para Leads / CPF Aprovado / Vendas
- Permite ver se o mês atual está acelerando ou desacelerando

---

## Camada 3 — Inteligência por Criativo

Hoje o ranking mostra só volume total. Adicionar 3 sinais por criativo no card expandido:

1. **Tendência 7d vs 7d anterior** — seta + % (subindo, estável, caindo)
2. **Status sugerido** — badge automática:
   - 🚀 **Escalar** — top 3 e crescendo
   - ✅ **Validado** — tem ≥ X aprovações + Y dias rodando
   - ⚠ **Em queda** — caiu >30% últimos 7 dias
   - 🆕 **Novo** — primeira semana
3. **Ação rápida** — botão "marcar como pausado" / "marcar para escalar" (anotação salva no banco, aparece pra outros usuários)

Mesma lógica replicada para vendedores: tendência da semana + badge (líder, em queda, sub-meta).

---

## Camada 4 — Insights com IA (Lovable AI)

Botão **"Gerar análise do período"** (ou auto a cada acesso, com cache de 1h):

Edge function `generate-insights` recebe os dados agregados e devolve:
- Resumo em 3 frases do que está funcionando e o que não está
- 3 recomendações priorizadas (escalar / pausar / investigar)
- Comparação narrativa com mês anterior

Usa `google/gemini-3-flash-preview` via Lovable AI (já configurado, sem nova chave).

Aparece como card no topo, abaixo do Resumo Executivo, expansível.

---

## Ordem de implementação sugerida

| Fase | Entrega | Impacto | Esforço |
|------|---------|---------|---------|
| **1** | Resumo Executivo (sem IA) + Health score | Alto | Médio |
| **2** | Comparativo mês vs mês (toggle + tendência mensal) | Alto | Médio |
| **3** | Sinais por criativo (tendência + badge automática) | Alto | Médio |
| **4** | Ações operacionais (pausar/escalar com salvamento) | Médio | Médio |
| **5** | Insights com IA | Médio-Alto | Pequeno |

Recomendo começar pela **Fase 1 + 2** juntas: resolvem as duas dores principais (priorização + contexto) usando 100% dados que já existem na base.

---

## Detalhes técnicos

- **Health score**: função pura no frontend, recebe `{leads, simulações, cpf, vendas, dias_decorridos, dias_restantes, metas}`, devolve `{status: 'saudavel' | 'atencao' | 'critico', score: 0-100, motivos: string[]}`.
- **Comparativo mês vs mês**: nova query em `useDashboardData.ts` que busca o mesmo período do mês anterior em paralelo. Adiciona `previousPeriodComparisons` ao state da página.
- **Tendência por criativo**: derivada no cliente a partir dos `qualified_leads` já carregados (filtra os últimos 14 dias e divide em duas janelas de 7).
- **Anotações de criativo**: nova tabela `creative_actions` com `(client_id, creative_name, status, note, user_id, created_at)` + RLS por client access. Aparece na linha do ranking e no card expandido.
- **IA**: edge function `generate-insights` usando Lovable AI Gateway (`google/gemini-3-flash-preview`), recebe os mesmos dados agregados que o componente Resumo Executivo já calcula. Resposta em JSON estruturado via tool calling.

---

## Fora do escopo (propositalmente)

- Criar abas separadas por perfil — público é gestor/dono, mantemos vista única.
- Notificações push / WhatsApp de alertas — pode vir depois, depende de validar quais alertas geram ação real.
- Exportar PDF/CSV — útil mas não resolve dor principal de "muita informação difícil de priorizar".

---

Posso começar pela **Fase 1 (Resumo Executivo + Health Score)**? Ou prefere outra ordem?
