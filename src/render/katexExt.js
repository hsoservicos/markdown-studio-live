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
  try {
    const container = document.createElement('div');
    container.style.cssText =
      'position:absolute;left:-9999px;top:-9999px;font-size:16px;line-height:1.3;white-space:nowrap;';
    container.innerHTML = html;
    document.body.appendChild(container);
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: null });
    document.body.removeChild(container);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
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
