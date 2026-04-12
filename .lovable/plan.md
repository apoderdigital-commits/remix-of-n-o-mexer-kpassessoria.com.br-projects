

## Guia de Criativos com IA — Análise de Vídeo

### Resumo

Botão "Gerar Guia" em cada ranking de criativos. Ao clicar, a IA analisa o conteúdo visual do criativo (vídeo ou imagem) e gera um guia seguindo o template KP (Gancho → Explicação Técnica → Quebra de Objeção → CTA) com variações.

### Como funciona

1. O edge function recebe a URL do criativo top 1
2. Faz unfurl da página para extrair `og:video` (vídeo) ou `og:image` (imagem de fallback)
3. Envia a mídia para o Gemini 2.5 Flash (que aceita vídeo e imagem) junto com o template KP como system prompt
4. A IA assiste/analisa o criativo e gera um guia de variações baseado no que viu
5. Retorna o guia formatado em markdown

### Etapas

**1. Criar edge function `generate-creative-guide`**
- Recebe: `creativeUrl`, `category` (CPF/consórcio/financiamento), `count`, `percentage`
- Faz fetch da URL para extrair og:video e og:image
- Envia para Gemini 2.5 Flash com conteúdo multimodal (vídeo/imagem + texto)
- System prompt contém o template KP completo (regras dos 5 tipos de guia)
- Pede à IA: "Analise este criativo e crie variações seguindo cada tipo de guia"
- Retorna markdown com o guia

**2. Criar componente `CreativeGuideButton.tsx`**
- Botão com ícone Sparkles no card de ranking
- Ao clicar, chama a edge function passando a URL do criativo #1
- Abre Dialog com loading animado enquanto a IA processa (~10-20s por ser vídeo)
- Exibe resultado em markdown formatado
- Botão para copiar o guia inteiro

**3. Integrar no `CreativeRanking.tsx`**
- Adicionar o botão no header do card (desktop) e no card compacto (mobile)
- Passa URL e dados do criativo #1 para o componente

**4. Instalar `react-markdown`**

### Detalhes técnicos

- Modelo: `google/gemini-2.5-flash` — suporta vídeo nativo, bom custo-benefício
- Conteúdo multimodal via OpenAI-compatible API: `{ type: "image_url", image_url: { url: "video_or_image_url" } }`
- Se não encontrar og:video, usa og:image como fallback
- Se nenhum dos dois existir, analisa apenas pelo nome/URL do criativo
- Template KP embutido no system prompt (não exposto ao cliente)
- Nenhuma alteração em cálculos, queries ou dados existentes

### O que NÃO muda
- Nenhuma query do dashboard
- Nenhum ranking ou cálculo
- Nenhuma edge function existente

