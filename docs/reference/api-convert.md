# Reference: API pura de conversão — `src/render/`

> Para o "porquê" veja `docs/explanation/architecture.md`.

Módulos em `src/render/` são **funções puras**: não tocam no DOM (exceto o rendering de
diagramas via `mermaid.js`, que recebe o root). Ideais para testes.

## `convert(markdown: string) => string`

Pipeline completo **sem tocar no DOM**: `marked.parse` → renderer custom → `DOMPurify.sanitize`.

```js
import { convert } from './src/render/convert.js';

const html = convert(markdown);
```

**Comportamento:**

- Blocos ` ```mermaid ` viram `<pre class="mermaid">` com conteúdo HTML escapado
  (`escapeHtml`) — o rendering acontece à parte, em `mermaid.js`.
- Headings ganham `id` via `slugifyHeading` (normaliza acentos; desambigua duplicados com
  sufixo `-1`, `-2`, …) — os mesmos ids usados pelo TOC.
- `<!-- page-break -->` vira `<div class="page-break" aria-hidden="true">` (comentários HTML
  seriam removidos pelo DOMPurify, por isso a interceptação no renderer).
- Fórmulas `$…$` (inline) e `$$…$$` (bloco) são convertidas pelo KaTeX via extensões marked
  registradas em `createMathExtensions()` (`katexExt.js`).
- Todo o HTML de saída é sanitizado por DOMPurify (nunca confie em marked puro):
  - allowlist MathML (`ADD_TAGS`) + `aria-hidden` (`ADD_ATTR`);
  - `ALLOWED_URI_REGEXP` (de `urlPolicy.js`) restringe schemes (só `http(s)`, `mailto` e
    relativos; `tel:`, `javascript:` etc. perdem o href);
  - hook `afterSanitizeAttributes`: links `http(s)` ganham `target="_blank"` +
    `rel="noopener noreferrer"` (anti-tabnabbing).
- A assinatura é de um único parâmetro (o antigo `_opts` e a opção `renderMermaid` saíram —
  diagramas são sempre renderizados à parte).

## Outros exports de `convert.js`

| Export                        | Uso                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `escapeHtml(value)`           | escapa `& < > " '` — único helper do projeto (blocos mermaid **e** atributos do HTML standalone) |
| `slugifyHeading(text, used?)` | gera o slug de heading (mesmo algoritmo do renderer)                                             |
| `createMarkedRenderer()`      | cria o renderer custom (code/heading/html)                                                       |

## `src/render/urlPolicy.js` — allowlist de schemes

Contrato compartilhado entre o preview (DOMPurify) e o PDF vetorial (pdfmake), para que as duas
fronteiras não divirjam:

- `ALLOWED_URI_REGEXP` / `isSafeLinkHref(href)` — só `http(s)`, `mailto:` e relativas.
- `ALLOWED_IMAGE_URI_REGEXP` / `isSafeImageSrc(src)` — idem, mais `data:image/<tipo>`.

Uma mudança de política aqui afeta as duas rotas; os testes de `convert` e
`markdown-to-pdfmake` cobrem os dois lados.

## `src/render/mermaid.js` — diagramas

- `configureMermaid(theme)` — `mermaid.initialize` com `startOnLoad: false`,
  `securityLevel: 'strict'`.
- `getMermaidTheme()` / `getDefaultTheme()` — `'dark'` quando `data-theme="dark"`, senão
  `'default'`.
- `showMermaidError(element, error)` — erro vira `.mermaid-error` (mensagem i18n).
- `renderMermaidDiagramsIn(rootElement, theme?)` — itera `.mermaid` do root, **single-flight**
  (aguarda passagem em voo; `mermaid.render` não é reentrante) + version-guard (SVG obsoleto
  não é escrito).
- `renderMermaidDiagramsNow(theme?)` — atalho para `#output`.
- `scheduleMermaidRender(delay = 150)` — debounce; respeita `pauseMermaidScheduling()`.
- `pauseMermaidScheduling()` / `resumeMermaidScheduling()` — suspendem o agendamento durante
  capturas de export (PDF), evitando re-render concorrente.
- `renderMermaidDiagrams(theme?)` — cancela o debounce e renderiza na hora (troca de tema).

## `src/render/katexExt.js` — matemática (KaTeX)

- `createMathExtensions()` — extensões marked para `$…$` (inline) e `$$…$$` (bloco).
- `renderInlineMath(source)` / `renderBlockMath(source)` — wrappers de
  `katex.renderToString` (`throwOnError: false`); bloco embrulhado em `.katex-display`.

## `src/render/toc.js` — sumário

- `extractTocFromHtml(html)` — headings do HTML sanitizado (DOM) com `id`.
- `extractTocFromMarkdown(markdown, opts?)` — headings do markdown bruto (sem DOM, ignorando
  fences de código), com `line`; usa `slugifyHeading` por padrão.
- `buildTocHtml(items)` — HTML `<ul class="toc-list">` com recuo por nível.

## Contrato de segurança

1. `DOMPurify.sanitize` é a **única** fronteira antes de `innerHTML`.
2. Mermaid `securityLevel: 'strict'`.
3. Nunca concatenar HTML não sanitizado.
4. Links externos: `_blank` + `noopener noreferrer`; schemes não-http perdem o href.
5. O PDF vetorial reusa `urlPolicy.js`: href inseguro vira texto; imagem insegura vira alt.

## Como testar

```bash
npm test -- tests/unit/convert.test.js   # pipeline + sanitização + ids + page-break
npm test -- tests/unit/katexExt.test.js  # extensões de matemática
npm test -- tests/unit/toc.test.js       # extração/build do TOC
npm test -- tests/unit/mermaid.test.js   # single-flight, pause/resume, erros
```

Fixtures de apoio em `tests/fixtures/`.
