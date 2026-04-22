

## Plano: Visualizar criativo em popup interno (sem sair da página)

### Objetivo
Ao clicar no link de um criativo no ranking, abrir um modal dentro da própria página mostrando o conteúdo do criativo (Instagram/Facebook), em vez de abrir nova aba.

### Limitação técnica importante
Instagram e Facebook **bloqueiam embed via `<iframe>`** com headers `X-Frame-Options: DENY` e `Content-Security-Policy: frame-ancestors`. Não dá para simplesmente carregar `instagram.com/p/...` num iframe — vai aparecer em branco ou com erro.

### Solução: Modal com oEmbed + fallback

Usar a estratégia certa para cada plataforma:

**Instagram (`instagram.com/p/...` ou `instagr.am`):**
- Usar o **oEmbed oficial do Instagram** via edge function (precisa de access token do Facebook Graph API) OU
- Usar o **blockquote embed público** do Instagram (`//www.instagram.com/embed.js`) — funciona sem token, renderiza o post completo dentro do modal

**Facebook (`fb.me/...`, `facebook.com/...`):**
- Usar o **Facebook Plugin** (`https://www.facebook.com/plugins/post.php?href=...`) que é embed-friendly via iframe
- Para `fb.me/...` (link curto), primeiro resolver o redirect via edge function `unfurl-url` (já existe no projeto) para pegar a URL final

**Outros links:**
- Mostrar preview com `og:image` + título (já temos `unfurl-url`) e botão "Abrir em nova aba"

### Componentes a criar

**1. `src/components/dashboard/CreativePreviewDialog.tsx`** (novo)
- Recebe `url`, `open`, `onOpenChange`
- Detecta plataforma pela URL (instagram / facebook / outro)
- Renderiza:
  - **Instagram**: `<blockquote class="instagram-media" data-instgrm-permalink={url}>` + carrega `embed.js` dinamicamente e chama `window.instgrm.Embeds.process()`
  - **Facebook**: `<iframe src="https://www.facebook.com/plugins/post.php?href={encoded}&show_text=true&width=500">`
  - **Fallback**: card com preview do `unfurl-url` + link externo
- Usa o `Dialog` do shadcn já presente no projeto

**2. Alterar `src/components/dashboard/CreativeRanking.tsx`**
- Trocar `<a href={url} target="_blank">` por `<button onClick={() => setPreviewUrl(url)}>`
- Manter o ícone visual, mas adicionar pequeno botão "abrir externo" ao lado para quem quiser nova aba
- Renderizar o `<CreativePreviewDialog>` no final do componente

### Fluxo do usuário
```text
Click no link "www.instagram.../p/DWO5..."
  ↓
Abre Dialog (modal centralizado, ~600px largura)
  ↓
Instagram: blockquote oficial renderiza o post (foto/vídeo/carrossel + caption)
Facebook: iframe do plugin renderiza o post
  ↓
Botões no header do modal: "Abrir original ↗" + "Fechar X"
```

### Detalhes técnicos

- **Script do Instagram**: carregar `https://www.instagram.com/embed.js` apenas uma vez no app (verificar `window.instgrm`); chamar `window.instgrm.Embeds.process()` toda vez que abrir o modal
- **Normalização de URL Instagram**: garantir que termina sem query string e tem `/` final para o embed funcionar
- **fb.me redirect**: usar `supabase.functions.invoke('unfurl-url', { body: { url } })` para obter `finalUrl`, depois passar para o iframe do plugin
- **Loading state**: mostrar skeleton enquanto o embed carrega
- **Mobile**: Dialog já é responsivo; ajustar `max-w-[90vw]` em telas pequenas
- **Sem novas dependências** — tudo com componentes/edge functions existentes

### Arquivos afetados
- `src/components/dashboard/CreativePreviewDialog.tsx` — novo
- `src/components/dashboard/CreativeRanking.tsx` — trocar link por botão que abre o dialog
- (Opcional) `index.html` — pré-carregar `instagram.com/embed.js` para acelerar primeira abertura

