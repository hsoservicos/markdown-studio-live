import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { registerMathExtensions } from './katexExt.js';
import { ALLOWED_URI_REGEXP } from './urlPolicy.js';

// G1: registro único/idempotente das extensões de matemática no marked global.
registerMathExtensions(marked);

/**
 * Único helper de escape do projeto. Serve para conteúdo de elemento (ex.: blocos
 * mermaid dentro de `<pre>`) **e** para valor de atributo (ex.: `<title>` do HTML
 * standalone) — escapar `'` também é inofensivo em atributo entre aspas duplas e
 * deixa o resultado pronto para qualquer uma das duas citações.
 */
export function escapeHtml(value) {
  return String(value ?? '')
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

/**
 * Texto VISÍVEL de um heading de markdown — fonte única para os ids (D8).
 *
 * O renderer do preview e o extrator do TOC calculavam o slug de textos
 * diferentes (HTML renderizado com tags removidas × markdown cru) e os ids
 * divergiam para headings com link (`veja-docs` × `veja-docshttpsexcom`), imagem
 * ou `&` (`tom-jerry` × `tom-amp-jerry`) — a navegação TOC↔preview falhava em
 * silêncio. Agora os dois lados passam por aqui antes do `slugify`.
 *
 * Regras: imagem → alt, link → texto, code span → conteúdo, tags HTML fora,
 * escapes markdown resolvidos, marcações de ênfase removidas.
 */
export function visibleHeadingText(raw) {
  // Escapes (`\*`, `\_`, …) viram placeholders antes de qualquer remoção de
  // marcação — senão o `\*` restaurado seria engolido como ênfase.
  const stash = [];
  const masked = String(raw ?? '').replace(/\\([\\`*_{}[\]()#+\-.!~|>])/g, (_m, ch) => {
    stash.push(ch);
    return `\u0000${stash.length - 1}\u0000`;
  });
  const stripped = masked
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`+([^`]+)`+/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/(^|[^\w])_([^_]+)_(?!\w)/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1');
  // eslint-disable-next-line no-control-regex -- placeholders \u0000…\u0000 do stash de escapes
  return stripped.replace(/\u0000(\d+)\u0000/g, (_m, i) => stash[Number(i)]).trim();
}

export function createMarkedRenderer() {
  const renderer = new marked.Renderer();
  const renderCode = renderer.code.bind(renderer);
  const renderHeading = renderer.heading.bind(renderer);
  const renderHtml = renderer.html.bind(renderer);
  const renderImage = renderer.image.bind(renderer);
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

  // Imagens remotas não carregam neste app: a CSP fixa
  // `img-src 'self' data: blob:` (offline, sem rastreamento — um fetch por
  // render vazaria IP e presença). Em vez do ícone de imagem quebrada, o alt
  // vira placeholder explícito; o export HTML copia o `innerHTML` do preview e
  // herda a mesma degradação. Só self (relativo), `data:` e `blob:` renderizam.
  renderer.image = (token) => {
    const src = String(token?.href ?? '').trim();
    const isLocal =
      /^(?:data:|blob:)/i.test(src) || (!/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith('//'));
    if (isLocal) {
      return renderImage(token);
    }
    const alt = String(token?.text ?? '').trim() || '[imagem]';
    return `<span class="img-unavailable">${escapeHtml(alt)}</span>`;
  };

  renderer.code = (token) => {
    const lang = (token.lang || '').match(/^\S*/)?.[0].toLowerCase();
    if (lang !== 'mermaid') {
      return renderCode(token);
    }
    return `<pre class="mermaid">${escapeHtml(token.text)}</pre>\n`;
  };

  renderer.heading = (token) => {
    const rendered = renderHeading(token);
    // D8: o id vem do texto VISÍVEL do markdown cru (fonte única, igual à do
    // TOC) — não do HTML renderizado, cuja remoção de tags deixava entidades
    // (`&amp;`) e divergia do extrator em links/imagens.
    const raw = typeof token?.text === 'string' ? token.text : '';
    const text = raw ? visibleHeadingText(raw) : String(rendered).replace(/<[^>]*>/g, '');
    const id = slugify(text, used);
    if (!id) {
      return rendered;
    }
    return rendered.replace(/^<h(\d)/, `<h$1 id="${id}"`);
  };

  return renderer;
}

// MathML escrito no próprio markdown sobrevive à sanitização. O DOMPurify já
// aceita as tags de conteúdo dentro de `<math>`, mas remove `semantics` e
// `annotation` — que são os nós que dão contexto ao `<mi>`/`<mo>` do usuário.
// `aria-hidden` é necessário no wrapper MathML (a fórmula é decorativa: o
// KaTeX desta app roda com `output: 'html'` e nem emite MathML).
// `annotation-xml` fica de fora de propósito: é o único vetor de XSS da
// MathML (`<annotation-xml encoding="text/html">` embrulha HTML arbitrário)
// e nenhum produtor desta app o emite.
const MATHML_TAGS = [
  'math',
  'annotation',
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
  // M1: `<style>` é recusado no topo mas sobrevive dentro de `<svg>` — e um
  // `<svg><style>@import url(…)</style>` executa no documento. O KaTeX não
  // emite `<style>` (depende do CSS da página) e o mermaid é injetado depois,
  // por outro caminho, então ninguém é prejudicado.
  FORBID_TAGS: ['style'],
  // B3: perfil de recursos externos — somente http(s)/mailto e URLs relativas;
  // bloqueia schemes como tel:/callto:/javascript: (este último já pelo default).
  // A allowlist vive em `urlPolicy.js` e é a mesma usada pelo PDF vetorial.
  ALLOWED_URI_REGEXP,
};

// M1: o DOMPurify mantém o atributo `style` por padrão, e CSS inline abre
// três frentes que o preview não deveria aceitar de markdown:
//   1. exfiltração — `background:url(https://…)` dispara um fetch a cada
//      render, vazando IP e presença;
//   2. UI redress — `position:fixed`/`sticky` cobre o editor inteiro por cima
//      da interface real;
//   3. payloads legados de IE — `expression()`, `behavior:`, `-moz-binding`.
// O atributo é removido inteiro (não declaração a declaração) porque um
// `url(data:…;base64,…)` contém `;` e fatiar por `;` deixaria CSS quebrado.
// KaTeX emite `style` inline com `position:absolute/relative` e alturas —
// nenhuma das regras acima o atinge.
const DANGEROUS_STYLE =
  /(?:url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding|javascript\s*:|position\s*:\s*(?:fixed|sticky))/i;

// B3: links externos abrem em nova aba com rel="noopener noreferrer"
// (sem reverse tabnabbing e sem navegar para longe do editor). O hook roda
// após a sanitização, então os atributos não são removidos pelo DOMPurify.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (typeof node.getAttribute === 'function' && node.hasAttribute('style')) {
    if (DANGEROUS_STYLE.test(node.getAttribute('style') || '')) {
      node.removeAttribute('style');
    }
  }
  if (node.tagName !== 'A' || !node.hasAttribute('href')) {
    return;
  }
  if (/^https?:/i.test(node.getAttribute('href'))) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Pipeline puro: marked → renderer → DOMPurify.sanitize.
 * Não toca no DOM. Ideal para testes.
 *
 * @param {string} markdown - texto Markdown de entrada
 * @returns {string} HTML seguro
 */
export function convert(markdown) {
  const renderer = createMarkedRenderer();
  const html = marked.parse(markdown, { renderer });
  return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
}
