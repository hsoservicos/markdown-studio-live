import { marked } from 'marked';
import { renderBlockMath, renderInlineMath, registerMathExtensions } from '../render/katexExt.js';
import { isSafeLinkHref } from '../render/urlPolicy.js';

// G1: idempotente — não duplica as extensões já registradas pelo convert.js.
registerMathExtensions(marked);

const HEADING_SIZES = { 1: 22, 2: 18, 3: 15, 4: 13, 5: 11, 6: 10 };

export const KATEX_PLACEHOLDER_PREFIX = '__KATEX_HTML__:';
export const KATEX_PLACEHOLDER_SUFFIX = '__END__';

function convertInlineTokens(tokens = []) {
  const result = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        result.push(token.text);
        break;
      case 'strong':
        result.push({ text: convertInlineTokens(token.tokens), bold: true });
        break;
      case 'em':
        result.push({ text: convertInlineTokens(token.tokens), italics: true });
        break;
      case 'codespan':
        // A1: o vfs do pdfmake só tem Roboto — a fonte `Courier` apontava para
        // TTFs inexistentes e abortava o export. Código preserva o destaque
        // visual pelo fundo, na fonte base.
        result.push({ text: token.text, background: '#f0f0f0' });
        break;
      case 'link':
        // Mesma allowlist de schemes do preview (urlPolicy.js): href não seguro
        // (javascript:, tel:, …) degrada para o rótulo, sem anotação no PDF.
        // Teste de regressão: tests/unit/pdf-vector-link-safety.test.js.
        if (isSafeLinkHref(token.href)) {
          result.push({
            text: token.text,
            link: token.href,
            color: '#0969da',
          });
        } else {
          result.push(token.text ?? '');
        }
        break;
      case 'image':
        // pdfmake não aceita `image` dentro de um array `text` (é um item de
        // bloco), então imagens em contexto inline degradam para o alt — nunca
        // o markdown cru. Imagens sozinhas no parágrafo viram bloco (abaixo).
        result.push(token.text ?? '');
        break;
      case 'escape':
        result.push(token.text);
        break;
      case 'del':
        // A6: tildes não podem vazar como markdown cru.
        result.push({
          text: convertInlineTokens(token.tokens ?? [{ type: 'text', text: token.text }]),
          decoration: 'lineThrough',
        });
        break;
      case 'math-inline': {
        const html = renderInlineMath(token.text);
        result.push({ text: `${KATEX_PLACEHOLDER_PREFIX}${html}${KATEX_PLACEHOLDER_SUFFIX}` });
        break;
      }
      default:
        result.push(token.text || token.raw || '');
        break;
    }
  }
  return result;
}

function convertListItem(item) {
  // A6: o nó do item pode carregar lista aninhada (`ul`/`ol`) — antes o token
  // `list` caía no default e o markdown cru vazava para o PDF.
  const node = { text: [] };
  const textTokens = item.tokens?.length ? item.tokens : [{ type: 'text', text: item.text }];
  for (const t of textTokens) {
    if (t.type === 'list') {
      const key = t.ordered ? 'ol' : 'ul';
      node[key] = t.items.map((li) => convertListItem(li));
    } else if (t.type === 'text' && t.tokens) {
      node.text.push(...convertInlineTokens(t.tokens));
    } else if (t.type === 'paragraph') {
      node.text.push(...convertInlineTokens(t.tokens));
    } else {
      node.text.push(...convertInlineTokens([t]));
    }
  }
  return node;
}

function convertTable(token) {
  // A5: `cell.text` é markdown cru — bold/links/math impressos como sintaxe.
  // O marked v18 traz `tokens` por célula; sem tokens, cai no texto puro.
  const cellText = (cell) =>
    convertInlineTokens(cell.tokens?.length ? cell.tokens : [{ type: 'text', text: cell.text }]);
  const headerRow = token.header.map((cell) => ({
    text: cellText(cell),
    bold: true,
    fillColor: '#e8e8e8',
  }));
  const bodyRows = token.rows.map((row) =>
    row.map((cell) => ({
      text: cellText(cell),
    })),
  );
  return {
    table: {
      headerRows: 1,
      widths: token.header.map(() => '*'),
      body: [headerRow, ...bodyRows],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 5, 0, 5],
  };
}

function convertCodeBlock(token, options = {}) {
  const lang = (token.lang || '').toLowerCase();
  if (lang === 'mermaid' && options.mermaidSvgs?.has(token.text)) {
    const svg = options.mermaidSvgs.get(token.text);
    // A2: o pdfmake só decodifica JPEG/PNG no content type `image` —
    // `data:image/svg+xml` abortava o export com "Invalid image". SVG é o
    // content type próprio (`svg`), com a STRING do SVG.
    if (typeof svg === 'string' && svg.trim().startsWith('<svg')) {
      return {
        svg,
        fit: [450, 300],
        margin: [0, 5, 0, 5],
      };
    }
  }
  const lines = token.text.split('\n');
  return {
    text: lines.map((line) => ({
      text: line + '\n',
      fontSize: 9,
    })),
    margin: [10, 5, 10, 5],
    background: '#f6f8fa',
  };
}

function convertBlockquote(token) {
  const items = [];
  for (const t of token.tokens || []) {
    if (t.type === 'paragraph') {
      items.push(...convertInlineTokens(t.tokens));
    } else {
      items.push(...convertInlineTokens([t]));
    }
  }
  return {
    margin: [20, 5, 0, 5],
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 0, y2: 0, lineWidth: 0 }],
    columns: [
      {
        width: 3,
        canvas: [{ type: 'rect', x: 0, y: 0, w: 3, h: 20, color: '#d0d7de' }],
      },
      {
        width: '*',
        text: items,
        margin: [10, 0, 0, 0],
        fontSize: 11,
        color: '#656d76',
      },
    ],
  };
}

function convertHeading(token) {
  const fontSize = HEADING_SIZES[token.depth] || 10;
  const text = convertInlineTokens(token.tokens);
  return {
    text,
    fontSize,
    bold: true,
    margin: [0, token.depth === 1 ? 15 : 10, 0, 5],
  };
}

function convertBlockImage(token, options = {}) {
  const src = String(token.href ?? '').trim();
  // A3: imagens relativas podem ter sido resolvidas para data URL pelo
  // exportador (fetch de mesma origem → PNG/JPEG). O mapa é injetado aqui —
  // `markdownToPdfmake` continua síncrono e puro.
  const resolved = options.imageDataUrls?.get?.(src);
  const embeddable = (url) => /^data:image\/(?:png|jpe?g);base64,/i.test(url);
  let finalSrc = null;
  if (embeddable(src)) {
    finalSrc = src;
  } else if (resolved && embeddable(resolved)) {
    finalSrc = resolved;
  }
  if (finalSrc) {
    return {
      image: finalSrc,
      fit: [450, 300],
      margin: [0, 5, 0, 5],
    };
  }
  // Fonte não embutível: cai para o texto alternativo (nunca o markdown cru).
  return { text: token.text ?? '', margin: [0, 3, 0, 3] };
}

function isImageOnlyParagraph(token) {
  const tokens = token.tokens ?? [];
  const meaningful = tokens.filter((t) => !(t.type === 'text' && !String(t.text ?? '').trim()));
  return meaningful.length > 0 && meaningful.every((t) => t.type === 'image');
}

function convertParagraph(token, options = {}) {
  // `![alt](url)` sozinho no parágrafo é uma imagem de bloco: o pdfmake só
  // aceita imagens fora de `text`, então monta o item diretamente.
  if (isImageOnlyParagraph(token)) {
    const images = token.tokens
      .filter((t) => t.type === 'image')
      .map((t) => convertBlockImage(t, options));
    return images.length === 1 ? images[0] : { stack: images };
  }
  const text = convertInlineTokens(token.tokens);
  return {
    text,
    margin: [0, 3, 0, 3],
  };
}

function convertHr() {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#d0d7de' }],
    margin: [0, 10, 0, 10],
  };
}

function convertHtml(token) {
  const text = token.text || token.raw || '';
  if (/^\s*<!(--\s*page-break\s*--)>/.test(text)) {
    return { text: '', pageBreak: 'before' };
  }
  return null;
}

function convertTokens(tokens = [], options = {}) {
  const content = [];
  for (const token of tokens) {
    let item;
    switch (token.type) {
      case 'heading':
        item = convertHeading(token);
        break;
      case 'paragraph':
        item = convertParagraph(token, options);
        break;
      case 'list':
        item = {
          [token.ordered ? 'ol' : 'ul']: token.items.map((li) => convertListItem(li)),
          margin: [0, 3, 0, 3],
        };
        break;
      case 'table':
        item = convertTable(token);
        break;
      case 'code':
        item = convertCodeBlock(token, options);
        break;
      case 'blockquote':
        item = convertBlockquote(token);
        break;
      case 'hr':
        item = convertHr();
        break;
      case 'html':
        item = convertHtml(token);
        break;
      case 'math-block': {
        const html = renderBlockMath(token.text);
        item = {
          text: KATEX_PLACEHOLDER_PREFIX + html + KATEX_PLACEHOLDER_SUFFIX,
          margin: [0, 5, 0, 5],
        };
        break;
      }
      case 'space':
        continue;
      default:
        item = { text: token.text || token.raw || '', margin: [0, 3, 0, 3] };
        break;
    }
    if (item != null) {
      content.push(item);
    }
  }
  return content;
}

export function markdownToPdfmake(markdown, options = {}) {
  const tokens = marked.lexer(markdown);
  const content = convertTokens(tokens, options);
  return {
    content,
    defaultStyle: {
      fontSize: 11,
      lineHeight: 1.3,
    },
    styles: {
      header: { fontSize: 22, bold: true },
    },
  };
}

/**
 * Coleta os `src` de imagens de bloco buscáveis (caminhos relativos de mesma
 * origem) para o exportador resolver via fetch → data URL (A3). Origens de
 * rede não são buscadas (D6: CSP/`img-src` e offline).
 * @returns {string[]}
 */
export function collectImageSrcs(markdown) {
  const tokens = marked.lexer(String(markdown ?? ''));
  const srcs = new Set();
  const walk = (list) => {
    for (const t of list ?? []) {
      if (t.type === 'image' && typeof t.href === 'string') {
        const src = t.href.trim();
        if (src && !/^(?:data:|blob:|\/\/|[a-z][a-z0-9+.-]*:)/i.test(src)) {
          srcs.add(src);
        }
      }
      walk(t.tokens);
      walk(t.items);
      for (const cell of t.header ?? []) walk(cell.tokens);
      for (const row of t.rows ?? []) for (const cell of row) walk(cell.tokens);
    }
  };
  walk(tokens);
  return [...srcs];
}

function isKatexRun(run) {
  return (
    run != null &&
    typeof run === 'object' &&
    typeof run.text === 'string' &&
    run.text.includes(KATEX_PLACEHOLDER_PREFIX)
  );
}

function omitText(node) {
  const copy = { ...node };
  delete copy.text;
  return copy;
}

function hasKatexPlaceholder(item) {
  if (!item) return false;
  if (typeof item.text === 'string') {
    return item.text.includes(KATEX_PLACEHOLDER_PREFIX);
  }
  if (Array.isArray(item.text)) {
    return item.text.some((run) => {
      if (typeof run === 'string') return run.includes(KATEX_PLACEHOLDER_PREFIX);
      if (isKatexRun(run)) return true;
      // A7: run aninhado (strong/em devolve `{text: runs[]}`) também pode
      // carregar o placeholder.
      return Array.isArray(run?.text) && hasKatexPlaceholder(run);
    });
  }
  // A7: blockquote (columns) e listas (ul/ol) carregam placeholders aninhados.
  if (Array.isArray(item.columns)) {
    return item.columns.some(hasKatexPlaceholder);
  }
  if (Array.isArray(item.ul)) {
    return item.ul.some(hasKatexPlaceholder);
  }
  if (Array.isArray(item.ol)) {
    return item.ol.some(hasKatexPlaceholder);
  }
  return false;
}

function extractKatexHtml(text) {
  const start = text.indexOf(KATEX_PLACEHOLDER_PREFIX);
  if (start === -1) return null;
  const htmlStart = start + KATEX_PLACEHOLDER_PREFIX.length;
  const end = text.indexOf(KATEX_PLACEHOLDER_SUFFIX, htmlStart);
  if (end === -1) return null;
  return text.substring(htmlStart, end);
}

/**
 * Troca os placeholders KaTeX por nós de imagem do pdfmake.
 *
 * Duas formas de placeholder precisam ser tratadas:
 * - string direta no `text` do item (math-block) → o item inteiro vira nó de
 *   imagem;
 * - run aninhado `{text: '<placeholder>'}` dentro de `text[]` (math-inline) →
 *   só o run vira imagem, o texto ao redor é preservado.
 *
 * O nó de imagem sai como `{image, fit}` no nível do item de conteúdo: o
 * pdfmake testa `node.text !== undefined` antes de `node.image`, então
 * `text: {image, ...}` seria medido como texto e viraria lixo.
 */
export async function resolveKatexPlaceholders(content, katexHtmlToDataUrl) {
  if (!katexHtmlToDataUrl) return content;

  async function imageFor(text) {
    const html = extractKatexHtml(text);
    if (!html) return null;
    // Uma fórmula que não converte não pode derrubar o export inteiro: o
    // chamador degrada mantendo o texto, como no retorno `null`.
    let dataUrl = null;
    try {
      dataUrl = await katexHtmlToDataUrl(html);
    } catch (error) {
      console.warn('[pdf] falha ao rasterizar KaTeX; a fórmula sai como texto', error);
    }
    return dataUrl ? { image: dataUrl, fit: [300, 50] } : null;
  }

  async function resolveRun(run) {
    if (typeof run === 'string') {
      if (!run.includes(KATEX_PLACEHOLDER_PREFIX)) return run;
      return (await imageFor(run)) ?? run;
    }
    if (isKatexRun(run)) {
      const image = await imageFor(run.text);
      if (!image) return run;
      return { ...omitText(run), ...image };
    }
    // A7: run aninhado (strong/em devolve `{text: runs[]}`) — resolve os filhos.
    if (Array.isArray(run?.text)) {
      const inner = [];
      for (const r of run.text) {
        inner.push(await resolveRun(r));
      }
      return { ...run, text: inner };
    }
    return run;
  }

  async function resolveRuns(runs) {
    const next = [];
    for (const run of runs) {
      next.push(await resolveRun(run));
    }
    return next;
  }

  async function resolveList(items) {
    const next = [];
    for (const li of items) {
      next.push(await resolveItem(li));
    }
    return next;
  }

  async function resolveItem(item) {
    if (!hasKatexPlaceholder(item)) {
      return item;
    }
    let out = item;
    if (typeof out.text === 'string' || Array.isArray(out.text)) {
      const runs = Array.isArray(out.text) ? out.text : [out.text];
      const next = await resolveRuns(runs);
      const only = next.length === 1 ? next[0] : null;
      if (only && typeof only === 'object' && only.image) {
        out = { ...omitText(out), ...only };
      } else {
        out = { ...out, text: next.length === 1 ? next[0] : next };
      }
    }
    // A7: blockquote (columns) e listas (ul/ol) carregam filhos com placeholders.
    if (Array.isArray(out.columns)) {
      const cols = [];
      for (const col of out.columns) {
        cols.push(await resolveItem(col));
      }
      out = { ...out, columns: cols };
    }
    if (Array.isArray(out.ul)) {
      out = { ...out, ul: await resolveList(out.ul) };
    }
    if (Array.isArray(out.ol)) {
      out = { ...out, ol: await resolveList(out.ol) };
    }
    return out;
  }

  const resolved = [];
  for (const item of content) {
    resolved.push(await resolveItem(item));
  }
  return resolved;
}

export function buildPdfDocDefinition(content, settings = {}) {
  const { margin = 10, headerText = '', footerText = '', paperSize, orientation } = settings;

  const pageMargins = [margin, margin + 10, margin, margin + 10];

  const docDefinition = {
    content,
    pageMargins,
    defaultStyle: {
      fontSize: 11,
      lineHeight: 1.3,
    },
  };

  // A4: Letter/paisagem do diálogo de impressão precisam chegar ao pdfmake —
  // sem isto a rota vetorial sempre saía em A4 retrato (AC-P2-9-1).
  const PAGE_SIZES = { a4: 'A4', letter: 'LETTER' };
  const pageSize = PAGE_SIZES[paperSize] ?? 'A4';
  docDefinition.pageSize = pageSize;
  if (orientation === 'landscape' || orientation === 'portrait') {
    docDefinition.pageOrientation = orientation;
  }

  if (headerText || footerText) {
    docDefinition.header = (currentPage, _pageCount) => {
      const items = [];
      if (headerText) {
        items.push({
          text: headerText.replace(/\{page\}/g, String(currentPage)),
          alignment: 'center',
          fontSize: 8,
          color: '#6e7781',
          margin: [0, 5, 0, 0],
        });
      }
      return items.length ? items : null;
    };
    docDefinition.footer = (currentPage, _pageCount) => {
      const items = [];
      if (footerText) {
        items.push({
          text: footerText.replace(/\{page\}/g, String(currentPage)),
          alignment: 'center',
          fontSize: 8,
          color: '#6e7781',
          margin: [0, 0, 0, 5],
        });
      }
      return items.length ? items : null;
    };
  }

  return docDefinition;
}
