/**
 * Exporta o preview renderizado como .html standalone offline.
 *
 * D7: o CSS do github-markdown é **empacotado no build** via `?inline` (as duas
 * variantes que o app usa — espelhando `setPreviewCss` do `main.js`) em vez de
 * buscado em runtime: elimina a classe inteira de falha (404, deploy em
 * subpath, `file://`, offline) e o export acompanha o tema ativo.
 */
import { downloadBlob, sanitizeDownloadName } from './files.js';
import { escapeHtml } from '../render/convert.js';
import cssLight from '../../public/css/github-markdown-light.css?inline';
import cssDarkDimmed from '../../public/css/github-markdown-dark_dimmed.css?inline';

/** Variantes embutidas no bundle (mesma escolha do `setPreviewCss` no main.js). */
export const GITHUB_MARKDOWN_CSS = {
  light: cssLight,
  dark_dimmed: cssDarkDimmed,
};

/**
 * Resolve a folha do github-markdown para o tema informado.
 * `dark` usa `dark_dimmed` (variante de preview do app).
 * @param {'light'|'dark'} [theme='light']
 * @param {Record<string, string>} [cssByTheme=GITHUB_MARKDOWN_CSS]
 */
export function resolveGithubMarkdownCss(theme = 'light', cssByTheme = GITHUB_MARKDOWN_CSS) {
  return (theme === 'dark' ? cssByTheme.dark_dimmed : cssByTheme.light) ?? '';
}

function buildBaseBodyCss(theme = 'light') {
  const dark = theme === 'dark';
  return `
html, body { margin: 0; padding: 0; background: ${dark ? '#0d1117' : '#fff'}; color: ${dark ? '#e6edf3' : '#24292f'}; }
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
}

// M2: o arquivo exportado é HTML estático sem nenhum script próprio, mas era
// aberto sem política nenhuma — qualquer resto que escapasse do DOMPurify
// (ou um `<svg><style>` remanescente) executaria sem restrição. Um
// `<meta http-equiv>` é o único lugar onde dá para declarar CSP num arquivo
// offline. `style-src 'unsafe-inline'` é obrigatório: o CSS embutido, os
// `style` do KaTeX e o `<style>` interno dos SVGs do mermaid são inline.
// `frame-ancestors` é ignorado em meta (só vale em header) e por isso não
// aparece aqui.
const STANDALONE_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "script-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "connect-src 'none'",
  "style-src 'unsafe-inline'",
  'img-src * data: blob:',
  'font-src * data:',
  'media-src * data: blob:',
].join('; ');

/**
 * Monta o documento HTML completo (puro, testável).
 * @param {string} bodyHtml
 * @param {{ title?: string, cssText?: string, lang?: string, theme?: 'light'|'dark', csp?: string|null }} [opts]
 */
export function buildStandaloneHtml(
  bodyHtml,
  { title = 'Markdown', cssText = '', lang = 'pt-BR', theme = 'light', csp = STANDALONE_CSP } = {},
) {
  // Mesmo helper usado pelo pipeline de preview — um único escape no projeto.
  const safeTitle = escapeHtml(title);
  const safeLang = escapeHtml(lang || 'pt-BR');
  const styles = [cssText, buildBaseBodyCss(theme)].filter(Boolean).join('\n');
  const cspMeta = csp
    ? `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}" />\n`
    : '';
  return `<!DOCTYPE html>
<html lang="${safeLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${cspMeta}<title>${safeTitle}</title>
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
 * Exporta o HTML do preview como arquivo .html offline.
 * @param {{ getHtml: () => string, filename?: string, title?: string, lang?: string, theme?: 'light'|'dark', cssByTheme?: Record<string, string>, download?: typeof downloadBlob, onStatus?: (msg: string) => void }} opts
 */
export async function exportStandaloneHtml({
  getHtml,
  filename = 'document.html',
  title = 'Markdown',
  lang = 'pt-BR',
  theme = 'light',
  cssByTheme = GITHUB_MARKDOWN_CSS,
  download = downloadBlob,
  onStatus,
} = {}) {
  const bodyHtml = String(getHtml?.() ?? '');
  const cssText = resolveGithubMarkdownCss(theme, cssByTheme);
  const html = buildStandaloneHtml(bodyHtml, { title, cssText, lang, theme });
  // AC-P2-10-3: nome vem do documento ativo e é sanitizado (caracteres
  // inválidos de arquivo, extensão antiga, nomes reservados do Windows).
  const finalName = sanitizeDownloadName(filename, '.html', 'document');
  download(finalName, html, 'text/html;charset=utf-8');
  onStatus?.(finalName);
  return finalName;
}
