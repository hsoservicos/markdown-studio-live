---
title: 'Diagramas e matemática no PDF vetorial'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'b32bda3cd2b0a73c65a886c756ade103fe0991a8'
context:
  - src/render/mermaid.js
  - src/render/katexExt.js
  - src/pdf/markdown-to-pdfmake.js
  - src/ui/exportPdfVector.js
  - _bmad-output/implementation-artifacts/spec-1-2-layout-vetorial.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O conversor markdown→pdfmake ainda não trata tokens `math-block`/`math-inline` (KaTeX) nem blocos `mermaid`. No PDF vetorial, fórmulas e diagramas precisam aparecer como SVG embutido.

**Approach:** (1) Estender katexExt para gerar SVG via `output: 'svg'`; (2) capturar SVGs do mermaid já renderizados no DOM; (3) embutir ambos como imagens no pdfmake; (4) manter fallback HTML quando SVG não for suportado.

## Boundaries & Constraints

**Always:** SVG preferido; fallback para imagem rasterizada quando SVG indisponível; mermaid não re-renderiza (usa SVG do DOM); KaTeX re-renderiza com `output: 'svg'`; quebras de página (P0-2) preservadas; testes unitários com mock; quality gate verde

**Ask First:** Mudança no comportamento KaTeX do preview (html→svg)

**Never:** Re-renderizar mermaid no PDF; quebrar o fluxo de export existente; remover suporte a `output: 'html'` no preview

</frozen-after-approval>

## Code Map

- `src/render/katexExt.js` -- KaTeX extensions: `renderInlineMath`, `renderBlockMath`, `createMathExtensions`. Usa `output: 'html'` — precisa de `output: 'svg'` para rota vetorial
- `src/render/mermaid.js` -- `renderMermaidDiagramsIn`: renderiza mermaid → SVG no DOM. SVGs ficam em `.mermaid` elements após render
- `src/pdf/markdown-to-pdfmake.js` -- Conversor tokens → pdfmake. Precisa tratar `math-block`, `math-inline` e `code` (mermaid)
- `src/ui/exportPdfVector.js` -- Entry point: precisa capturar SVGs do mermaid antes de gerar PDF
- `tests/unit/katexExt.test.js` -- Testes KaTeX existentes

## Tasks & Acceptance

**Execution:**
- [x] `src/render/katexExt.js` -- Adicionar `katexHtmlToDataUrl` async: renderiza HTML KaTeX via html2canvas → data URL PNG
- [x] `src/pdf/svg-embed.js` -- Helper: `svgToDataUrl`, `captureMermaidSvgs`, `svgToPngDataUrl`
- [x] `src/pdf/markdown-to-pdfmake.js` -- Tratar tokens `math-block`/`math-inline` (placeholder HTML); tratar `code` com `lang=mermaid` (embed SVG via data URL); `resolveKatexPlaceholders` converte placeholders para imagens
- [x] `src/ui/exportPdfVector.js` -- Capturar SVGs do mermaid no `#output`; resolver placeholders KaTeX via `katexHtmlToDataUrl`
- [x] `tests/unit/svg-embed.test.js` -- Testes do helper SVG
- [x] `tests/unit/markdown-to-pdfmake.test.js` -- Adicionar testes para math e mermaid

**Acceptance Criteria:**
- Given documento com `$x^2$` e `$$\int_0^1 f(x)dx$$`, when convertido para pdfmake, then ambos geram image content com SVG data URL
- Given documento com ` ```mermaid\ngraph TD\n  A-->B\n``` `, when convertido para pdfmake, then o bloco gera image content com SVG data URL do mermaid
- Given mermaid no DOM, when capturado para PDF, then o SVG é extraído sem re-renderizar
- Given KaTeX SVG não suportado, when fallback ativa, then HTML do KaTeX é embutido como imagem rasterizada
- Given quality gate, when roda `npm run quality`, then verde

## Verification

**Commands:**
- `npm run quality` -- expected: verde (266+ tests)
- `npm run build` -- expected: build OK

**Manual checks:**
- `src/render/katexExt.js` exporta `renderInlineMathSvg` e `renderBlockMathSvg`
- `src/pdf/svg-embed.js` exporta `svgToDataUrl` e `captureMermaidSvgs`
- Testes cobrem conversão de math e mermaid para image content
