/**
 * Exporta o preview renderizado como um .html standalone offline.
 * CSS do github-markdown (light) é embutido via fetch no momento da exportação.
 */
import { downloadBlob, toMarkdownName } from './files.js';

const DEFAULT_CSS_URLS = ['/css/github-markdown-light.css'];

const BASE_BODY_CSS = `
html, body { margin: 0; padding: 0; background: #fff; color: #24292f; }
.markdown-body {
  box-sizing: border-box;
  min-width: 200px;
  max-width: 980px;
  margin: 0 auto;
  padding: 45px;
}
.markdown-body .page-break {
  break-after: page;
  page-break-after: always;
  height: 0;
  border: 0;
  margin: 0;
  padding: 0;
}
@media print {
  .markdown-body { max-width: none; padding: 0; }
}
`.trim();

export function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Monta o documento HTML completo (puro, testável).
 * @param {string} bodyHtml
 * @param {{ title?: string, cssText?: string, lang?: string }} [opts]
 */
export function buildStandaloneHtml(
  bodyHtml,
  { title = 'Markdown', cssText = '', lang = 'pt-BR' } = {},
) {
  const safeTitle = escapeHtmlAttr(title);
  const safeLang = escapeHtmlAttr(lang || 'pt-BR');
  const styles = [cssText, BASE_BODY_CSS].filter(Boolean).join('\n');
  return `<!DOCTYPE html>
<html lang="${safeLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
${styles}
</style>
</head>
<body>
<article class="markdown-body">
${bodyHtml || ''}
</article>
</body>
</html>
`;
}

/**
 * Carrega folhas de estilo locais e concatena o texto.
 * @param {string[]} urls
 * @param {typeof fetch} [fetchImpl]
 */
export async function loadCssText(urls = DEFAULT_CSS_URLS, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    return '';
  }
  const parts = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetchImpl(url);
        if (!res || !res.ok) {
          return '';
        }
        return await res.text();
      } catch {
        return '';
      }
    }),
  );
  return parts.filter(Boolean).join('\n');
}

/**
 * Exporta o HTML do preview como arquivo .html offline.
 * @param {{ getHtml: () => string, filename?: string, title?: string, lang?: string, cssUrls?: string[], fetchImpl?: typeof fetch, download?: typeof downloadBlob, onStatus?: (msg: string) => void }} opts
 */
export async function exportStandaloneHtml({
  getHtml,
  filename = 'document.html',
  title = 'Markdown',
  lang = 'pt-BR',
  cssUrls = DEFAULT_CSS_URLS,
  fetchImpl = globalThis.fetch,
  download = downloadBlob,
  onStatus,
} = {}) {
  const bodyHtml = String(getHtml?.() ?? '');
  const cssText = await loadCssText(cssUrls, fetchImpl);
  const html = buildStandaloneHtml(bodyHtml, { title, cssText, lang });
  const name = toMarkdownName(filename, '.html').replace(/\.md$/i, '.html');
  const finalName = /\.html$/i.test(name) ? name : `${name}.html`;
  download(finalName, html, 'text/html;charset=utf-8');
  onStatus?.(finalName);
  return finalName;
}
