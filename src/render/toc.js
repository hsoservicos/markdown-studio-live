import { slugifyHeading, visibleHeadingText, escapeHtml } from './convert.js';

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
  // D9: o fence só fecha com um delimitador do tamanho do opener — uma linha
  // de ``` dentro de ```` não pode "fechar" o bloco e liberar falsos headings.
  let fenceOpenerLength = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const fence = FENCE_PATTERN.exec(lines[i]);
    if (fence) {
      const fenceLength = fence[1].length;
      if (fenceOpenerLength === 0) {
        fenceOpenerLength = fenceLength;
      } else if (fenceLength >= fenceOpenerLength) {
        fenceOpenerLength = 0;
      }
      continue;
    }
    if (fenceOpenerLength > 0) {
      continue;
    }
    const m = HEADING_PATTERN.exec(lines[i]);
    if (m) {
      // D8: texto visível compartilhado com o renderer do preview — os ids dos
      // dois lados são idênticos por construção (teste cruzado em toc.test.js).
      const text = visibleHeadingText(m[2]);
      const id = slugFn(text, used);
      items.push({ level: m[1].length, text, id, line: i + 1 });
      continue;
    }
    // D9: setext — título sublinhado com `===` (h1) ou `---` (h2).
    const next = lines[i + 1] ?? '';
    if (lines[i].trim() !== '' && /^\s{0,3}(=+|-{2,})\s*$/.test(next)) {
      const text = visibleHeadingText(lines[i]);
      const level = next.trim().startsWith('=') ? 1 : 2;
      const id = slugFn(text, used);
      items.push({ level, text, id, line: i + 1 });
      i += 1;
    }
  }
  // D9: heading cujo texto visível não gera slug não vira âncora quebrada.
  return items.filter((item) => item.id !== '');
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
      // G2: `escapeHtml` único do projeto (o `escapeTocText` local era uma
      // cópia com cobertura menor — não escapava `'`).
      return `<li><a href="#${item.id}" class="toc-link" data-toc-target="${item.id}"${style}>${escapeHtml(item.text)}</a></li>`;
    })
    .join('');
  return `<ul class="toc-list">${html}</ul>`;
}
