import { marked } from 'marked';
import DOMPurify from 'dompurify';

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

export function createMarkedRenderer() {
  const renderer = new marked.Renderer();
  const renderCode = renderer.code.bind(renderer);
  const renderHeading = renderer.heading.bind(renderer);
  const used = new Map();

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
  return DOMPurify.sanitize(html);
}
