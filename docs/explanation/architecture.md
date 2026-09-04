# Explanation: Arquitetura do Markdown-Studio

> Para "como fazer" ver `docs/how-to/re-edit-overview.md`; para a API pura ver `docs/reference/`.

## Visão geral

Markdown-Studio é 100% client-side. Não há servidor: o editor (Monaco), o pipeline de
renderização e a persistência vivem todos no navegador. Isso permite deploy estático e uso
offline após o build.

## Fluxo de edição (dados)

```
digitação no Monaco
   │  onDidChangeModelContent
   ▼
scheduleConvertAndRender(value)             debounce ~80 ms (M2 — evita jank em docs longas)
   ▼
convert(markdown)                           ── src/render/convert.js (função pura)
   ├─ marked.parse(texto, { renderer })     → HTML bruto
   │     ├─ renderer.code: mermaid → <pre class="mermaid">
   │     ├─ renderer.heading: ids via slugify (mesmos usados pelo TOC)
   │     ├─ renderer.html: `<!-- page-break -->` → <div class="page-break">
   │     └─ marked extensions KaTeX ($…$ e $$…$$) → MathML/HTML (katexExt.js)
   ├─ DOMPurify.sanitize(html)              → HTML seguro (fronteira de segurança ÚNICA)
   │     ├─ allowlist MathML (ADD_TAGS/ADD_ATTR aria-hidden)
   │     ├─ ALLOWED_URI_REGEXP (só http(s)/mailto/relativos; tel:/javascript: perdem href)
   │     └─ hook pós-sanitização: links http(s) ganham target="_blank" + rel="noopener noreferrer"
   ├─ #output.innerHTML = sanitizado
   └─ scheduleMermaidRender()               → debounce 150 ms → renderMermaidDiagramsNow()
```

Em paralelo à conversão:

- `scheduleSave(value)` — debounce 300 ms → `setItem(last_state)`; templates não editados
  **não** são persistidos (troca de idioma restaura o template do idioma corrente).
- `maybeAutoSnapshot(value)` — throttle 60 s → anel de backup `com.markdownstudio.backup`
  (máx. 5), protegendo contra `last_state` corrompido (P1-8).
- `statusBar.update()` — estatísticas (palavras, caracteres, linhas, tempo de leitura) + nome
  do arquivo aberto.

## Módulos de render (`src/render/`, funções puras)

| Módulo        | Responsabilidade                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `convert.js`  | pipeline marked → renderer custom → DOMPurify; `escapeHtml`, `slugifyHeading`, `createMarkedRenderer` |
| `katexExt.js` | extensões marked para `$…$` (inline) e `$$…$$` (bloco) via KaTeX (sem CDN)                            |
| `mermaid.js`  | configuração/agendamento/rendering de diagramas (single-flight)                                       |
| `toc.js`      | extração de headings (do HTML sanitizado ou do markdown) + HTML da árvore                             |

### Por que DOMPurify é obrigatório

`marked` produz HTML; esse HTML **nunca** pode ir direto ao DOM (XSS via HTML injetado no
Markdown). `DOMPurify.sanitize()` é o único portão antes de `innerHTML`. O KaTeX também passa
por ele (allowlist MathML); o hook `afterSanitizeAttributes` reforça links externos
(`rel="noopener noreferrer"` — anti-tabnabbing).

### Por que Mermaid é renderizado à mão

Em um editor live, o DOM é mutado a cada tecla. `mermaid.startOnLoad()/run()` varre o
documento e pode capturar estados intermediários. O projeto renderiza **sob demanda** com
`mermaid.render(id, src)` + **debounce 150 ms** + **single-flight** (`renderInFlight` — o
`mermaid.render` não é reentrante) + **version-guard** (`renderMermaidVersion`) para
descartar renders obsoletos. `pauseMermaidScheduling`/`resumeMermaidScheduling` suspendem o
debounce durante capturas de export (PDF) para o tema não "vazar" no clone.

## UI (`src/ui/`)

Glue de DOM em torno do pipeline: `divider`, `sidebar`, `i18nElements`, `language`,
`editorActions`, `scrollSync`, `statusBar`, `exportPdf`, `exportHtml`, `copyRich`,
`snapshots`/`snapshotsDialog`, `tocDialog`, `printSettings`/`printSettingsDialog`,
`files`, `workers/monacoSetup` (Monaco sem workers — proxy no-op). O `main.js` orquestra o
boot; lógica testável é extraída em módulos (ex.: `editorActions`, `i18nElements`).

## Contratos de persistência (localStorage)

| Chave                                    | Tipo                 | Uso                                  |
| ---------------------------------------- | -------------------- | ------------------------------------ |
| `com.markdownstudio.last_state`          | string               | conteúdo do editor                   |
| `com.markdownstudio.scroll_bar_settings` | boolean              | sincronizar scroll                   |
| `com.markdownstudio.theme_settings`      | boolean              | tema dark/light (fonte de verdade)   |
| `com.markdownstudio.backup`              | `Snapshot[]` (máx 5) | snapshots locais (P1-8)              |
| `com.markdownstudio.locale`              | `'pt-BR'` / `'en'`   | idioma da interface                  |
| `com.markdownstudio.print_settings`      | JSON string          | configuração de impressão/PDF (P0-1) |
| `com.markdownstudio.sidebar_collapsed`   | `'1'` / `'0'`        | estado do drawer/sidebar             |
| `com.markdownstudio_theme` (crua)        | `'dark'` / `'light'` | boot anti-FOUC                       |

Detalhes e regras de leitura/validação em `docs/reference/storage-contract.md`. O wrapper
`src/storage.js` substitui o `storehouse-js` com a MESMA semântica de chaves para não quebrar
dados de quem já usava o tool original.

## Anti-FOUC de tema

Um pequeno script síncrono no `<head>` do `index.html` lê a chave crua `com.markdownstudio_theme`
e seta `data-theme` **antes do primeiro paint**. A fonte de verdade no app é
`theme_settings`; a cada init, `initThemeToggle` re-sincroniza a chave de boot a partir dela
(M3 — storage legado com boot key ausente/divergente não causa mais double-flip).

## Sync de scroll

Só editor → preview (unidirecional): calcula `scrollRatio` (top/max) do editor e aplica no
painel preview, por proporção — robusto a diferenças de altura.

## Impressão / Export PDF

- `printSettings` → `com.markdownstudio.print_settings` (margem, papel A4/Letter, orientação,
  cabeçalho/rodapé com `{page}`); `@page` + `break-inside: avoid` via
  `applyPrintSettingsCss`.
- `exportPdf` usa `html2pdf.js` (npm dep, dynamic import, sem CDN): A4 retrato configurável,
  tema light forçado no clone (`190mm`), `stampPageHeaderFooter` via `toPdf().get('pdf')`.
- Quebras conscientes: marcador `<!-- page-break -->` → `<div class="page-break">`; no
  `@media print` e no clone do PDF, tabelas/código/citações/figuras/listas/mermaid/KaTeX têm
  `break-inside: avoid` e headings `break-after: avoid`.
- Estatísticas e configuração de página fecham a "open decision" de paginação do PRODUCT.md.

## Decisões de arquitetura (ADR-like)

| Decisão                                                                             | Justificativa                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Monaco via npm, não CDN                                                             | offline, pin exato, sem dependência de rede            |
| Sem GA/rastreadores                                                                 | privacidade (removido do upstream)                     |
| pt-BR first                                                                         | público-alvo; strings isoladas em `src/i18n/`          |
| Sem backend                                                                         | deploy estático simples e barato                       |
| Funções puras isoladas (`src/render/`)                                              | testabilidade (Vitest) e separação de responsabilidade |
| KaTeX via npm + allowlist MathML                                                    | matemática sem CDN e sem quebrar o sanitizer           |
| Debounces em camadas (convert 80 ms / save 300 ms / mermaid 150 ms / snapshot 60 s) | typing fluido + persistência segura                    |
| Render manual do Mermaid (single-flight)                                            | `mermaid.render` não é reentrante; sem corridas no DOM |

## Limitações conhecidas (fora do escopo v1)

- Monaco sem web workers (proxy no-op) — suporte de linguagem reduzido, aceitável para Markdown.
- Chunks grandes no build (Monaco `editor`, `html2pdf`, famílias mermaid) — code-split já em
  vigor no export/editor; aviso de tamanho é conhecido (ver `docs/reference/snapshot-v1.1.0.md`).

---

## ADR: Rota de PDF vetorial pesquisável (P2-9)

**Status:** approved (Spike Story 1.1 — 2026-09-04)

**Contexto:** O export PDF atual (`html2pdf.js`) usa html2canvas que rasteriza tudo — texto vira
imagem, impossibilitando Ctrl+F, seleção e acessibilidade. O projeto precisa de PDF com camada
de texto real, 100% client-side, offline, sem CDN.

### Rotas avaliadas

| Rota              | Lib (versão)  | Bundle (min) | Texto Vetorial  | Tabelas            | Page Break Auto | Migração | Bundle Dinâmico |
| ----------------- | ------------- | ------------ | --------------- | ------------------ | --------------- | -------- | --------------- |
| **pdfmake**       | 0.3.11        | ~1 MB        | ✅ nativo       | ✅ built-in        | ✅ automático   | Média    | ✅ `import()`   |
| jsPDF + autotable | 4.2.1 + 5.0.8 | ~190 KB      | ✅ manual (X/Y) | ✅ plugin (~40 KB) | ❌ manual       | Alta     | ✅ `import()`   |
| pdf-lib           | 1.17.1        | ~430 KB      | ✅ manual       | ❌ manual          | ❌ manual       | Alta     | ✅ `import()`   |

### Análise por critério

**Fidelidade do layout:**

- pdfmake: layout declarativo (JSON docDefinition), fluxo automático de texto, headings com
  estilos, listas indentadas, tabelas com colSpan/rowSpan. Fidelidade média-alta para
  documentos estruturados.
- jsPDF: posicionamento pixel-perfect mas manual. Cada elemento precisa de coordenadas X/Y.
  Layout complexo exige cálculo extenso. Fidelidade alta para documentos fixos, baixa para
  conteúdo dinâmico.
- pdf-lib: similar ao jsPDF — low-level, sem engine de layout.

**Suporte a conteúdo Markdown:**

- pdfmake: tabelas built-in, listas automáticas, columns, page breaks. Markdown → docDefinition
  é uma transformação direta.
- jsPDF: precisa de jspdf-autotable para tabelas (dependência extra). Listas e blocos de código
  precisam de posicionamento manual.
- pdf-lib: sem suporte nativo a tabelas ou listas.

**Mermaid e KaTeX:**

- pdfmake: aceita imagens via `image` content type. SVG do mermaid pode ser convertido para
  PNG (canvas → dataURL) e embutido. KaTeX pode ser re-renderizado com `output: 'svg'` e
  embutido como imagem.
- jsPDF: similar — imagens via `addImage`. SVG requer conversão prévia.
- pdf-lib: similar.

**Custo de migração:**

- pdfmake: criar conversor Markdown → docDefinition (transformação de AST). Custo médio.
  O conversor é reutilizável e testável isoladamente.
- jsPDF: criar renderizador que percorre AST e posiciona cada elemento. Custo alto.
  Posicionamento manual é frágil e difícil de manter.
- pdf-lib: similar ao jsPDF.

**Bundle size:**

- pdfmake: ~1 MB com fontes (Roboto bundled como base64). Aceitável — o chunk atual
  `html2pdf` já é 935 KB. Dynamic import mantém boot enxuto.
- jsPDF: ~190 KB core + ~40 KB autotable = ~230 KB. Menor, mas custo de migração muito alto.
- pdf-lib: ~430 KB. Intermediário.

### Decisão

**Roote escolhida: pdfmake** (dynamic import, chunk separado)

Justificativa:

1. Único com layout declarativo e page breaks automáticos — essencial para Markdown de
   comprimento variável.
2. Tabelas built-in sem plugin — o Markdown pode ter tabelas arbitrárias.
3. Custo de migração menor: Markdown → docDefinition é uma transformação de AST direta.
4. Bundle ~1 MB aceitável via dynamic import (atual html2pdf.js já é 935 KB).
5. Texto é nativamente vetorial — sem camada de sobreposição.

### Formato suportado por tipo de conteúdo

| Tipo de conteúdo                    | Formato no PDF vetorial                      | Conversão                                              |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| Texto (headings, paragraphs, links) | Texto vetorial nativo pdfmake                | AST → docDefinition content[]                          |
| Listas (ul/ol)                      | `ol`/`ul` content type pdfmake               | AST → list items                                       |
| Tabelas                             | `table` content type pdfmake                 | AST → table body[]                                     |
| Código (fenced/inline)              | Texto vetorial com fonte monospace           | AST → text com style                                   |
| Blockquotes                         | Texto com indentação/border                  | AST → columns ou text com margin                       |
| Mermaid                             | Imagem (SVG→PNG via canvas)                  | `mermaid.render()` → canvas → dataURL → pdfmake image  |
| KaTeX inline/bloco                  | SVG embutido (re-render com `output: 'svg'`) | KaTeX `renderToString({output:'svg'})` → pdfmake image |
| Page break (`<!-- page-break -->`)  | `pageBreak: 'before'` no próximo content     | AST page-break marker → pageBreak property             |

### Feature-flag

A rota vetorial é protegida pela feature-flag `com.markdownstudio.pdf.vector` (default `false`).
Enquanto desabilitada, o fluxo atual (html2pdf.js) continua sendo usado. A flag é habilitada
manualmente via localStorage quando o usuário quiser testar.

### Critérios de estabilidade (para flip da flag)

A flag será habilitada por padrão quando:

1. CI verde por pelo menos 2 releases consecutivos.
2. Fidelidade validada nos navegadores suportados (Chrome, Firefox, Safari).
3. Testes unitários cobrem sucesso e erro (mock da lib, sem rede).

### Bundle impact estimado

```
Atual:   html2pdf.js chunk → 935 KB (gzip: 265 KB)
Novo:    pdfmake chunk      → ~1 MB  (gzip: ~300 KB estimado)
Delta:   +~65 KB gzip (aceitável — dynamic import preserva boot)
```

O chunk pdfmake será carregado sob demanda (apenas no clique de "Exportar PDF"), mantendo o
bundle inicial inalterado.
