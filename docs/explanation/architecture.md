# Explanation: Arquitetura do Markdown-Studio

> Para "como fazer" ver `docs/how-to/re-edit-overview.md`; para a API pura ver `docs/reference/`.

## Visão geral

Markdown-Studio é 100% client-side. Não há servidor: o editor (Monaco), o pipeline de renderização e a persistência vivem todos no navegador. Isso permite deploy estático e uso offline após o build.

## Pipeline de renderização

```
digitação no Monaco
   │  onDidChangeModelContent
   ▼
convert(markdown)                          ── src/render/convert.js (função pura)
   ├─ marked.parse(texto, { renderer })    → HTML bruto
   ├─ renderer.code: mermaid → <pre class="mermaid">
   ├─ DOMPurify.sanitize(html)             → HTML seguro  (fronteira de segurança ÚNICA)
   ├─ #output.innerHTML = sanitizado
   └─ scheduleMermaidRender()              → debounce 150ms → mermaid.render()
```

### Por que DOMPurify é obrigatório

`marked` produz HTML; esse HTML **nunca** pode ir direto ao DOM (XSS via HTML injetado no Markdown). `DOMPurify.sanitize()` é o único portão antes de `innerHTML`.

### Por que Mermaid é renderizado à mão

Em um editor live, o DOM é mutado a cada tecla. `mermaid.startOnLoad()/run()` varre o documento e pode capturar estados intermediários. O projeto renderiza **sob demanda** com `mermaid.render(id, src)` + **debounce 150 ms** + **guard de versão** (`mermaidRenderVersion`) para descartar renders obsoletos.

## Contratos de persistência (localStorage)

| Chave                                    | Valor             | Uso                |
| ---------------------------------------- | ----------------- | ------------------ |
| `com.markdownstudio.last_state`          | string (Markdown) | conteúdo do editor |
| `com.markdownstudio.scroll_bar_settings` | boolean           | sincronizar scroll |
| `com.markdownstudio.theme_settings`      | boolean           | tema dark/light    |
| `com.markdownstudio_theme` (crua)        | 'dark'/'light'    | boot anti-FOUC     |

Expiração: ano 2099 (padrão do upstream). O wrapper `src/storage.js` substitui o `storehouse-js` com a MESMA semântica de chaves para não quebrar dados de quem já usava o tool original.

## Anti-FOUC de tema

Um pequeno script síncrono no `<head>` do `index.html` lê a chave crua de tema e seta `data-theme` **antes do primeiro paint**, evitando "flash" de tema errado. A fonte de verdade no app é `src/storage.js`.

## Sync de scroll

Só editor → preview (unidirecional): calcula `scrollRatio` (top/max) do editor e aplica no painel preview, por proporção — robusto a diferenças de altura.

## Decisões de arquitetura (ADR-like)

| Decisão                                | Justificativa                                          |
| -------------------------------------- | ------------------------------------------------------ |
| Monaco via npm, não CDN                | offline, pin exato, sem dependência de rede            |
| Sem GA/rastreadores                    | privacidade (removido do upstream)                     |
| pt-BR first                            | público-alvo; strings isoladas em `src/i18n/`          |
| Sem backend                            | deploy estático simples e barato                       |
| Funções puras isoladas (`src/render/`) | testabilidade (Vitest) e separação de responsabilidade |

## Limitações conhecidas (fora do escopo v1)

- Export PDF usa html2pdf (html2canvas) — pode falhar em CSS muito moderno; mitigado com páginas simples.
- Monaco sem web workers (proxy no-op) — suporte de linguagem reduzido, aceitável para Markdown.
