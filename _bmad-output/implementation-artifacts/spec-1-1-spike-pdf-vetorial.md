---
title: 'Spike: Avaliar rota de PDF vetorial pesquisável'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'b32bda3cd2b0a73c65a886c756ade103fe0991a8'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O PDF atual é rasterizado (html2canvas → imagem), impedindo Ctrl+F, seleção e acessibilidade. O texto vira bitmap, perdendo qualidade e funcionalidade.

**Approach:** Avaliar tecnicamente as 3 rotas candidatas (pdfmake, jsPDF+autotable, pdf-lib) para geração de PDF com texto vetorial, documentando fidelidade do layout, suporte a conteúdo (tabelas/mermaid/KaTeX), custo de migração e bundle size. Registrar a decisão em ADR.

## Boundaries & Constraints

**Always:** 100% client-side; offline; dynamic import; preservar P0-1/P0-2; quality gate verde; testes unitários com mock (sem rede)

**Ask First:** Troca de lib principal (html2pdf.js → nova lib); mudança no fluxo de export existente

**Never:** Backend/server; CDN; quebra de compatibilidade com dados legados (localStorage); remoção do fallback rasterizado

</frozen-after-approval>

## Code Map

- `src/ui/exportPdf.js` -- Fluxo atual: loadHtml2Pdf → html2canvas → jsPDF (raster). Hooks: pause/resume mermaid, stampPageHeaderFooter
- `src/ui/printSettings.js` -- Config de impressão (margin, paperSize, orientation, header/footer). Normalização e persistência
- `src/render/convert.js` -- Pipeline marked → DOMPurify. Gera HTML que o preview exibe
- `src/render/mermaid.js` -- renderMermaidDiagrams: SVG no DOM após render. Reutilizável como imagem
- `src/render/katexExt.js` -- Extensões marked para KaTeX. output: 'html' (precisa de 'svg' para rota vetorial)
- `tests/unit/exportPdf.test.js` -- Testes do fluxo atual: mock html2pdf, buildExportOptions, exportPreviewToPdf

## Tasks & Acceptance

**Execution:**
- [x] `src/pdf/pdfmake-adapter.js` -- Criar adapter para pdfmake: lazy-load, configuração de fontes, CJK/emoji handling
- [x] `src/pdf/markdown-to-pdfmake.js` -- Converter AST marked → docDefinition pdfmake (headings, paragraphs, lists, tables, code, blockquotes, page-breaks)
- [x] `src/pdf/svg-embed.js` -- Helper para embutir SVG (mermaid/KaTeX) como imagem no pdfmake
- [x] `src/ui/exportPdfVector.js` -- Novo entry point: loadPdfmake → render markdown → createPdf → download. Feature-flag `com.markdownstudio.pdf.vector`
- [x] `tests/unit/pdfmake-adapter.test.js` -- Testes do adapter: lazy-load, fallback, config
- [x] `tests/unit/markdown-to-pdfmake.test.js` -- Testes de conversão: cada tipo de bloco markdown
- [x] `docs/explanation/architecture.md` -- ADR: decisão de rota, formato por tipo de conteúdo, estratégia KaTeX html→SVG

**Acceptance Criteria:**
- Given as rotas avaliadas, when o spike é concluído, then o ADR documenta para cada rota: fidelidade do layout, suporte a tabelas/mermaid/KaTeX, custo de migração e bundle size (com dynamic import)
- Given a rota escolhida, when o ADR é registrado, then a decisão é justificada em termos de trade-offs offline/client-side
- Given o spike, when os testes rodam, then o quality gate continua verde (format + lint + lint:md + test)

## Verification

**Commands:**
- `npm run quality` -- expected: format:check ✓, lint ✓, lint:md ✓, test ✓ (234+ tests)
- `npm run build` -- expected: build OK sem erros (warnings de chunk size são aceitáveis)

**Manual checks:**
- ADR em `docs/explanation/architecture.md` com seção clara sobre decisão de rota PDF
- Tabela comparativa das 3 rotas candidatas no ADR
