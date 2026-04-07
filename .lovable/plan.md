

## Gerar Script Completo do Dashboard para GoHighLevel

### O que vou fazer

Vou gerar um documento de texto completo em `/mnt/documents/` com **todo o código-fonte do projeto organizado**, pronto para você copiar e colar no novo projeto Lovable dentro do GoHighLevel. O documento terá:

1. **Todas as instruções e contexto** — explicação do que cada parte faz, para que o Lovable do GHL entenda e recrie
2. **Todo o código dos componentes** — StatsCards, CreativeRanking, EvolutionChart, DateFilter, ClientSelector
3. **O CSS/tema completo** — variáveis, glassmorphism, cores roxas
4. **Os hooks de dados** — useDashboardData com queries do Supabase
5. **A página principal (Index)** — sem login, sem rotas protegidas, sem seletor de cliente (hardcoded para 1 cliente)
6. **Edge Functions** — fetch-meta-data, sync-google-sheet, unfurl-url, webhook-qualified-leads
7. **Schema do banco** — tabelas, RLS, functions SQL
8. **Logo** — incluída como asset

### Adaptações para cliente individual (sem login)
- Remover todo o sistema de autenticação (useAuth, Login, ProtectedRoute)
- Remover seletor de clientes — o `client_id` será uma constante configurável
- Remover botão de logout
- Manter: DateFilter, StatsCards, CreativeRanking, EvolutionChart, Sync Meta, Sync Planilha
- Manter: hero header com logo KP e frase

### Formato do arquivo
Um único arquivo `.md` organizado por seções, com blocos de código completos que podem ser copiados diretamente. Cada seção terá uma instrução clara do que criar.

### Arquivos incluídos
- `src/index.css` (tema)
- `src/pages/Index.tsx` (adaptado sem auth)
- `src/components/dashboard/*` (todos os 5 componentes)
- `src/hooks/useDashboardData.ts`
- `supabase/functions/fetch-meta-data/index.ts`
- `supabase/functions/sync-google-sheet/index.ts`
- `supabase/functions/unfurl-url/index.ts`
- `supabase/functions/webhook-qualified-leads/index.ts`
- SQL migrations (schema completo)
- `tailwind.config.ts`

