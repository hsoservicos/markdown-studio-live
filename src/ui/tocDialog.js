import { extractTocFromMarkdown, buildTocHtml } from '../render/toc.js';

/**
 * Diálogo de sumário bidirecional: lista os headings do documento; clicar num
 * item re-posiciona o editor na linha e rola o preview até a âncora.
 * Clicar num heading do preview também move o cursor do editor.
 */
export function setupTocDialog({
  container = document,
  getContent = () => '',
  editor,
  onEmpty,
} = {}) {
  const dialog = container.querySelector('#toc-dialog');
  if (!dialog) {
    return null;
  }
  const listEl = container.querySelector('#toc-list');
  const closeButton = container.querySelector('#toc-close');

  function open() {
    const items = extractTocFromMarkdown(getContent());
    if (items.length === 0) {
      onEmpty?.();
      return;
    }
    if (listEl) {
      listEl.innerHTML = buildTocHtml(items);
      listEl.querySelectorAll('.toc-link').forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          const item = items.find((i) => i.id === link.dataset.tocTarget);
          if (item && editor) {
            editor.revealPosition({ lineNumber: item.line, column: 1 });
            editor.setPosition({ lineNumber: item.line, column: 1 });
            editor.focus();
          } else if (item) {
            document.getElementById(item.id)?.scrollIntoView();
          }
          close();
        });
      });
    }
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function close() {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  closeButton?.addEventListener('click', close);
  if (editor) {
    // bidirecional: clique em heading do preview move o cursor do editor
    const preview = container.querySelector('#preview');
    preview?.addEventListener('click', (event) => {
      const heading = event.target.closest?.('h1,h2,h3,h4,h5,h6');
      if (!heading || !heading.id) {
        return;
      }
      const items = extractTocFromMarkdown(getContent());
      const item = items.find((i) => i.id === heading.id);
      if (item && editor) {
        editor.revealPosition({ lineNumber: item.line, column: 1 });
      }
    });
  }

  return { open, close };
}
