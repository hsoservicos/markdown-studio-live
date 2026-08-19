import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { createMathExtensions } from './katexExt.js';

marked.use({ extensions: createMathExtensions() });

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(text, used) {
  const base = String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
  if (!base) {
    return '';
  }
  if (!used.has(base)) {
    used.set(base, 0);
    return base;
  }
  const count = used.get(base) + 1;
  used.set(base, count);
  return `${base}-${count}`;
}

/** Re-exports the slug builder for consumers that must honor the same ids. */
export function slugifyHeading(text, used = new Map()) {
  return slugify(text, used);
}

export function createMarkedRenderer() {
  const renderer = new marked.Renderer();
  const renderCode = renderer.code.bind(renderer);
  const renderHeading = renderer.heading.bind(renderer);
  const renderHtml = renderer.html.bind(renderer);
  const used = new Map();

  // P0-2: marcador `<!-- page-break -->` → quebra de página na impressão.
  // Interceptado aqui porque o DOMPurify remove comentários HTML.
  renderer.html = (token) => {
    const text = typeof token === 'string' ? token : (token?.text ?? '');
    if (/^\s*<!(--\s*page-break\s*--)>/.test(text)) {
      return '<div class="page-break" aria-hidden="true"></div>\n';
    }
    return renderHtml(token);
  };

  renderer.code = (token) => {
    const lang = (token.lang || '').match(/^\S*/)?.[0].toLowerCase();
    if (lang !== 'mermaid') {
      return renderCode(token);
    }
    return `<pre class="mermaid">${escapeHtml(token.text)}</pre>\n`;
  };

  renderer.heading = (token) => {
    const text = String(renderHeading(token)).replace(/<[^>]*>/g, '');
    const id = slugify(text, used);
    if (!id) {
      return renderHeading(token);
    }
    const rendered = renderHeading(token);
    return rendered.replace(/^<h(\d)/, `<h$1 id="${id}"`);
  };

  return renderer;
}

// P0-5: o HTML do KaTeX usa MathML (acessibilidade); sem isso o DOMPurify
// removeria as fórmulas. `aria-hidden` é necessário no wrapper MathML.
const MATHML_TAGS = [
  'math',
  'annotation',
  'annotation-xml',
  'menclose',
  'merror',
  'mfenced',
  'mfrac',
  'mi',
  'mn',
  'mo',
  'mover',
  'mpadded',
  'mphantom',
  'mrow',
  'mroot',
  'ms',
  'mspace',
  'msqrt',
  'mstyle',
  'msub',
  'msubsup',
  'msup',
  'mtable',
  'mtd',
  'mtext',
  'mtr',
  'munder',
  'munderover',
  'semantics',
];

const SANITIZE_OPTIONS = {
  ADD_TAGS: MATHML_TAGS,
  ADD_ATTR: ['aria-hidden'],
};

/**
 * Pipeline puro: marked → renderer → DOMPurify.sanitize.
 * Não toca no DOM. Ideal para testes.
 *
 * @param {string} markdown - texto Markdown de entrada
 * @param {{ renderMermaid?: boolean }} opts - (somente diagramas são renderizados à parte)
 * @returns {string} HTML seguro
 */
export function convert(markdown, _opts = {}) {
  const renderer = createMarkedRenderer();
  const html = marked.parse(markdown, { renderer });
  return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
}
