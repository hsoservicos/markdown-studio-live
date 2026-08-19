import { slugifyHeading } from './convert.js';

/**
 * Extrai headings (h1..h6) do HTML sanitizado do preview. Reusa os ids gerados
 * pelo renderer (slugifyHeading) para ancorar a navegação.
 *
 * @param {string} html - HTML sanitizado de #output
 * @returns {Array<{level:number, text:string, id:string}>}
 */
export function extractTocFromHtml(html) {
  if (!html) {
    return [];
  }
  const items = [];
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
    items.push({
      level: Number(heading.tagName.slice(1)),
      text: heading.textContent.trim(),
      id: heading.id || '',
    });
  });
  return items;
}

const HEADING_PATTERN = /^\s{0,3}(#{1,6})\s+(.+)$/;
const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Extrai headings diretamente do markdown bruto (sem DOM) — útil em testes e
 * em ambientes sem parse de HTML. Mantém os mesmos ids via slugifyHeading.
 * Ignora headings dentro de blocos de código cercados por fences.
 *
 * @param {string} markdown
 * @param {{ slug?: (text:string, used:Map<string,number>)=>string }} opts
 */
export function extractTocFromMarkdown(markdown, opts = {}) {
  if (!markdown) {
    return [];
  }
  const items = [];
  const used = new Map();
  const slugFn = opts.slug ?? ((text, usedMap) => slugifyHeading(text, usedMap));
  const lines = String(markdown).split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const fence = FENCE_PATTERN.exec(lines[i]);
    if (fence) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const m = HEADING_PATTERN.exec(lines[i]);
    if (m) {
      const text = m[2].trim();
      const id = slugFn(text, used);
      items.push({ level: m[1].length, text, id, line: i + 1 });
    }
  }
  return items;
}

/**
 * Constrói o HTML da árvore de TOC (ul aninhado por nível), preservando o
 * primeiro h1 como nível raiz.
 */
export function buildTocHtml(items) {
  if (!items || items.length === 0) {
    return '';
  }
  const minLevel = Math.min(...items.map((i) => i.level));
  const rows = items.map((item) => ({
    ...item,
    indent: Math.max(0, item.level - minLevel),
  }));
  const html = rows
    .map((item) => {
      const style = item.indent > 0 ? ` style="padding-left:${item.indent * 1.2}em"` : '';
      return `<li><a href="#${item.id}" class="toc-link" data-toc-target="${item.id}"${style}>${escapeTocText(item.text)}</a></li>`;
    })
    .join('');
  return `<ul class="toc-list">${html}</ul>`;
}

function escapeTocText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
