# Fase 2 · Gestão de Usuários unificada com CRM

## Objetivo
Transformar a tela de Gestão de Usuários no ponto único de cadastro. Um mesmo usuário passa a viver em uma estrutura de pastas por contexto, e o vínculo com subcontas do CRM (papel + permissões) é gerenciado no mesmo modal. Admin de subconta também passa a criar usuários pelo CRM, gerando automaticamente o login do site.

## O que o usuário vê

### Nova estrutura em pastas na Gestão de Usuários

```text
📁 ADM do site         (role = admin ou manager, sem vínculo de cliente)
   └─ lista de usuários

📁 Clientes            (role = client)
   └─ lista de usuários

📁 CRM                 (usuários com vínculo em crm_users)
   ├─ 📁 Subconta A    ← nome vindo de crm_clients.nome
   │   └─ usuários daquela subconta
   ├─ 📁 Subconta B
   │   └─ usuários daquela subconta
   └─ ...

🗑 Lixeira             (mantém o botão atual)
```

- Sidebar à esquerda com as três pastas fixas expandindo em subpastas (CRM abre para subcontas).
- Um usuário pode aparecer em mais de uma pasta se tiver vínculo em subcontas diferentes (ex: colaborador interno que também atende no CRM da Loja X).
- A busca continua funcionando em qualquer pasta selecionada.
- Contador ao lado do nome de cada pasta (quantos usuários dentro).

### Modal "Novo/Editar usuário" ampliado

Além dos campos atuais (usuário, senha, nome, tipo, telefone, função de squad, dashboards, clientes), adiciona um bloco novo:

**Acesso ao CRM** (opcional, múltiplas subcontas)
- Botão "+ vincular subconta" abre um dropdown com as `crm_clients` acessíveis.
- Para cada subconta vinculada:
  - Papel: `Admin da subconta` ou `Usuário`
  - Se `Usuário`: checkboxes das 8 permissões granulares (as mesmas de hoje no CRM)
  - Botão "remover vínculo"

Ao salvar, o backend sincroniza `crm_users` (insert/update/delete) para bater com o que está no modal.

### Criar usuário do CRM continua funcionando

A aba **CRM › Config › Usuários** mantém o botão "Novo usuário". Diferença agora: o admin de subconta também pode usar (não precisa ser admin do site). O usuário criado por ali entra automaticamente na pasta "CRM › Subconta X" da Gestão de Usuários.

## O que muda por baixo (detalhes técnicos)

### Edge function `create-internal-user`
- Nova permissão de chamada: aceita também admins da subconta (`crm_users.papel = 'admin'`) além de admins do site. Quando o chamador é admin de subconta, força `cliente_id` = subconta dele e nega qualquer outro `client_ids`/`dashboard_keys` fora do escopo.
- Novo campo no body: `crm_links: [{ cliente_id, papel, permissoes }, ...]`. Após criar/atualizar o auth user, sincroniza `crm_users`: insere novos vínculos, atualiza papel/permissões, remove os que sumiram.
- Ação `create`: se `crm_links` presente, herda automaticamente `dashboard_keys = ["crm"]` quando ainda estiver vazio.
- Ação `update_user`: idem, sincroniza `crm_links`.
- Ação `purge`: também remove `crm_users` do user_id.

### Frontend

- `src/pages/UsersPage.tsx`
  - Layout com sidebar de pastas (novo componente interno `FoldersSidebar`), carregando `crm_clients` e agrupando os usuários.
  - Query adicional: `crm_users` com join lógico em `crm_clients(nome)` para saber a subpasta de cada usuário.
  - Modal ganha o bloco "Acesso ao CRM" com estado `crm_links: CrmLink[]`.
  - Ao salvar, envia `crm_links` no invoke.

- `src/pages/Crm.tsx › UsuariosSection`
  - Continua chamando `create-internal-user`, agora com `crm_links: [{ cliente_id: subcontaId, papel, permissoes }]` no lugar do insert manual em `crm_users`.
  - Edição também passa a rota via edge function (garante que admin de subconta consiga salvar sem depender só da RLS).

## O que fica de fora nesta fase
- Convite por email/link mágico para o usuário definir a própria senha.
- Auditoria de quem criou/alterou cada vínculo.
- Filtro de dashboard "só CRM" na home do cliente (o roteamento atual já esconde o que não tem acesso).
