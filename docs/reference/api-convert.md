# Reference: API pura de conversão — `src/render/`

> Para o "porquê" veja `docs/explanation/architecture.md`.

## `convert(markdown: string, options?) => string`

Performs full pipeline **sem tocar no DOM**: `marked.parse` → renderer custom → `DOMPurify.sanitize`. Ideada para testes.

**Assinatura (plano):**

```js
import { convert } from './src/render/convert.js';

const html = convert(markdown, { renderMermaid: false });
```

**Comportamento:**

- Blocos ` ```mermaid ` viram `<pre class="mermaid">` com conteúdo HTML escapado.
- Todo o HTML de saída é sanitizado por DOMPurify (nunca confie em marked puro).
- Opções aceitas: `renderMermaid` (bool), `theme` — para diagramas, manipulado à parte.

## `scheduleMermaidRender()` / `renderMermaidDiagramsNow(theme)`

Área de diagramas (em `src/render/mermaid.js`):

- `renderMermaidDiagramsNow` itera `.mermaid`, usa `mermaid.render(id, source)`, guarda source em `data-mermaidSource`, guarda versão por corrida.
- `scheduleMermaidRender` faz debounce de **150 ms**.
- Erros viram elemento `.mermaid-error` (mensagem legível).

## Contrato de segurança

1. `DOMPurify.sanitize` é a **única** fronteira antes de `innerHTML`.
2. Mermaid `securityLevel: 'strict'`.
3. Nunca concatenar HTML não sanitizado.

## Como testar

```bash
npm test -- tests/unit/render.test.js
```

Testes plantados em `tests/unit/` com fixtures em `tests/fixtures/`.
