## Operações com IA — o que dá pra fazer

A dashboard tem um conjunto rico de dados estruturados (campanhas Meta, leads qualificados, funil GHL, vendedores, criativos, comparativos mês a mês). Isso é o tipo de input ideal pra IA — não pra gerar coisas do zero, mas pra **interpretar números e devolver linguagem humana acionável**.

Abaixo, 6 operações concretas com IA, ordenadas por impacto/esforço. Você escolhe quais entram e em que ordem.

---

### 1. 📋 Resumo executivo do período (narrativa)

Um botão **"Gerar análise do período"** no topo da dashboard. A IA recebe os dados agregados (KPIs, comparativo vs mês anterior, top criativos, vendedores) e devolve:

- 2-3 frases sobre **o que está funcionando** ("Maio começou forte: leads +45% vs abril, com CPL caindo para R$X.")
- 2-3 frases sobre **o que não está** ("A taxa de aprovação de simulações ainda está em 5%, bem abaixo da meta de 15%.")
- 2-3 frases sobre **próximos passos sugeridos** ("Considere pausar criativos com queda > 50% e escalar o top 3 que cresceu na última semana.")

> Por que vale: hoje o gestor olha 10 cards e tem que montar essa narrativa de cabeça. A IA faz em 3 segundos.

**Modelo**: `google/gemini-3-flash-preview` (rápido e barato).

---

### 2. 💬 Chat "Pergunte sobre o cliente X"

Um chat lateral (ou modal) onde o gestor digita perguntas em linguagem natural sobre os dados que já estão na tela:

- "Qual criativo trouxe mais leads em abril?"
- "Por que as vendas de financiamento caíram esta semana?"
- "Compare o desempenho dos vendedores Welton e João."

A IA tem acesso ao contexto agregado do período filtrado + tem ferramentas pra puxar detalhes específicos (top criativos, comparativos, evolução diária). Resposta com markdown e citações dos números.

> Por que vale: gestor para de procurar no dashboard, ele pergunta e a IA responde. Funciona como um analista júnior 24/7.

**Modelo**: `google/gemini-3-flash-preview` com tool calling pra acessar funções do banco.

---

### 3. 🚨 Alertas inteligentes (resumo diário/semanal)

A IA roda automaticamente (cron diário ou ao abrir a dashboard) e gera:

- **Top 3 alertas do dia** — coisas que mudaram desde ontem que merecem atenção (criativo despencou, vendedor parou de converter, CPL disparou).
- **Top 3 oportunidades** — onde investir mais ou replicar.

Aparece como banner no topo, ou notificação no `AlertBanner` que já existe no projeto. Pode evoluir pra WhatsApp/email no futuro.

> Por que vale: gestor não precisa abrir a dashboard pra saber se algo importante aconteceu — ele só abre quando a IA chama.

---

### 4. 🎯 Recomendações automáticas por criativo

Hoje a Fase 3 (que estava no roadmap) ia colocar badges manuais (🚀 Escalar / ⚠ Em queda) baseadas em regras fixas. Com IA, essas recomendações ficam **mais ricas e contextuais**:

- "Esse criativo tem volume alto mas conversão baixa de simulação → simulação. Provavelmente o público é amplo demais. Sugestão: testar segmentação."
- "Esse vendedor está com tempo de resposta acima da média e taxa caindo — vale checar o pipeline pessoal dele."

Fica como um botão **"Analisar com IA"** em cada linha do ranking, ou auto-gerado no card expandido.

> Por que vale: conecta os pontos que regras fixas não conseguem (volume + conversão + tempo + sazonalidade).

---

### 5. ✍️ Geração de copy para criativos novos

A partir dos top criativos atuais (que já performam bem), a IA sugere:

- 3 variações de headline pra testar
- 3 variações de CTA
- Sugestão de público-alvo baseada nos perfis que mais converteram

Botão **"Gerar variações"** no card de cada criativo top.

> Por que vale: turbina o ciclo "validou → escalou → criou variações" sem o gestor sair do dashboard.

**Modelo**: `google/gemini-2.5-pro` (qualidade de copy importa mais).

---

### 6. 📊 Relatório PDF do mês com comentários da IA

Botão **"Exportar relatório do mês"** que gera um PDF com:

- Capa com KPIs principais
- Gráficos do mês
- Análise narrativa da IA (item 1, mais detalhada)
- Top criativos e vendedores
- Recomendações pra próximo mês

> Por que vale: gestor manda pro cliente final / pra reunião de board sem editar nada.

---

## Como costumamos implementar

Tudo via **Lovable AI Gateway** (já tem `LOVABLE_API_KEY` configurada — sem custo de setup, sem nova chave). Cada operação vira uma **edge function** dedicada (`generate-insights`, `chat-dashboard`, `analyze-creative`, etc), chamada do frontend.

- **Streaming** pro chat e pra narrativas longas (UX melhor).
- **Tool calling** pra estruturar saídas (ex: alerta com `severity`, `metric`, `suggestion`).
- **Cache** de 1h nas análises automáticas pra não regenerar a cada refresh.

---

## Como decidir

Dois caminhos comuns:

**A) Começar pelo mais visível**: Item **1 (resumo executivo)**. Mostra valor da IA imediatamente e aparece no topo da dashboard. ~1h de implementação.

**B) Começar pelo mais usado**: Item **2 (chat)**. Maior impacto recorrente — gestor usa toda hora. ~2-3h de implementação.

Combinar 1 + 2 é o pacote clássico "IA na dashboard" e cobre 80% do valor. Os outros viram extensões.

Qual te interessa mais? Posso detalhar 1, 2 ou combinar.
