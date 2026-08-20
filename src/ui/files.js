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
