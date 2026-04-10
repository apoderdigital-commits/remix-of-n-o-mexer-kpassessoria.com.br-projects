

## Portal Multi-Projetos no Mesmo Domínio

### Contexto
Você quer usar seu domínio próprio como um "hub" central — o usuário faz login e depois escolhe qual dashboard/projeto acessar.

### Limitação importante
No Lovable, **cada domínio personalizado só pode apontar para um projeto**. Isso significa que não dá para servir múltiplos projetos Lovable diferentes no mesmo domínio diretamente.

### Opções viáveis

**Opção A — Portal com subdomínios (recomendada)**
- Este projeto vira o **portal central** no domínio principal (ex: `app.kpassessoria.com.br`)
- Cada outro projeto Lovable fica em um subdomínio (ex: `criativos.kpassessoria.com.br`, `financeiro.kpassessoria.com.br`)
- Após login no portal, o usuário vê cards dos projetos disponíveis e clica para ir ao subdomínio
- **Problema:** cada projeto teria login separado (sessão não compartilha entre subdomínios automaticamente)

**Opção B — Tudo dentro deste projeto (recomendada)**
- Em vez de ter projetos Lovable separados, você **adiciona todas as páginas/dashboards dentro deste mesmo projeto**
- Após login → tela de seleção → cada "projeto" é uma rota diferente (`/criativos`, `/financeiro`, `/relatorios`)
- **Vantagem:** login único, mesmo banco de dados, mesma sessão, mesmo domínio
- **Desvantagem:** o projeto fica maior e mais complexo

**Opção C — Portal com iframes**
- Este projeto é o portal com login
- Outros projetos Lovable são publicados como públicos
- Após login, o portal carrega o projeto escolhido dentro de um iframe
- **Problema:** segurança limitada, os outros projetos ficam acessíveis publicamente

### Recomendação

A **Opção B** é a mais sólida — manter tudo neste projeto com rotas diferentes. Funciona assim:

1. **Página de Login** — já existe
2. **Nova página "Portal"** (`/`) — após login, mostra cards visuais dos dashboards disponíveis (com ícones, descrições)
3. **Cada dashboard é uma rota** — ex: `/criativos` (o que já temos), `/novo-dashboard`, etc.
4. **Controle de acesso por role** — cada usuário pode ter acesso a dashboards específicos
5. **Menu lateral ou header** — para navegar entre dashboards sem voltar ao portal

### O que seria implementado

1. Criar página **Portal/Home** com cards dos projetos disponíveis
2. Mover o dashboard atual para a rota `/criativos`
3. Adicionar navegação global (sidebar ou header) para trocar entre dashboards
4. Quando você criar novos dashboards, basta adicionar novas rotas e cards no portal

### Estrutura de rotas

```text
/login          → Tela de login
/               → Portal (seletor de dashboards)
/criativos      → Dashboard atual de criativos
/[futuro-1]     → Novo dashboard que você criar
/[futuro-2]     → Outro dashboard
/clients        → Gestão de clientes (admin)
```

Qual opção você prefere? Se for a B, posso implementar direto.

