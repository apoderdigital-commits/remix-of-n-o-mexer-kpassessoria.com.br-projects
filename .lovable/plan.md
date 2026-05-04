# Remover IA da Dashboard

Objetivo: eliminar qualquer uso de IA na dash para que ninguém consiga consumir créditos do Lovable AI Gateway.

## O que será removido

**Frontend (`src/pages/Criativos.tsx`)**
- Remover botão "Perguntar à IA" (`<AIChat />`)
- Remover bloco de "Insights automáticos" (`<AIInsights />`)
- Remover imports relacionados (`AIChat`, `AIInsights`, `deriveCreativeMovers`, `AIContext`)
- Remover a função `buildAIContext` e cálculos usados só por ela (se não forem usados em outro lugar)

**Componentes deletados**
- `src/components/dashboard/AIChat.tsx`
- `src/components/dashboard/AIInsights.tsx`
- `src/lib/aiContext.ts` (usado apenas pelos dois acima)

**Edge Functions deletadas (param de cobrar e fecham o vetor de abuso)**
- `chat-dashboard` — chat da IA
- `generate-insights` — insights automáticos
- `send-creative-whatsapp` só será mantida se ainda for usada em outro lugar; vou verificar e remover se for órfã

**Banco de dados**
- Drop da tabela `ai_insights_cache` (cache dos insights — sem uso depois da remoção)

## O que NÃO muda
- Meta Ads sync, webhook de leads, CRM, autenticação, dashboard de KPIs e criativos continuam iguais.
- Nenhum dado de campanha/lead é afetado.

## Resultado
- Zero chamadas ao Lovable AI a partir do app.
- Saldo de IA deixa de ser consumido pela dashboard.
- Some também o risco de segurança apontado no scanner sobre `chat-dashboard` e `generate-insights` sem autenticação.

## Reversível?
Sim — se um dia quiser voltar, dá para reimplementar. Mas o histórico do chat não é guardado hoje, então não há nada a perder.
