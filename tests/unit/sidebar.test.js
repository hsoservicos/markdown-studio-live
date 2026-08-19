import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setLocale, t } from '../../src/i18n/index.js';
import { convert } from '../../src/render/convert.js';
import {
  isSidebarCollapsed,
  setSidebarCollapsed,
  renderManual,
  clearManualCache,
  getManualUrl,
  openFileDialog,
  saveFileDialog,
  setupSidebar,
  SIDEBAR_STORAGE_KEY,
} from '../../src/ui/sidebar.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    clear: () => map.clear(),
  };
}

describe('sidebar helpers', () => {
  let storage;

  beforeEach(() => {
    storage = fakeStorage();
    clearManualCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.localStorage;
  });

  describe('setupSidebar handlers', () => {
    let container;

    function buildContainer() {
      const element = document.createElement('div');
      element.innerHTML = `
        <aside id="sidebar" class="sidebar"></aside>
        <nav id="sidebar-nav">
          <button type="button" class="sidebar-item" data-sidebar-action="reset"></button>
          <button type="button" class="sidebar-item" data-sidebar-action="copy"></button>
          <button type="button" class="sidebar-item" data-sidebar-action="exportPdf"></button>
          <button type="button" class="sidebar-item" data-sidebar-action="desconhecida"></button>
        </nav>
        <div id="sidebar-status"></div>
      `;
      return element;
    }

    beforeEach(() => {
      globalThis.localStorage = fakeStorage();
      container = buildContainer();
    });

    it('despacha handlers customizados ao clicar no botão', () => {
      const editor = { getValue: () => '# x', setValue: vi.fn() };
      const handler = vi.fn();
      const api = setupSidebar({
        container,
        editor,
        getContent: () => editor.getValue(),
        handlers: { reset: handler },
      });
      container.querySelector('[data-sidebar-action="reset"]').click();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        report: expect.any(Function),
        editor,
        getContent: expect.any(Function),
      });
      expect(api).not.toBeNull();
    });

    it('não falha quando action não tem handler', () => {
      const editor = { getValue: () => '# x', setValue: vi.fn() };
      const api = setupSidebar({ container, editor, handlers: {} });
      expect(() =>
        container.querySelector('[data-sidebar-action="desconhecida"]').click(),
      ).not.toThrow();
      expect(api).not.toBeNull();
    });
  });

  describe('colapso persistido', () => {
    it('isSidebarCollapsed falso por padrão', () => {
      expect(isSidebarCollapsed(storage)).toBe(false);
    });

    it('setSidebarCollapsed(true) persiste e restaura', () => {
      setSidebarCollapsed(true, storage);
      expect(isSidebarCollapsed(storage)).toBe(true);
      expect(storage.getItem(SIDEBAR_STORAGE_KEY)).toBe('1');
    });

    it('lê apenas "1" como colapsado', () => {
      storage.setItem(SIDEBAR_STORAGE_KEY, '0');
      expect(isSidebarCollapsed(storage)).toBe(false);
    });

    it('não lança quando storage indisponível', () => {
      expect(() =>
        setSidebarCollapsed(true, {
          getItem() {
            throw new Error('x');
          },
          setItem() {
            throw new Error('y');
          },
        }),
      ).not.toThrow();
      expect(
        isSidebarCollapsed({
          getItem() {
            throw new Error('x');
          },
        }),
      ).toBe(false);
    });
  });

  describe('toggle recolhe/expande a sidebar', () => {
    let container;

    function buildContainer() {
      const element = document.createElement('div');
      element.innerHTML = `
        <aside id="sidebar" class="sidebar"></aside>
        <button id="sidebar-toggle" type="button" class="sidebar-toggle" data-sidebar-toggle></button>
      `;
      return element;
    }

    beforeEach(() => {
      globalThis.localStorage = fakeStorage();
      globalThis.matchMedia = () => ({ matches: false });
      container = buildContainer();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      delete globalThis.localStorage;
      delete globalThis.matchMedia;
    });

    it('inverte de expandido para colapsado ao clicar', () => {
      const api = setupSidebar({ container, handlers: {} });
      const sidebar = container.querySelector('#sidebar');
      expect(sidebar.classList.contains('is-collapsed')).toBe(false);
      container.querySelector('#sidebar-toggle').click();
      expect(sidebar.classList.contains('is-collapsed')).toBe(true);
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('1');
      expect(api).not.toBeNull();
    });

    it('inverte de colapsado para expandido ao clicar novamente', () => {
      setupSidebar({ container, handlers: {} });
      const sidebar = container.querySelector('#sidebar');
      container.querySelector('#sidebar-toggle').click();
      container.querySelector('#sidebar-toggle').click();
      expect(sidebar.classList.contains('is-collapsed')).toBe(false);
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('0');
    });

    it('inicia colapsado quando viewport compacto sem preferência salva', () => {
      globalThis.matchMedia = () => ({ matches: true });
      setupSidebar({ container, handlers: {} });
      const sidebar = container.querySelector('#sidebar');
      expect(sidebar.classList.contains('is-collapsed')).toBe(true);
    });

    it('respeita preferência salva mesmo em viewport compacto', () => {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, '0');
      globalThis.matchMedia = () => ({ matches: true });
      setupSidebar({ container, handlers: {} });
      const sidebar = container.querySelector('#sidebar');
      expect(sidebar.classList.contains('is-collapsed')).toBe(false);
    });
  });

  describe('getManualUrl', () => {
    it('retorna o manual pt-BR por padrão', () => {
      expect(getManualUrl('pt-BR')).toBe('manual/markdown-manual.md');
    });

    it('retorna o manual em inglês para a locale en', () => {
      expect(getManualUrl('en')).toBe('manual/markdown-manual-en.md');
    });

    it('usa a locale corrente quando chamado sem argumento', () => {
      setLocale('en');
      expect(getManualUrl()).toBe('manual/markdown-manual-en.md');
      setLocale('pt-BR');
      expect(getManualUrl()).toBe('manual/markdown-manual.md');
    });
  });

  describe('renderManual', () => {
    let realDocument;

    beforeEach(() => {
      realDocument = globalThis.document;
      globalThis.document = { querySelector: () => null };
    });

    afterEach(() => {
      globalThis.document = realDocument;
    });

    it('renderiza manual via convert e injeta no alvo', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => '# Título\n\n```mermaid\ngraph TD\n  A-->B\n```',
      });
      const target = { innerHTML: '' };
      const base = {
        querySelector: () => target,
      };
      const el = await renderManual(base);
      expect(el).toBe(target);
      expect(target.innerHTML).toContain('Título');
      expect(convert('# Título')).toContain('Título');
      globalThis.fetch.mockRestore?.();
    });

    it('rejeita quando fetch falha', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404 });
      const target = { innerHTML: '' };
      await expect(renderManual({ querySelector: () => target })).rejects.toThrow();
      globalThis.fetch.mockRestore?.();
    });
  });

  describe('openFileDialog', () => {
    it('usa File System Access quando suportado', async () => {
      const handle = {
        name: 'nota.md',
        getFile: () => Promise.resolve({ text: async () => '# conteúdo' }),
      };
      globalThis.window = {
        showOpenFilePicker: vi.fn().mockResolvedValue([handle]),
      };
      const onContent = vi.fn();
      const onHandle = vi.fn();
      await openFileDialog({ openPicker: () => true, onHandle }, { onContent });
      expect(globalThis.window.showOpenFilePicker).toHaveBeenCalled();
      expect(onContent).toHaveBeenCalledWith('# conteúdo');
      expect(onHandle).toHaveBeenCalledWith(handle);
    });

    it('aciona onError quando picker falha', async () => {
      globalThis.window = {
        showOpenFilePicker: vi.fn().mockRejectedValue(new Error('negado')),
      };
      const onError = vi.fn();
      await openFileDialog({ openPicker: () => true }, { onError });
      expect(onError).toHaveBeenCalled();
    });

    it('cai para input de arquivo legado quando não há picker (Safari/Firefox)', async () => {
      const file = { name: 'a.md', text: async () => '# texto' };
      const onContent = vi.fn();
      const onStatus = vi.fn();
      const originalDocument = globalThis.document;
      let changeHandler;
      globalThis.document = {
        createElement: (tag) => {
          if (tag !== 'input') {
            return {};
          }
          const el = {
            type: '',
            accept: '',
            files: [],
            addEventListener: vi.fn((type, fn) => {
              if (type === 'change') {
                changeHandler = fn;
              }
            }),
            click: vi.fn(() => {
              el.files = [file];
              changeHandler?.();
            }),
            remove: vi.fn(),
          };
          return el;
        },
        body: { appendChild: vi.fn() },
      };
      await openFileDialog({ openPicker: () => false }, { onContent, onStatus });
      await new Promise((r) => setTimeout(r, 0));
      expect(onContent).toHaveBeenCalledWith('# texto');
      expect(onStatus).toHaveBeenCalledWith(t('filePickerFallback'));
      globalThis.document = originalDocument;
    });
  });

  describe('saveFileDialog', () => {
    it('salva via handle atual quando gravável', async () => {
      const writable = { write: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue() };
      const handle = { name: 'a.md', createWritable: vi.fn().mockResolvedValue(writable) };
      const onSaved = vi.fn();
      await saveFileDialog(
        '# conteúdo',
        { currentHandle: handle, canWrite: () => true },
        { onSaved },
      );
      expect(handle.createWritable).toHaveBeenCalled();
      expect(writable.write).toHaveBeenCalledWith('# conteúdo');
      expect(onSaved).toHaveBeenCalledWith('a.md');
    });

    it('aborta (AbortError) sem erro', async () => {
      const writable = { write: vi.fn().mockRejectedValue({ name: 'AbortError' }), close: vi.fn() };
      const handle = { name: 'a.md', createWritable: vi.fn().mockResolvedValue(writable) };
      const onSaved = vi.fn();
      const onError = vi.fn();
      await saveFileDialog(
        'x',
        { currentHandle: handle, canWrite: () => true },
        { onSaved, onError },
      );
      expect(onError).not.toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('cai para fallback de download quando sem suporte', async () => {
      const originalURL = globalThis.URL;
      const originalBlob = globalThis.Blob;
      const revoke = vi.fn();
      globalThis.URL = {
        createObjectURL: () => 'blob:fake',
        revokeObjectURL: revoke,
      };
      globalThis.Blob = class {};
      delete globalThis.document;
      globalThis.document = {
        createElement: () => {
          const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
          return anchor;
        },
        body: { appendChild: vi.fn() },
      };
      const onSaved = vi.fn();
      await saveFileDialog('# conteúdo', { openSavePicker: () => false }, { onSaved });
      expect(onSaved).toHaveBeenCalledWith('documento.md');
      globalThis.URL = originalURL;
      globalThis.Blob = originalBlob;
    });

    it('erro não-abortável do createWritable cai no fallback de download', async () => {
      const writable = {
        write: vi.fn().mockRejectedValue(new Error('disk-full')),
        close: vi.fn(),
      };
      const handle = { name: 'a.md', createWritable: vi.fn().mockResolvedValue(writable) };
      const originalURL = globalThis.URL;
      const originalBlob = globalThis.Blob;
      const originalDocument = globalThis.document;
      globalThis.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: vi.fn() };
      globalThis.Blob = class {};
      delete globalThis.document;
      globalThis.document = {
        createElement: () => {
          const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
          return anchor;
        },
        body: { appendChild: vi.fn() },
      };
      const onSaved = vi.fn();
      await saveFileDialog(
        '# conteúdo',
        { currentHandle: handle, canWrite: () => true, openSavePicker: () => false },
        { onSaved },
      );
      expect(handle.createWritable).toHaveBeenCalled();
      expect(writable.write).toHaveBeenCalledWith('# conteúdo');
      expect(onSaved).toHaveBeenCalledWith('documento.md');
      globalThis.URL = originalURL;
      globalThis.Blob = originalBlob;
      globalThis.document = originalDocument;
    });
  });
});
