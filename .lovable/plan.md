# Verificação por código WhatsApp ao criar acesso

## Objetivo
Antes de efetivamente criar um novo usuário em "Gestão de Usuários", o admin precisa receber um código de 6 dígitos no WhatsApp do número informado e digitá-lo na tela. Só com o código correto a conta é criada. Isso garante que o número pertence à pessoa e adiciona uma camada de proteção contra criação indevida de acessos.

## Fluxo do usuário (admin criando acesso)
1. Admin preenche o formulário de novo usuário (nome, username, senha, telefone, role, dashboards, clientes) e clica em "Enviar código".
2. Sistema envia código de 6 dígitos para o WhatsApp do telefone informado (via mesmo webhook n8n já usado para criativos).
3. Aparece campo para digitar o código + botão "Confirmar e criar".
4. Ao confirmar com código válido, o usuário é criado de fato.
5. Código expira em 10 minutos. Máximo 5 tentativas. Reenvio permitido após 60s.

## Detalhes técnicos

### 1. Nova tabela `user_creation_verifications`
Armazena solicitações pendentes de criação de usuário com código hashado.
- `id`, `requested_by` (admin uuid), `phone`, `code_hash` (sha256), `payload` (jsonb com username/password/role/etc), `attempts` (int default 0), `expires_at`, `consumed_at`, `created_at`.
- RLS: apenas admin pode SELECT/INSERT/UPDATE das próprias linhas (`requested_by = auth.uid()` + `has_role(admin)`).

### 2. Edge function `request-user-creation-code`
- Auth obrigatória, valida que caller é admin.
- Recebe payload do novo usuário (mesmos campos do `create-internal-user` atual) + `phone` destino.
- Gera código de 6 dígitos, salva hash + payload na tabela.
- Dispara webhook n8n (reutiliza `N8N_WHATSAPP_WEBHOOK_URL`) com `{ type: "verification_code", phone, code, admin_name }`. n8n já entrega no WhatsApp.
- Retorna `{ verification_id, expires_at }` (nunca o código).

### 3. Edge function `confirm-user-creation-code`
- Auth obrigatória, valida admin.
- Recebe `verification_id` + `code`.
- Valida: não consumido, não expirado, `attempts < 5`, hash bate. Incrementa `attempts` em falha.
- Se válido: marca `consumed_at`, executa a mesma lógica de criação que hoje está em `create-internal-user` (criar auth user, role, dashboards, clientes, phone no profile).
- Retorna `{ success, user_id }`.

### 4. UI em `src/pages/UsersPage.tsx`
- Adicionar estado `verificationStep: "form" | "code"` no diálogo de novo usuário.
- Botão principal vira "Enviar código" → chama `request-user-creation-code`.
- Mostra campo de 6 dígitos (`InputOTP`), contador de expiração, botão "Reenviar" (desabilitado por 60s) e "Confirmar e criar".
- Em sucesso, fecha diálogo e atualiza lista (mesma invalidação de query atual).
- Mantém `create-internal-user` apenas para ações administrativas que não criam (delete/restore/purge); a parte de criação passa pelo novo fluxo.

### 5. n8n
- Você precisará adicionar no fluxo n8n um ramo que reconheça `type: "verification_code"` e envie a mensagem com o código (template: "Seu código de verificação KP: 123456 — válido por 10 minutos").
- Mesmo webhook URL, mesmo segredo — sem mudança de infraestrutura.

## Não incluído (ficam para outra rodada se quiser)
- Os outros 2 findings críticos (tokens em `clients`, webhook aberto de `qualified_leads`).
- Warnings menores do linter (search_path, extension in public).

## Resumo dos arquivos
- Migration: cria `user_creation_verifications` + RLS.
- Nova edge function `supabase/functions/request-user-creation-code/index.ts`.
- Nova edge function `supabase/functions/confirm-user-creation-code/index.ts`.
- Edita `src/pages/UsersPage.tsx` para o fluxo em 2 passos.
- `create-internal-user` mantido para soft_delete/restore/purge (criação removida ou bloqueada).