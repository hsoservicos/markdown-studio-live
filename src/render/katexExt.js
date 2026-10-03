import katex from 'katex';

const KATEX_OPTIONS = { throwOnError: false, output: 'html' };

export function renderInlineMath(source) {
  return katex.renderToString(source, { ...KATEX_OPTIONS, displayMode: false });
}

export function renderBlockMath(source) {
  return `<span class="katex-display">${katex.renderToString(source, {
    ...KATEX_OPTIONS,
    displayMode: true,
  })}</span>`;
}

export async function katexHtmlToDataUrl(html) {
  if (typeof document === 'undefined') {
    return null;
  }
  const container = document.createElement('div');
  container.style.cssText =
    'position:absolute;left:-9999px;top:-9999px;font-size:16px;line-height:1.3;white-space:nowrap;';
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const { default: html2canvas } = await import('html2canvas');
    // Contrato do PDF vetorial (AC-P2-9-2): raster de ALTA RESOLUÇÃO em 3×.
    // O KaTeX não tem saída SVG (o enum de `output` é htmlAndMathml|html|mathml
    // — a menção a `output:'svg'` no ADR era uma premissa falsa), então a rota
    // vetorial embute PNG 3× como limite de fidelidade. Ver architecture.md.
    const canvas = await html2canvas(container, { scale: 3, backgroundColor: null });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    // Fora do `catch`: se `html2canvas` lançar, o nó invisível ficava preso em
    // `document.body` para sempre (um por fórmula que falhar).
    container.remove();
  }
}

// $$...$$ (bloco, em linha própria) e $...$ (inline). Os tokens passam pela
// cadeia normal do marked e o HTML gerado pelo KaTeX é sanitizado pelo
// DOMPurify junto com o resto do documento.
export function createMathExtensions() {
  return [
    {
      name: 'math-block',
      level: 'block',
      start: (src) => src.indexOf('$$'),
      tokenizer: (src) => {
        if (!src.startsWith('$$')) {
          return undefined;
        }
        const match = /^\$\$([\s\S]+?)\$\$(?:\s*)/.exec(src);
        if (match && match[1].trim()) {
          return {
            type: 'math-block',
            raw: match[0],
            text: match[1].trim(),
          };
        }
        return undefined;
      },
      renderer: (token) => renderBlockMath(token.text),
    },
    {
      name: 'math-inline',
      level: 'inline',
      start: (src) => src.indexOf('$'),
      tokenizer: (src) => {
        if (!src.startsWith('$')) {
          return undefined;
        }
        if (src.startsWith('$$')) {
          return undefined;
        }
        const match = /^\$([^$\n]+)\$/.exec(src);
        if (match && match[1].trim()) {
          return {
            type: 'math-inline',
            raw: match[0],
            text: match[1].trim(),
          };
        }
        return undefined;
      },
      renderer: (token) => renderInlineMath(token.text),
    },
  ];
}

// G1: o `marked.use()` em dois módulos (convert e markdown-to-pdfmake)
// registrava as mesmas extensões DUAS vezes no marked global. O registro é
// idempotente por instância.
const registeredInstances = new WeakSet();

export function registerMathExtensions(markedInstance) {
  if (!markedInstance || registeredInstances.has(markedInstance)) {
    return;
  }
  registeredInstances.add(markedInstance);
  markedInstance.use({ extensions: createMathExtensions() });
}
