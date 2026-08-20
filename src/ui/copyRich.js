/**
 * Copia o preview como HTML rico + plain text para a área de transferência.
 * Preferência: ClipboardItem (text/html + text/plain). Fallback: writeText plain.
 */

export function supportsRichClipboard(clipboard = globalThis.navigator?.clipboard) {
  return Boolean(
    clipboard &&
    typeof clipboard.write === 'function' &&
    typeof globalThis.ClipboardItem === 'function',
  );
}

/**
 * @param {{ getHtml: () => string, getPlain?: () => string, clipboard?: Clipboard }} opts
 * @returns {Promise<'rich'|'plain'>} canal usado
 */
export async function copyRichHtml({
  getHtml,
  getPlain,
  clipboard = globalThis.navigator?.clipboard,
} = {}) {
  const html = String(getHtml?.() ?? '');
  const plain = String(
    getPlain?.() ??
      html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
  );

  if (supportsRichClipboard(clipboard)) {
    const item = new globalThis.ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    });
    await clipboard.write([item]);
    return 'rich';
  }

  if (clipboard && typeof clipboard.writeText === 'function') {
    await clipboard.writeText(plain || html);
    return 'plain';
  }

  throw new Error('clipboard-unavailable');
}
