

## Enviar Link do Criativo via Webhook para WhatsApp

### Resumo
Ao clicar em "Ver Criativo" no ranking, além de abrir o preview, o sistema envia automaticamente o telefone do cliente e o link do criativo para o webhook do n8n, que disparará a mensagem no WhatsApp.

### Etapas

**1. Adicionar coluna `phone` na tabela `clients`**
- Migration: `ALTER TABLE clients ADD COLUMN phone text;`

**2. Atualizar formulário de cadastro de clientes (`Clients.tsx`)**
- Adicionar campo "Telefone (WhatsApp)" no formulário de criação/edição
- Salvar no campo `phone` do banco
- Exibir na tabela de clientes

**3. Passar `clientId` para o `CreativeRanking`**
- No `Criativos.tsx`, passar `activeClient` como prop para cada `CreativeRanking`
- O componente recebe `clientId` e usa para buscar o telefone

**4. Adicionar botão "Enviar no WhatsApp" nos criativos**
- Ao clicar, busca o telefone do cliente via `supabase.from("clients").select("phone").eq("id", clientId)`
- Se não tiver telefone cadastrado, exibe toast de erro
- Se tiver, faz `fetch` POST para o webhook do n8n com `{ phone, creative_url }`
- Exibe toast de sucesso "Link enviado no WhatsApp!"
- Botão com ícone de WhatsApp (MessageCircle ou similar) ao lado do link do criativo na tabela

**5. URL do webhook**
- Será salva como secret no backend para não ficar exposta no frontend
- Edge function `send-creative-whatsapp` recebe `{ client_id, creative_url }`, busca o telefone do cliente no banco, e faz o POST para o n8n

### Segurança
- O webhook URL fica no backend (edge function), nunca no frontend
- A edge function valida que o usuário está autenticado antes de enviar
- Validação de input com Zod

### O que NÃO muda
- Rankings, cálculos e dados existentes
- Preview de criativos continua funcionando normalmente

