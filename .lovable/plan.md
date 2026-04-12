

## Atualizar token padrão para todos os clientes

### O que muda

Quando o usuário salvar o "Token Padrão da Meta", além de guardar localmente para novos clientes, o sistema vai **atualizar o `meta_access_token` de todos os clientes existentes** no banco de dados.

### Etapa unica

**Alterar `handleSaveDefaultToken` em `src/pages/Clients.tsx`**:
- Após salvar no localStorage, executar um `supabase.from("clients").update({ meta_access_token: token })` sem filtro de ID (atualiza todos)
- Mostrar toast de sucesso informando quantos clientes foram atualizados
- Invalidar a query de clientes para refletir a mudança na tabela

### Resultado
Ao clicar "Salvar" no token padrão, todos os clientes cadastrados terão seu token Meta atualizado de uma vez.

