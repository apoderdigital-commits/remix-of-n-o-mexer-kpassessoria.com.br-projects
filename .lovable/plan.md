

## Integrar o Dashboard "Funil de Projeção de Vendas" do projeto PARA OPERACIONAL

### O que será feito

Vou copiar todos os componentes e assets do projeto [PARA OPERACIONAL](/projects/d0d436f9-7ea9-4bfb-822a-c2589d798e02) para dentro deste projeto, criando uma nova rota `/projecao` e adicionando o card no Portal.

### Etapas

**1. Copiar assets do outro projeto**
- `src/assets/wallpaper-kp.png` (fundo do dashboard de projeção)
- A `logo-kp.jpg` já temos equivalente (`kp-logo.png`)

**2. Copiar os 5 componentes para `src/components/projecao/`**
- `FunnelAnalysis.tsx` — Análise & Histórico (simulador de funil)
- `ClientManager.tsx` — Gestão de clientes (do contexto de projeção)
- `FunnelComparison.tsx` — Comparativo (Atual vs Desejado vs Projetado)
- `ScaleScenarios.tsx` — Cenários de escala (1x, 1.5x, 2x, 3x)
- `ReverseFunnel.tsx` — Funil reverso (meta → investimento)

**3. Adaptar os componentes**
- Atualizar imports para usar o `useAuth` deste projeto (mesma interface)
- Os componentes usam tabelas `simulations`, `clients` e `comparison_notes` — precisamos criar essas tabelas neste banco
- A tabela `clients` deste projeto já existe mas tem schema diferente. Vou:
  - Criar tabela `simulations` (nova)
  - Criar tabela `comparison_notes` (nova)
  - Adicionar colunas `ticket_medio` e `share_token` na tabela `clients` existente
  - O `ClientManager` do projeto de projeção será adaptado para usar a tabela `clients` existente

**4. Criar a página `src/pages/Projecao.tsx`**
- Layout com tabs (igual ao Index.tsx do outro projeto): Análise & Histórico, Clientes, Comparativo, Cenários, Funil Reverso
- Header simplificado com botão de voltar ao Portal
- Background com wallpaper + overlay

**5. Adicionar ao Portal e rotas**
- Novo card no array `projects` do Portal: "Funil de Projeção de Vendas"
- Nova rota protegida `/projecao` no `App.tsx`

**6. Migrations do banco de dados**
```sql
-- Tabela simulations
CREATE TABLE public.simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  investimento DECIMAL(12,2) NOT NULL,
  cpl DECIMAL(10,2) NOT NULL,
  leads INTEGER NOT NULL,
  taxa_simulacoes DECIMAL(5,2) DEFAULT 30,
  simulacoes INTEGER NOT NULL,
  taxa_qualificados DECIMAL(5,2) DEFAULT 50,
  qualificados INTEGER NOT NULL,
  taxa_vendas DECIMAL(5,2) DEFAULT 20,
  vendas INTEGER NOT NULL,
  reference_month INTEGER,
  reference_year INTEGER,
  reference_week INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar ticket_medio e share_token na clients existente
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ticket_medio DECIMAL(12,2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Tabela comparison_notes
CREATE TABLE public.comparison_notes (...);

-- RLS em todas as novas tabelas
```

### Resultado final
- No Portal, aparecerá um segundo card "Funil de Projeção de Vendas" ao lado do "Dashboard de Criativos"
- Ao clicar, abre o dashboard completo com as 5 abas, tudo funcionando com o mesmo login e mesmo banco de dados

