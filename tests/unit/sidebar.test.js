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
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      writable: true,
      configurable: true,
    });
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
      Object.defineProperty(globalThis, 'localStorage', {
        value: fakeStorage(),
        writable: true,
        configurable: true,
      });
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
      Object.defineProperty(globalThis, 'localStorage', {
        value: fakeStorage(),
        writable: true,
        configurable: true,
      });
      globalThis.matchMedia = () => ({ matches: false });
      container = buildContainer();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      Object.defineProperty(globalThis, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true,
      });
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
      Object.defineProperty(globalThis, 'document', {
        value: { querySelector: () => null },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'document', {
        value: realDocument,
        writable: true,
        configurable: true,
      });
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

    it('cancelamento do usuário (AbortError) não vira erro (B5)', async () => {
      globalThis.window = {
        showOpenFilePicker: vi.fn().mockRejectedValue({ name: 'AbortError' }),
      };
      const onError = vi.fn();
      await openFileDialog({ openPicker: () => true }, { onError });
      expect(onError).not.toHaveBeenCalled();
    });

    it('cai para input de arquivo legado quando não há picker (Safari/Firefox)', async () => {
      const file = { name: 'a.md', text: async () => '# texto' };
      const onContent = vi.fn();
      const onStatus = vi.fn();
      const originalDocument = globalThis.document;
      let changeHandler;
      Object.defineProperty(globalThis, 'document', {
        value: {
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
        },
        writable: true,
        configurable: true,
      });
      await openFileDialog({ openPicker: () => false }, { onContent, onStatus });
      await new Promise((r) => setTimeout(r, 0));
      expect(onContent).toHaveBeenCalledWith('# texto');
      expect(onStatus).toHaveBeenCalledWith(t('filePickerFallback'));
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        writable: true,
        configurable: true,
      });
    });

    it('mantém o input no DOM após click e remove só no cancel (B4)', async () => {
      const originalDocument = globalThis.document;
      let cancelHandler;
      const el = {
        type: '',
        accept: '',
        files: [],
        style: {},
        addEventListener: vi.fn((type, fn) => {
          if (type === 'cancel') {
            cancelHandler = fn;
          }
        }),
        click: vi.fn(),
        remove: vi.fn(),
      };
      Object.defineProperty(globalThis, 'document', {
        value: {
          createElement: () => el,
          body: { appendChild: vi.fn() },
        },
        writable: true,
        configurable: true,
      });
      await openFileDialog({ openPicker: () => false }, {});
      expect(el.click).toHaveBeenCalled();
      expect(el.remove).not.toHaveBeenCalled();
      cancelHandler?.();
      expect(el.remove).toHaveBeenCalledTimes(1);
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        writable: true,
        configurable: true,
      });
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
      const originalDocument = globalThis.document;
      const revoke = vi.fn();
      globalThis.URL = {
        createObjectURL: () => 'blob:fake',
        revokeObjectURL: revoke,
      };
      globalThis.Blob = class {};
      Object.defineProperty(globalThis, 'document', {
        value: {
          createElement: () => {
            const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
            return anchor;
          },
          body: { appendChild: vi.fn() },
        },
        writable: true,
        configurable: true,
      });
      const onSaved = vi.fn();
      await saveFileDialog('# conteúdo', { openSavePicker: () => false }, { onSaved });
      expect(onSaved).toHaveBeenCalledWith('documento.md');
      globalThis.URL = originalURL;
      globalThis.Blob = originalBlob;
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        writable: true,
        configurable: true,
      });
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
      Object.defineProperty(globalThis, 'document', {
        value: {
          createElement: () => {
            const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
            return anchor;
          },
          body: { appendChild: vi.fn() },
        },
        writable: true,
        configurable: true,
      });
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
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        writable: true,
        configurable: true,
      });
    });
  });
});

describe('M9 — handle de arquivo amarrado ao documento ativo', () => {
  let container;
  let editor;
  let value;
  let activeDoc;
  let statuses;
  let writeOriginal;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: fakeStorage(),
      writable: true,
      configurable: true,
    });
    container = document.createElement('div');
    container.innerHTML = `
      <aside id="sidebar" class="sidebar"></aside>
      <nav id="sidebar-nav">
        <button type="button" class="sidebar-item" data-sidebar-action="open"></button>
        <button type="button" class="sidebar-item" data-sidebar-action="save"></button>
      </nav>
    `;
    value = '';
    editor = {
      getValue: () => value,
      setValue: vi.fn((next) => {
        value = next;
      }),
    };
    activeDoc = { id: 'doc-a', title: 'Documento A' };
    statuses = [];
    writeOriginal = vi.fn();
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });

  afterEach(() => {
    delete window.showOpenFilePicker;
    delete window.showSaveFilePicker;
    delete window.isSecureContext;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function mountSidebar() {
    setupSidebar({
      container,
      editor,
      getContent: () => editor.getValue(),
      getActiveDoc: () => activeDoc,
      onStatus: (message) => statuses.push(message),
      handlers: {},
    });
  }

  async function openFile(name) {
    const handle = {
      name,
      getFile: async () => ({ text: async () => `# conteúdo de ${name}` }),
      createWritable: async () => ({ write: writeOriginal, close: vi.fn() }),
    };
    window.showOpenFilePicker = vi.fn(async () => [handle]);
    container.querySelector('[data-sidebar-action="open"]').click();
    await vi.waitFor(() => expect(window.showOpenFilePicker).toHaveBeenCalled());
    await vi.waitFor(() => expect(value).toBe(`# conteúdo de ${name}`));
    return handle;
  }

  function stubSavePicker() {
    const writePicked = vi.fn();
    window.showSaveFilePicker = vi.fn(async ({ suggestedName }) => ({
      name: suggestedName,
      createWritable: async () => ({ write: writePicked, close: vi.fn() }),
    }));
    return writePicked;
  }

  it('não sobrescreve o arquivo aberto depois de trocar de documento', async () => {
    mountSidebar();
    await openFile('notas.md');

    // o usuário troca para outro documento e digita nele
    activeDoc = { id: 'doc-b', title: 'Documento B' };
    value = '# conteúdo do documento B';

    const writePicked = stubSavePicker();
    container.querySelector('[data-sidebar-action="save"]').click();
    await vi.waitFor(() => expect(writePicked).toHaveBeenCalledTimes(1));

    // notas.md permanece intacto
    expect(writeOriginal).not.toHaveBeenCalled();
    expect(writePicked).toHaveBeenCalledWith('# conteúdo do documento B');
    // e o picker sugere o documento corrente, não o nome de outro arquivo
    // (`toMarkdownName` é quem acrescenta a extensão)
    expect(window.showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'Documento B.md' }),
    );
  });

  it('continua sobrescrevendo quando o handle pertence ao documento ativo', async () => {
    mountSidebar();
    await openFile('notas.md');

    value = '# notas editadas';
    container.querySelector('[data-sidebar-action="save"]').click();
    await vi.waitFor(() => expect(writeOriginal).toHaveBeenCalledTimes(1));

    expect(writeOriginal).toHaveBeenCalledWith('# notas editadas');
    // não caiu no caminho de "salvar como"
    expect(window.showSaveFilePicker).toBeUndefined();
    expect(statuses.at(-1)).toBe(t('fileSaved').replace('{name}', 'notas.md'));
  });

  it('voltar ao documento de origem reabilita a sobrescrita', async () => {
    mountSidebar();
    await openFile('notas.md');

    activeDoc = { id: 'doc-b', title: 'Documento B' };
    const writePicked = stubSavePicker();
    container.querySelector('[data-sidebar-action="save"]').click();
    await vi.waitFor(() => expect(writePicked).toHaveBeenCalledTimes(1));
    expect(writeOriginal).not.toHaveBeenCalled();

    activeDoc = { id: 'doc-a', title: 'Documento A' };
    container.querySelector('[data-sidebar-action="save"]').click();
    await vi.waitFor(() => expect(writeOriginal).toHaveBeenCalledTimes(1));
    expect(writeOriginal).toHaveBeenCalledWith('# conteúdo de notas.md');
  });
});

describe('ações da sidebar ainda sem cobertura', () => {
  let container;
  let statuses;

  function setup(handlers = {}) {
    const statusesRef = statuses;
    return setupSidebar({
      container,
      editor: { getValue: () => '# x', setValue: vi.fn(), revealPosition: vi.fn() },
      getContent: () => '# x',
      handlers,
      onStatus: (message) => statusesRef.push(message),
    });
  }

  beforeEach(() => {
    statuses = [];
    Object.defineProperty(globalThis, 'localStorage', {
      value: fakeStorage(),
      writable: true,
      configurable: true,
    });
    container = document.createElement('div');
    container.innerHTML = `
      <aside id="sidebar" class="sidebar"></aside>
      <nav id="sidebar-nav">
        <button type="button" data-sidebar-action="manual"></button>
        <button type="button" data-sidebar-action="print"></button>
        <button type="button" data-sidebar-action="save"></button>
        <button type="button" data-sidebar-action="desconhecida"></button>
      </nav>
      <dialog id="manual-dialog"><button id="manual-close" type="button"></button></dialog>
      <div id="sidebar-status"></div>
    `;
    document.body.appendChild(container);
    document.body.insertAdjacentHTML('beforeend', '<div id="manual-content"></div>');
  });

  afterEach(() => {
    container.remove();
    document.getElementById('manual-content')?.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearManualCache();
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('print chama window.print', () => {
    const print = vi.fn();
    Object.defineProperty(window, 'print', { value: print, configurable: true, writable: true });
    setup();
    container.querySelector('[data-sidebar-action="print"]').click();
    expect(print).toHaveBeenCalledTimes(1);
    expect(statuses).not.toContain(t('printError'));
  });

  it('quando window.print lança, reporta printError', () => {
    Object.defineProperty(window, 'print', {
      value: () => {
        throw new Error('bloqueado');
      },
      configurable: true,
      writable: true,
    });
    setup();
    container.querySelector('[data-sidebar-action="print"]').click();
    expect(statuses).toContain(t('printError'));
  });

  it('manual abre o diálogo, renderiza o corpo e o fecha pelo botão', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => '# Manual\n\nseção' })),
    );
    setup();
    container.querySelector('[data-sidebar-action="manual"]').click();

    const dialog = container.querySelector('#manual-dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
    await vi.waitFor(() =>
      expect(document.querySelector('#manual-content').innerHTML).toContain('Manual'),
    );

    container.querySelector('#manual-close').click();
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('manual com o fetch fora do ar reporta fileError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    setup();
    container.querySelector('[data-sidebar-action="manual"]').click();
    await vi.waitFor(() => expect(statuses).toContain(t('fileError')));
  });

  it('openManual da API abre o mesmo diálogo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => '# Manual' })),
    );
    const api = setup();
    api.openManual();
    expect(container.querySelector('#manual-dialog').hasAttribute('open')).toBe(true);
    expect(api.getCurrentName()).toBe('documento.md');
    expect(api.getState()).toEqual({ collapsed: false });
    expect(api.getState().collapsed).toBe(false);
  });

  it('setupSidebar devolve null sem container e sem #sidebar', () => {
    expect(setupSidebar({ container: null })).toBeNull();
    expect(setupSidebar({ container: document.createElement('div') })).toBeNull();
  });

  it('localStorage lançando não derruba a montagem (collapsed cai para false)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('modo privado');
        },
        setItem: () => {},
        clear: () => {},
      },
      writable: true,
      configurable: true,
    });
    const api = setup();
    expect(api).not.toBeNull();
    expect(container.querySelector('#sidebar').classList.contains('is-collapsed')).toBe(false);
  });

  it('botão sem data-sidebar-action não registra handler', () => {
    const bare = document.createElement('div');
    bare.innerHTML =
      '<aside id="sidebar"></aside><button type="button" data-sidebar-action></button>';
    const api = setupSidebar({ container: bare, editor: {}, handlers: {} });
    expect(api).not.toBeNull();
    expect(() => bare.querySelector('button').click()).not.toThrow();
  });

  it('save reporta saveError quando o picker falha fora de cancelamento', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });
    // `supportsOpenPicker()` olha `isSecureContext` + `showOpenFilePicker`;
    // sem os dois o save cai no download e nunca reporta saveError.
    Object.defineProperty(window, 'showOpenFilePicker', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: vi.fn(async () => {
        throw new Error('sem permissão');
      }),
      configurable: true,
      writable: true,
    });
    setup();
    container.querySelector('[data-sidebar-action="save"]').click();
    await vi.waitFor(() => expect(statuses).toContain(t('saveError')));
    delete window.showSaveFilePicker;
    delete window.showOpenFilePicker;
    delete window.isSecureContext;
  });
});
