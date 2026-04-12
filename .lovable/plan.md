

## Enviar dados adicionais no webhook WhatsApp

### Resumo
Ao clicar no botão WhatsApp, enviar junto com o link e telefone: o período selecionado (de/até), a quantidade e a porcentagem do criativo, e a categoria (CPF/Consórcio/Financiamento).

### Etapas

**1. Passar `since` e `until` para `CreativeRanking`**
- Adicionar props `since` e `until` no componente
- No `Criativos.tsx`, passar os valores atuais do filtro de data

**2. Passar dados do criativo na chamada `handleSendWhatsApp`**
- Alterar para enviar também `count`, `percentage`, `category`, `since`, `until`
- Atualizar a invocação da edge function para incluir esses campos no body

**3. Atualizar edge function `send-creative-whatsapp`**
- Receber os novos campos: `period_since`, `period_until`, `count`, `percentage`, `category`
- Repassar tudo no POST para o webhook do n8n

### Payload final enviado ao n8n
```json
{
  "phone": "5581999999999",
  "user_name": "João Silva",
  "creative_url": "https://...",
  "period_since": "2026-03-13",
  "period_until": "2026-04-12",
  "category": "cpf",
  "count": 15,
  "percentage": 42.5
}
```

### O que NÃO muda
- Rankings, filtros e dados existentes
- Fluxo de autenticação e busca de telefone do usuário

