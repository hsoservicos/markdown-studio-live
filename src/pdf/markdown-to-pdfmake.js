import { marked } from 'marked';
import { svgToDataUrl } from './svg-embed.js';
import { renderBlockMath, renderInlineMath, createMathExtensions } from '../render/katexExt.js';

marked.use({ extensions: createMathExtensions() });

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
        result.push({ text: token.text, font: 'Courier', background: '#f0f0f0' });
        break;
      case 'link':
        result.push({
          text: token.text,
          link: token.href,
          color: '#0969da',
        });
        break;
      case 'escape':
        result.push(token.text);
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
  const textTokens = item.tokens?.length ? item.tokens : [{ type: 'text', text: item.text }];
  const converted = [];
  for (const t of textTokens) {
    if (t.type === 'text' && t.tokens) {
      converted.push(...convertInlineTokens(t.tokens));
    } else if (t.type === 'paragraph') {
      converted.push(...convertInlineTokens(t.tokens));
    } else {
      converted.push(...convertInlineTokens([t]));
    }
  }
  return converted;
}

function convertTable(token) {
  const headerRow = token.header.map((cell) => ({
    text: cell.text,
    bold: true,
    fillColor: '#e8e8e8',
  }));
  const bodyRows = token.rows.map((row) =>
    row.map((cell) => ({
      text: cell.text,
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
    const dataUrl = svgToDataUrl(svg);
    if (dataUrl) {
      return {
        image: dataUrl,
        fit: [450, 300],
        margin: [0, 5, 0, 5],
      };
    }
  }
  const lines = token.text.split('\n');
  return {
    text: lines.map((line) => ({
      text: line + '\n',
      font: 'Courier',
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

function convertParagraph(token) {
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
          [token.ordered ? 'ol' : 'ul']: token.items.map((li) => ({
            text: convertListItem(li),
          })),
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

function hasKatexPlaceholder(item) {
  if (!item) return false;
  if (typeof item.text === 'string') {
    return item.text.includes(KATEX_PLACEHOLDER_PREFIX);
  }
  if (Array.isArray(item.text)) {
    return item.text.some((t) => typeof t === 'string' && t.includes(KATEX_PLACEHOLDER_PREFIX));
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

export async function resolveKatexPlaceholders(content, katexHtmlToDataUrl) {
  if (!katexHtmlToDataUrl) return content;
  const resolved = [];
  for (const item of content) {
    if (hasKatexPlaceholder(item)) {
      const texts = Array.isArray(item.text) ? item.text : [item.text];
      const newTexts = [];
      for (const t of texts) {
        if (typeof t === 'string' && t.includes(KATEX_PLACEHOLDER_PREFIX)) {
          const html = extractKatexHtml(t);
          if (html) {
            const dataUrl = await katexHtmlToDataUrl(html);
            if (dataUrl) {
              newTexts.push({ image: dataUrl, fit: [300, 50] });
            } else {
              newTexts.push(t);
            }
          } else {
            newTexts.push(t);
          }
        } else {
          newTexts.push(t);
        }
      }
      resolved.push({ ...item, text: newTexts.length === 1 ? newTexts[0] : newTexts });
    } else {
      resolved.push(item);
    }
  }
  return resolved;
}

export function buildPdfDocDefinition(content, settings = {}) {
  const { margin = 10, headerText = '', footerText = '' } = settings;

  const pageMargins = [margin, margin + 10, margin, margin + 10];

  const docDefinition = {
    content,
    pageMargins,
    defaultStyle: {
      fontSize: 11,
      lineHeight: 1.3,
    },
  };

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
