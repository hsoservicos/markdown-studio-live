# Changelog

All notable changes to this project are documented in this file.
The format is "Keep a Changelog" (modified per BMAD) and this project adheres to SemVer.

## [Unreleased]

### Added

- **Configuração de página para PDF/Imprimir** (P0-1): novo `src/ui/printSettings.js` + diálogo na sidebar (`Configurar impressão`) com margem, papel (A4/Letter), orientação e textos de cabeçalho/rodapé (`{page}` = nº da página); preferências persistem em `com.markdownstudio.print_settings` e alimentam `buildExportOptions` (jsPDF format/orientation/margin), a folha `@page` injetada no documento e o carimbo por página no PDF via hook `toPdf().get('pdf')` (`stampPageHeaderFooter`).
- **Barra de status com estatísticas** (P0-3): `src/ui/statusBar.js` conta palavras, caracteres, linhas e tempo de leitura (~200 palavras/min) no `<footer>`, atualizando a cada edição; nome do arquivo aberto aparece à frente quando há arquivo carregado.
- **Quebras de página conscientes** (P0-2): marcador `<!-- page-break -->` vira `<div class="page-break">` no preview/impressão; `break-inside: avoid` em tabelas, código, citações, figuras, itens de lista, mermaid e KaTeX display, e `break-after: avoid` em headings — no `@media print` e no clone do PDF.
- **Sumário (TOC) bidirecional** (P0-4): `src/render/toc.js` extrai headings do markdown (mesmos ids/slugify do renderer, ignorando cercas de código) e `src/ui/tocDialog.js` lista os títulos em diálogo; clicar num item posiciona o cursor do editor na linha e clicar num heading do preview revela a linha correspondente no editor.
- **Suporte a matemática (KaTeX)** (P0-5): fórmulas `$...$` (inline) e `$$...$$` (bloco) via extensões marked (`src/render/katexExt.js`), katex promovido a dependência direta (`^0.16.47`, CSS bundled — sem CDN); saída passa pelo DOMPurify com allowlist MathML; `$` dentro de código inline não vira fórmula.

### Fixed

- **Redefinir** remove o rascunho persistido (`last_state`): após reset, um reload volta ao template do idioma corrente em vez de restaurar o conteúdo antigo (`src/ui/editorActions.js`). O fluxo de reset/novo arquivo foi extraído do boot para módulo testável.
- **Mermaid** reentrante (`src/render/mermaid.js`): `renderMermaidDiagramsIn` serializa passagens concorrentes (single-flight) — `mermaid.render` não é reentrante e duas passagens sobrepostas podiam corromper o preview.
- **Exportar PDF vs troca de tema**: `exportPreviewToPdf` pausa o agendamento do re-render Mermaid durante a captura (`pauseMermaidScheduling`/`resumeMermaidScheduling`), evitando que o debounce de tema mute o DOM enquanto o `html2pdf` clona o preview.
- **Jank de digitação**: conversão do preview agora é debounced (~80ms) no `onDidChangeModelContent` (`scheduleConvertAndRender`), reduzindo re-render por tecla em documentos longos.
- **Boot key de tema divergente** (`src/main.js`): `initThemeToggle` re-sincroniza `com.markdownstudio_theme` a partir da fonte de verdade (persistência), eliminando o double-flip de tema no next load em storage legado com boot key ausente/incoerente.
- **Leitura tipada na fronteira do storage** (`src/storage.js`): `getItem(namespace, key, { type })` valida o tipo do valor ao ler (boolean com mapeamento de legado `true/false/1/0`, string, number); fragmentos corrompidos lançam `StorageError` em vez de restaurar silenciosamente. O boot usa `safeGet` que degrada para o padrão (`null`) sem crash.

### Changed

- Novo módulo `src/ui/editorActions.js` com `resetMarkdownEditor`/`newMarkdownEditor` (lógica testável, persistência e scroll separados do boot) + `resolveBootInput` (decide entre rascunho restaurado e template do idioma corrente).
- `applyI18n` extraído para novo módulo `src/ui/i18nElements.js`, testável isoladamente.
- `buildExportOptions(filename, settings)` agora recebe configuração de impressão; `exportPreviewToPdf({ onStatus }, printSettings)` usa a cadeia `toPdf().get('pdf')` do html2pdf.
- `convert.js` exporta `slugifyHeading` para consumidores que precisam dos mesmos ids de âncora (TOC).

## [1.1.0] — 2026-08-19

### Added

- Botão toggle no header do painel (`#menu-items [data-sidebar-toggle]`) com `aria-controls="sidebar-nav"`, visível apenas em viewport ≤720px (mobile).
- Drawer responsivo mobile: `.sidebar` vira painel fixo overlay (max-width 280px / 84vw) deslizando via `translateX(-100%)` ↔ `translateX(0)`, com boot colapsado em telas compactas sem preferência salva; editor sempre em coluna cheia no mobile.
- `setupSidebar` aceita múltiplos toggles (`#sidebar-toggle` + `[data-sidebar-toggle]`) e sincroniza `aria-expanded`/`aria-label`/`title` em todos.
- Sidebar com ações: Manual, Abrir arquivo, Salvar arquivo, Imprimir, Redefinir, Copiar e Exportar PDF (Removidos da NavBar — now in Sidebar).
- Seletor de idioma (`#lang-select`) na sidebar: Português (Brasil) / English, persistido em `com.markdownstudio.locale`, com tradução aplicada automaticamente via reload.
- `src/ui/language.js` — helpers de localidade (normalizeLocale, getStoredLocale, setStoredLocale, applyStoredLocale, setupLanguageSelector).
- `setupSidebar` agora aceita `handlers` por action para ações externas (reset/copy/exportPdf).
- Botão **Novo arquivo** na sidebar (`data-sidebar-action="new"`): limpa a área de edição, volta o preview ao estado vazio e coloca o foco do cursor no editor; com confirmação (`newFileConfirm`) quando houver conteúdo editado. Rótulo/tooltip localizados (`newFile`, pt/en), seguindo o padrão dos demais `.sidebar-item`.
- i18n total: `applyI18n` também localiza `aria-label` (`data-i18n-aria-label`), `alt` (`data-i18n-alt`), `title` (`data-i18n-title`) e `<meta content>` (`data-i18n-content`) — acessibilidade, hints e metadados acompanham o idioma.
- `DEFAULT_TEMPLATE_EN` + `getDefaultTemplate()` por locale: o exemplo inicial da abertura e o **Redefinir/Reset** carregam o template no idioma corrente.
- Manual bilingue: `manual/markdown-manual-en.md` (EN) resolvido por `getManualUrl()` conforme a locale.
- **Exportar PDF funcional** (`src/ui/exportPdf.js`): `html2pdf.js@^0.14.0` como dependência npm local (dynamic import em chunk próprio, carregado só no clique — sem CDN), exporta `#preview-wrapper` em A4 retrato via `buildExportOptions()`, forçando tema light no clone e largura `190mm`; sucesso reporta `pdfExported` no rodapé e indisponibilidade/erro usam fallbacks claros (`pdfUnavailable`/`exportError`).
- Testes unitários de exportação (`tests/unit/exportPdf.test.js`): busca do preview, fallback de lib indisponível, pipeline set→from→save com callback de sucesso e caminho de erro com restauração do tema Mermaid dark.

### Changed

- **Exportar PDF**: handler da sidebar agora reporta resultado no rodapé via `onStatus` e o módulo passou a carregar `html2pdf.js` localmente (era `window.html2pdf` via CDN — sempre indisponível); `loadHtml2Pdf` exportado para testes com mock.
- Boot toggle da sidebar não publica mais status no rodapé ao recolher/expandir; cada `.sidebar-item` ganhou `title` (tooltip) localizado via `data-i18n-title` — essencial quando a sidebar está recolhida (ícones sem texto).
- Bootstrap i18n lê a locale armazenada (`applyStoredLocale`) e sincroniza `document.documentElement.lang`.
- `applyI18n` também aplica placeholders via `[data-i18n-placeholder]`.
- Erros Mermaid (`showMermaidError`) passam a usar as chaves `mermaidError`/`mermaidRenderFailed` em vez de strings hardcoded em pt.
- Persistência do editor não salva templates não editados (`isUntouchedTemplate`): ao trocar de idioma, o editor volta ao template do idioma corrente em vez de manter o outro.
- Sidebar `.sidebar-lang` com `<select>` estilizado (hairline, focus-visible, escala fixa).
- Corrigido recolhimento da sidebar: (1) `#workspace:has(.sidebar.is-collapsed)` usava seletor entre aspas (regra CSS inválida, coluna nunca reduzia); agora `:has(.sidebar.is-collapsed)` válido, com `--sidebar-width`/`--sidebar-width-collapsed` definidos no próprio `#workspace`; (2) o handler JS era idempotente (`const open = !sidebar.classList.contains('is-collapsed')`) e nunca alternava a classe — reescrito para inverter o estado (`applyState`) e persistir via `setSidebarCollapsed`.
- Responsividade ≤720px: layout colapsa para coluna única (`grid-template-columns: minmax(0,1fr)`), sidebar vira drawer overlay fixo e o botão do header aparece para abrir/fechar o painel.
- Janela do Manual alargada para `min(960px, calc(100% - 48px))` e `max-height: 86vh`, com `.visually-hidden` util.
- Correções Impeccable: remoção da transição de `width`/`flex-basis` na sidebar (layout-thrash) e fontes `0.9375rem`/`1.05rem` realinhadas à rampa (`0.875rem`/`1rem`).

### Deprecated

- Project scaffold: BMAD-structured repo (docs, specs, src, tests, tools, scripts, website).
- Docs in Diataxis layout (tutorial, how-to, explanation, reference), pt-BR.
- PRD (`specs/prd.md`) and v1 spec with testable ACs (`specs/spec-v1.md`).
- Vitest unit-test suite skeleton with fixtures (`tests/`).
- Quality gate `npm run quality` (format:check, lint, lint:md, test).
- LocalStorage wrapper (`src/storage.js`) replacing upstream `storehouse-js`.
- Impeccable skill vendored to `.opencode/skills/impeccable/` (project scope) via `npx impeccable install --providers=opencode --scope=project`.
- `PRODUCT.md` (durable product truth) and `DESIGN.md` (visual design system "The Quiet Studio") with machine-readable sidecar `.impeccable/design.json`.
- How-to `docs/how-to/impeccable-design-system.md` (workflow, detector, waivers).
- Docker local preview: multi-stage `Dockerfile` (node:22-alpine build → nginx:alpine runtime), `nginx.conf` (SPA fallback, immutable asset cache, defensive headers), `compose.yaml` (port 5001, healthcheck, restart policy) and `.dockerignore`.
- How-to `docs/how-to/docker-workflow.md` (build/up/down, nginx decisions, first-run audit).

### Changed

- Tool re-titled **Markdown-Studio**; strings upstream in English moved to `src/i18n/` (pt-BR default).
- Monaco, marked, DOMPurify, mermaid pinned as npm deps (no runtime CDN).
- All UI controls upgraded from `<a href="#">` to semantic `<button>`.
- Unified asset version strings into a single build constant.
- UI reworked under Impeccable "The Quiet Studio": tokenized CSS custom properties (colors, fonts, radii, spacing), flat/no-shadow hairline layering, §72px breakpoint stacking, complete interactive states (hover/focus-visible/active/disabled).
- `src/ui/divider.js` rewritten to support vertical (mobile, `row-resize`) and horizontal (desktop, `col-resize`) orientations while preserving min-size, dblclick recenter and resize ratio.

### Deprecated

- (none)

### Removed

- Busca incremental no Manual (barra `#manual-search`, helpers `src/ui/manualSearch.js`, chaves i18n `manualSearch*`, estilos `.manual-search*`/`mark[data-manual-hit]`) e o utilitário `.visually-hidden` que só alimentava o label da busca.
- Google Analytics tag (upstream `G-77C1GEG9C8`) — no tracking.
- `storehouse-js` git dependency and empty `.gitmodules`.

### Fixed

- (none in this release)

### Security

- Dependencies updated to resolve upstream `npm audit` findings (dompurify, mermaid, nanoid, postcss, vite).

## Baseline

Initial scaffold for **Markdown-Studio v1.0.0** — standalone reconstruction of
[`tanabe/markdown-live-preview`](https://github.com/tanabe/markdown-live-preview) (ISC license for both).
