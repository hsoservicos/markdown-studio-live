---
title: 'Camada de layout vetorial (Markdown → pdfmake docDefinition)'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'b32bda3cd2b0a73c65a886c756ade103fe0991a8'
context:
  - docs/explanation/architecture.md
  - src/ui/exportPdf.js
  - src/ui/printSettings.js
  - src/render/convert.js
  - _bmad-output/implementation-artifacts/spec-1-1-spike-pdf-vetorial.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O PDF atual é rasterizado (html2canvas). Precisamos de uma camada que converte Markdown em pdfmake docDefinition para gerar PDF com texto vetorial pesquisável.

**Approach:** Implementar conversor Markdown→pdfmake (via marked lexer), adapter pdfmake (lazy-load), e novo entry point de export com feature-flag. O fluxo atual (html2pdf.js) continua como fallback.

## Boundaries & Constraints

**Always:** 100% client-side; dynamic import pdfmake; preservar P0-1 (print settings) e P0-2 (page breaks); feature-flag `com.markdownstudio.pdf.vector` (default off); testes unitários com mock (sem rede); quality gate verde

**Ask First:** Troca do default da feature-flag; remoção do fallback rasterizado

**Never:** Backend/server; CDN; quebra de compatibilidade com dados legados; remoção do html2pdf.js como fallback

</frozen-after-approval>

## Code Map

- `src/ui/exportPdf.js` -- Fluxo atual: loadHtml2Pdf → html2canvas → jsPDF. Referência para integração da feature-flag
- `src/ui/printSettings.js` -- DEFAULT_PRINT_SETTINGS, normalizePrintSettings, stampPageHeaderFooter, getPrintStylesheetCss. Reutilizar para config do pdfmake
- `src/render/convert.js` -- pipeline marked → DOMPurify. O marked lexer gera os tokens que o conversor vai consumir
- `src/render/katexExt.js` -- Extensões marked para KaTeX. Marca tokens math que precisam de tratamento especial
- `tests/unit/exportPdf.test.js` -- Testes do fluxo atual. Padrão de mock para referência

## Tasks & Acceptance

**Execution:**
- [x] `src/pdf/markdown-to-pdfmake.js` -- Conversor: marked lexer tokens → pdfmake content[]. Suporta: headings (h1-h6), paragraphs, lists (ul/ol), tables, code blocks, blockquotes, links, page-break markers
- [x] `src/pdf/pdfmake-adapter.js` -- Adapter: lazy-load pdfmake, configuração de fontes, createPdf wrapper. Exporta `renderMarkdownToPdf(markdown, settings)` que orquestra tudo
- [x] `src/ui/exportPdfVector.js` -- Entry point: loadPdfmake → render markdown → createPdf → download. Mesmo contrato de `exportPreviewToPdf` (onStatus, printSettings)
- [x] `src/ui/exportPdf.js` -- Integrar feature-flag: ler `com.markdownstudio.pdf.vector`, se true chamar exportPdfVector, senão fluxo atual
- [x] `tests/unit/markdown-to-pdfmake.test.js` -- Testes de conversão: cada tipo de bloco markdown
- [x] `tests/unit/pdfmake-adapter.test.js` -- Testes do adapter: lazy-load, fallback, config
- [x] `tests/unit/exportPdfVector.test.js` -- Testes do entry point: sucesso, erro, fallback

**Acceptance Criteria:**
- Given Markdown com headings/paragraphs/lists/tables/code/blockquotes/links, when convertido para pdfmake, then cada bloco gera o content type correto com texto vetorial
- Given margem/papel/orientação/cabeçalho-rodapé, when o PDF é gerado, then as configurações P0-1 são aplicadas
- Given `<!-- page-break -->` no markdown, when convertido, then o page break pdfmake é inserido
- Given feature-flag desabilitada, when export PDF é clicado, then o fluxo atual (html2pdf) é usado
- Given feature-flag habilitada, when export PDF é clicado, then o fluxo vetorial (pdfmake) é usado
- Given pdfmake indisponível, when feature-flag está habilitada, then fallback para html2pdf com status `pdfUnavailable`
- Given quality gate, when roda `npm run quality`, then verde (format + lint + lint:md + test)

## Verification

**Commands:**
- `npm run quality` -- expected: format:check ✓, lint ✓, lint:md ✓, test ✓ (234+ tests)
- `npm run build` -- expected: build OK, chunk pdfmake presente em dist/assets/

**Manual checks:**
- `src/pdf/markdown-to-pdfmake.js` exporta função que recebe markdown e retorna pdfmake docDefinition
- Feature-flag lida de `com.markdownstudio.pdf.vector` no localStorage
- Testes cobrem conversão de cada tipo de bloco e cenários de erro
