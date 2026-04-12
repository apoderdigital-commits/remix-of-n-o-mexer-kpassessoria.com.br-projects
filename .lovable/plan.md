

## Desativar Guia IA — Manter botão "Em Construção"

### Resumo
Manter o botão "Guia IA" visível nos rankings mas desativá-lo funcionalmente. Ao clicar, exibe um toast "Em construção — estamos trabalhando nisso!" em vez de chamar a IA. Remove a edge function e a dependência `react-markdown`.

### Etapas

**1. Simplificar `CreativeGuideButton.tsx`**
- Remover toda lógica de chamada à edge function, Dialog, loading, markdown
- Manter apenas o botão com ícone Sparkles
- Ao clicar: `toast.info("🚧 Em construção — estamos trabalhando para trazer essa funcionalidade em breve!")`
- Adicionar badge/tooltip "Em breve" ou visual que indique construção

**2. Deletar edge function `generate-creative-guide`**
- Remover `supabase/functions/generate-creative-guide/index.ts`
- Deletar a função deployada

**3. Remover `react-markdown`**
- Desinstalar do `package.json`

### O que NÃO muda
- O botão continua aparecendo nos rankings
- Rankings e dados permanecem intactos
- `CreativeRanking.tsx` não precisa de alteração (já importa o botão)

