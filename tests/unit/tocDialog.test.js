import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupTocDialog } from '../../src/ui/tocDialog.js';

function buildContainer() {
  const element = document.createElement('div');
  element.innerHTML = `
    <div id="preview"><h2 id="secao">Seção</h2></div>
    <button id="toc-close">Fechar</button>
    <dialog id="toc-dialog"><div id="toc-list"></div></dialog>
  `;
  const dialog = element.querySelector('#toc-dialog');
  dialog.showModal = vi.fn(() => {
    dialog.open = true;
  });
  dialog.close = vi.fn(() => {
    dialog.open = false;
  });
  dialog.removeAttribute = vi.fn();
  dialog.setAttribute = vi.fn();
  return element;
}

function fakeEditor() {
  return {
    revealPosition: vi.fn(),
    setPosition: vi.fn(),
    focus: vi.fn(),
  };
}

describe('setupTocDialog', () => {
  let container;

  beforeEach(() => {
    container = buildContainer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna null sem diálogo', () => {
    expect(setupTocDialog({ container: document.createElement('div') })).toBeNull();
  });

  it('abre e lista headings; clique reposiciona o editor e fecha', () => {
    const editor = fakeEditor();
    const api = setupTocDialog({
      container,
      editor,
      getContent: () => '# Seção',
    });
    api.open();
    const dialog = container.querySelector('#toc-dialog');
    expect(dialog.showModal).toHaveBeenCalled();
    const link = container.querySelector('#toc-list .toc-link');
    expect(link).toBeTruthy();
    link.click();
    expect(editor.revealPosition).toHaveBeenCalledWith({ lineNumber: 1, column: 1 });
    expect(dialog.close).toHaveBeenCalled();
  });

  it('reporta onEmpty quando não há headings', () => {
    const onEmpty = vi.fn();
    const api = setupTocDialog({ container, getContent: () => 'sem títulos', onEmpty });
    api.open();
    expect(onEmpty).toHaveBeenCalledTimes(1);
  });

  it('botão fechar fecha o diálogo', () => {
    const api = setupTocDialog({ container, getContent: () => '# x' });
    api.open();
    container.querySelector('#toc-close').click();
    expect(container.querySelector('#toc-dialog').close).toHaveBeenCalled();
  });

  it('clique em heading do preview revela a linha no editor (bidirecional)', () => {
    const editor = fakeEditor();
    setupTocDialog({
      container,
      editor,
      getContent: () => 'intro\n\n## Seção',
    });
    const heading = container.querySelector('#preview h2');
    heading.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(editor.revealPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 1 });
  });
});
