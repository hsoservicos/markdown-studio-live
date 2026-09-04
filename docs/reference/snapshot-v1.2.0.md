# Snapshot v1.2.0 — 2026-09-04

Registro compacto do estado estável do Markdown-Studio na release **v1.2.0**. Publicado por
convenção BMAD: qualidade verde, CI verde no GitHub Actions, hooks husky ativos e repositório
sincronizado em `hsoservicos/markdown-studio-live`.

## Estado verificado (gate)

| Checagem               | Resultado                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run format:check` | Passou (fim de linha normalizado para **LF** — `.gitattributes` + `.editorconfig` + `endOfLine:'lf'`) |
| `npm run lint`         | 0 issues (`--max-warnings=0`)                                                                         |
| `npm run lint:md`      | Passou                                                                                                |
| `npm test`             | 22 arquivos / **211 testes verdes**                                                                   |
| `npm run build`        | Passou (chunks editor/mermaid/html2pdf/katex etc. — avisos de tamanho conhecidos)                     |
| GitHub Actions         | Workflow `Quality` verde em `master` (3 runs sucessivas após fix EOL)                                 |
| Husky                  | `pre-commit` (lint-staged) e `pre-push` (`npm run quality`) ativos                                    |
| Repositório            | `master` sincronizado; tags `v1.1.0` e `v1.2.0` no GitHub                                             |

## Features entregues nesta release (pós-v1.1.0)

### P0 — robustez + valor no fluxo de impressão (v1.2.0)

- **Configuração de página para PDF/Imprimir** (P0-1): margem, papel A4/Letter, orientação e
  cabeçalho/rodapé com `{page}` — persiste em `com.markdownstudio.print_settings`; alimenta
  `buildExportOptions`, a folha `@page` e o carimbo por página no PDF
  (`stampPageHeaderFooter` via `toPdf().get('pdf')`).
- **Quebras de página conscientes** (P0-2): marcador `<!-- page-break -->` → `<div
class="page-break">`; `break-inside: avoid` em tabelas/código/citações/figuras/listas/
  mermaid/KaTeX e `break-after: avoid` em headings — no `@media print` e no clone do PDF.
- **Barra de status com estatísticas** (P0-3): palavras, caracteres, linhas e tempo de leitura
  no `<footer>`; nome do arquivo aberto à frente.
- **Sumário (TOC) bidirecional** (P0-4): `src/render/toc.js` (extração por markdown ou HTML,
  mesmos ids/slugify do renderer) + `src/ui/tocDialog.js` (navegação editor ↔ headings).
- **Suporte a matemática (KaTeX)** (P0-5): `$…$` inline e `$$…$$` bloco via extensões marked
  (`src/render/katexExt.js`), katex como dep direta (CSS bundled, sem CDN), DOMPurify com
  allowlist MathML.

### Robustez pós-v1.1.0 (fixes A1/A2/M1–M4 + B1–B5)

- Mermaid single-flight (`renderMermaidDiagramsIn`); reset durável (`removeItem(last_state)`);
  export PDF pausa o scheduling do mermaid; debounce de digitação (~80 ms).
- Boot key de tema re-sincronizada (anti double-flip); leitura tipada na fronteira do storage
  (`StorageError`/`safeGet`).
- Divisor acessível por teclado; aria-labels estáticos; perfil DOMPurify (`noopener` +
  schemes restritos); input picker estável; erros sem prompt duplo (canal `aria-live`).

### P1 — compartilhamento de artefatos

- **Copiar como HTML rico** (P1-6): `ClipboardItem` `text/html` + `text/plain` (fallback
  plain); **Exportar HTML standalone** (P1-7): `.html` offline com CSS embutido;
  **Snapshots locais** (P1-8): anel `com.markdownstudio.backup` (máx. 5) com throttle de 60 s
  e diálogo de recuperação.

## Infra / governança

- Repositório publicado em `https://github.com/hsoservicos/markdown-studio-live` (branch
  `master`); `repository` no `package.json` e ícone GitHub no `index.html` atualizados.
- Workflow de qualidade agora dispara em `master` (era `main`) — CI volta a valer.
- Fim de linha determinístico **LF** (`.gitattributes`, `.editorconfig`, `prettier.config.mjs`)
  — o `format:check` falhava em todos os arquivos no runner Linux enquanto o editorconfig pedia
  CRLF.
- Husky com hooks reais: `pre-commit` (lint-staged) e `pre-push` (`npm run quality`).
- README com link para o upstream de estudo `tanabe/markdown-live-preview`; spec-v1 em status
  `implemented`; sprint-status e PRODUCT.md atualizados; docs de referência (storage-contract,
  architecture, api-convert) realinhados ao código.

## Veredito

Release **estável e utilizável** — escrever, ver, copiar, exportar (PDF/HTML) e recuperar
conteúdo, com impressão configurável (A4/margens/cabeçalho-rodapé), estatísticas, TOC, KaTeX e
snapshots locais. Gate verde e CI verde em `master`.

## Pendências conhecidas (não bloqueiam)

- PDF exportado é rasterizado (html2canvas) — não pesquisável; PDF vetorial é candidato P2.
- Chunks grandes no build (Monaco/editor, html2pdf, famílias mermaid/cynefin) — avisos
  conhecidos, code-split já em vigor.
- Múltiplos documentos (abas/lista) seguem como candidato P2.
