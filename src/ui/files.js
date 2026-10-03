/**
 * Operações de arquivo do Markdown-Studio.
 * Helpers puros (testáveis) + adaptadores da File System Access API
 * com fallback para navegadores sem suporte (Safari/Firefox).
 *
 * Contratos preservados: nenhum localStorage/key novo aqui; chaves vivem
 * no caller (src/ui/sidebar.js).
 */

export const MARKDOWN_ACCEPT = {
  description: 'Markdown',
  accept: { 'text/markdown': ['.md', '.markdown', '.mdown'], 'text/plain': ['.txt'] },
};

export function isMarkdownPath(name = '') {
  return /\.(md|markdown|mdown|mkd|txt)$/i.test(name);
}

export function toMarkdownName(name = 'untitled', ext = '.md') {
  const base = String(name || '').trim() || 'untitled';
  if (isMarkdownPath(base)) {
    return base;
  }
  return base.replace(/\.[^.\\/]+$/, '') + ext;
}

// Nomes reservados do Windows: como nome de arquivo final eles não existem —
// `CON.pdf` é impossível de gravar em qualquer Windows, inclusive via download.
const RESERVED_BASENAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

/**
 * Sanitiza o nome de um download (AC-P2-10-3): remove extensão antiga,
 * caracteres inválidos em arquivos (`/\\:*?"<>|` e control), colapsa
 * espaços, corta em 80 chars e evita nomes reservados do Windows.
 *
 * Devolve `fallback + ext` quando o nome limpo fica vazio ou reservado —
 * é o que preserva o comportamento legado (`markdown-preview.pdf`) sem
 * título de documento.
 *
 * @param {string} name título do documento ou nome de arquivo
 * @param {string} [ext=''] extensão final (com ponto), ex. `.pdf`
 * @param {string} [fallback='markdown-preview'] base usada quando o nome não serve
 * @returns {string} nome final pronto para `anchor.download`
 */
export function sanitizeDownloadName(name, ext = '', fallback = 'markdown-preview') {
  const raw = String(name ?? '');
  const base = raw
    .replace(/\.[^.\\/]+$/, '')
    .replace(/[\t\n\r\f\v]/g, ' ')
    // eslint-disable-next-line no-control-regex -- remoção deliberada de C0/C1 em nomes de arquivo
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .slice(0, 80)
    .replace(/[.\s]+$/, '');
  const safe =
    base && !RESERVED_BASENAMES.has(base.toLowerCase())
      ? base
      : String(fallback || 'markdown-preview');
  return safe + ext;
}

export function readFileAsText(file) {
  if (file && typeof file.text === 'function') {
    return Promise.resolve(file.text());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function supportsOpenPicker() {
  return (
    typeof window !== 'undefined' &&
    !!window.isSecureContext &&
    typeof window.showOpenFilePicker === 'function'
  );
}

export function supportsWriteOn(handle) {
  return !!handle && typeof handle.createWritable === 'function';
}

/**
 * Dispara o download de um Blob no navegador (fallback de save / export HTML).
 * @param {string} name
 * @param {string|Blob} content
 * @param {string} [mime='text/markdown;charset=utf-8']
 */
export function downloadBlob(name, content, mime = 'text/markdown;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
