import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Efeito colateral: registra o listener de `load` que chama `init()`.
import '../../src/main.js';
import { t, getDefaultTemplate } from '../../src/i18n/index.js';

/**
 * F3: `init()` (src/main.js) era o único caminho de boot sem cobertura nenhuma —
 * 480 linhas que ligam storage → Monaco → preview → sidebar → atalhos e que só
 * rodavam de verdade no navegador. Este teste dispara o mesmo `load` que o
 * main.js escuta e valida o contrato de boot: o editor recebe o input correto,
 * o preview renderiza e a barra de status monta.
 */

const monacoState = vi.hoisted(() => {
  const state = {
    value: '',
    createCalls: 0,
    setThemeCalls: [],
    // O Monaco real dispara `onDidChangeModelContent` em `setValue` — é esse
    // gatilho que faz o boot renderizar o preview. Sem ele o mock mente.
    contentListener: null,
    editor: null,
    // A1: permite simular a rejeição do `setupEditor()` (chunk Monaco 404).
    createError: null,
  };
  state.editor = {
    getValue: () => state.value,
    setValue: vi.fn((next) => {
      state.value = next ?? '';
      state.contentListener?.();
    }),
    revealPosition: vi.fn(),
    focus: vi.fn(),
    onDidChangeModelContent: vi.fn((cb) => {
      state.contentListener = cb;
      return { dispose: () => {} };
    }),
    // Captura o callback para o teste poder disparar o scroll do editor.
    onDidScrollChange: vi.fn((cb) => {
      state.scrollListener = cb;
      return { dispose() {} };
    }),
    getLayoutInfo: () => ({ height: 400 }),
  };
  return state;
});

// M3: permite fazer `convert()` lançar para provar que o loop de render não morre.
const convertState = vi.hoisted(() => ({ shouldThrow: false }));

vi.mock('../../src/render/convert.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    convert: (markdown) => {
      if (convertState.shouldThrow) {
        throw new Error('marked estourou neste documento');
      }
      return actual.convert(markdown);
    },
  };
});

vi.mock('../../src/ui/workers/monacoSetup.js', () => ({
  monaco: {
    editor: {
      create: vi.fn(() => {
        monacoState.createCalls += 1;
        if (monacoState.createError) {
          throw monacoState.createError;
        }
        monacoState.value = '';
        monacoState.editor.setValue.mockClear();
        return monacoState.editor;
      }),
      setTheme: vi.fn((theme) => monacoState.setThemeCalls.push(theme)),
    },
  },
}));

const NAMESPACE = 'com.markdownstudio';
const LAST_STATE_KEY = `${NAMESPACE}.last_state`;
const THEME_KEY = `${NAMESPACE}.theme_settings`;

let bodyHtml = '';

beforeAll(() => {
  // jsdom não implementa matchMedia — o dividor de colunas consulta a media
  // query de layout responsivo durante o boot.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    });
  }

  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const open = html.indexOf('<body');
  bodyHtml = html.slice(html.indexOf('>', open) + 1, html.indexOf('</body>'));
  expect(bodyHtml).toContain('id="editor"');

  // jsdom não implementa `Element#scrollTo`, e `scrollTop()` (reset/new) chama
  // `el.scrollTo({ top: 0 })` em cada `.column` — sem o polyfill a exceção
  // escapa do listener de clique e o Vitest reporta unhandled error.
  if (typeof window.Element.prototype.scrollTo !== 'function') {
    window.Element.prototype.scrollTo = function scrollTo() {};
  }
});

function seedEntry(value) {
  return JSON.stringify({ value, expiresAt: Date.now() + 60_000 });
}

async function boot({ seed, dark = false } = {}) {
  localStorage.clear();
  if (seed) {
    localStorage.setItem(LAST_STATE_KEY, seedEntry(seed));
  }
  localStorage.setItem(THEME_KEY, seedEntry(dark));
  document.body.innerHTML = bodyHtml;
  const before = monacoState.createCalls;
  window.dispatchEvent(new Event('load'));

  await vi.waitFor(() => expect(monacoState.createCalls).toBe(before + 1), { timeout: 4000 });
  // `setupEditor().then()` encadeia o boot assíncrono; o convert tem debounce de
  // 80ms — espera folgada para o preview renderizar.
  await vi.waitFor(() => expect(monacoState.editor.setValue).toHaveBeenCalled(), {
    timeout: 4000,
  });
  await new Promise((r) => setTimeout(r, 400));
  return monacoState.editor.setValue.mock.calls.at(-1)[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('boot do aplicativo (load → init)', () => {
  it('alimenta o editor com o template padrão quando o storage está vazio', async () => {
    const value = await boot();

    expect(value).toBeTruthy();
    expect(value.length).toBeGreaterThan(100);
    expect(value).toMatch(/^#{1,3} /m);
    expect(monacoState.editor.revealPosition).toHaveBeenCalledWith({
      lineNumber: 1,
      column: 1,
    });
  });

  it('renderiza o preview no #output', async () => {
    await boot();

    const output = document.querySelector('#output');
    expect(output).toBeTruthy();
    expect(output.innerHTML.trim().length).toBeGreaterThan(0);
    expect(output.querySelector('h1, h2, p')).toBeTruthy();
  });

  it('monta a barra de status com estatísticas', async () => {
    await boot();

    const stats = document.querySelector('#status-stats');
    expect(stats).toBeTruthy();
    expect(stats.textContent.trim().length).toBeGreaterThan(0);
  });

  it('liga as ações da sidebar (lista de documentos e botão novo)', async () => {
    await boot();

    expect(document.querySelector('#doc-new-btn')).toBeTruthy();
    expect(document.querySelector('#document-list')).toBeTruthy();
    // o boot semeia um documento ativo
    expect(document.querySelectorAll('.doc-item').length).toBeGreaterThan(0);
  });

  it('restaura o conteúdo persistido em last_state em vez do template', async () => {
    const restored = '# Restaurado do last_state';
    const value = await boot({ seed: restored });

    expect(value).toBe(restored);
    expect(document.querySelector('#output').textContent).toContain('Restaurado do last_state');
  });

  it('inicializa o tema a partir do storage e ressincroniza a chave anti-FOUC', async () => {
    await boot({ dark: true });

    expect(document.querySelector('#theme-checkbox').checked).toBe(true);
    expect(localStorage.getItem('com.markdownstudio_theme')).toBe('dark');
    expect(monacoState.setThemeCalls).toContain('vs-dark');
  });

  it('mantém o tema claro por padrão e grava a chave anti-FOUC correspondente', async () => {
    await boot({ dark: false });

    expect(document.querySelector('#theme-checkbox').checked).toBe(false);
    expect(localStorage.getItem('com.markdownstudio_theme')).toBe('light');
  });

  it('não propaga erro no boot (cadeia setupEditor().then sem catch)', async () => {
    const errors = [];
    const onError = (e) => errors.push(e);
    const onRejection = (e) => errors.push(e.reason ?? e);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    try {
      await boot();
      // drena microtasks e o debounce do convert/mermaid
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    }

    expect(errors).toEqual([]);
  });
});

describe('hardening de boot (A1–A4)', () => {
  it('A1: rejeição do setupEditor() vira mensagem no status, não unhandledrejection', async () => {
    monacoState.createError = new Error('chunk do Monaco 404');
    const rejections = [];
    const onRejection = (e) => rejections.push(e.reason ?? e);
    window.addEventListener('unhandledrejection', onRejection);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      document.body.innerHTML = bodyHtml;
      const before = monacoState.createCalls;
      window.dispatchEvent(new Event('load'));

      await vi.waitFor(() => expect(monacoState.createCalls).toBe(before + 1), { timeout: 4000 });
      await vi.waitFor(
        () => {
          expect(document.querySelector('#sidebar-status').textContent).toBe(t('bootFailed'));
        },
        { timeout: 4000 },
      );
      expect(rejections).toEqual([]);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      window.removeEventListener('unhandledrejection', onRejection);
      consoleError.mockRestore();
      monacoState.createError = null;
    }
  });

  it('A2: quota cheia no createDocument do boot não aborta o boot', async () => {
    const real = globalThis.localStorage;
    const failing = new Proxy(real, {
      get(target, prop) {
        if (prop === 'setItem') {
          return (key, value) => {
            if (String(key).includes(`${NAMESPACE}.documents`)) {
              const err = new Error('quota cheia');
              err.name = 'QuotaExceededError';
              throw err;
            }
            return target.setItem(key, value);
          };
        }
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: failing });

    try {
      const restored = '# Conteúdo restaurado';
      const value = await boot({ seed: restored });

      // o `.then` inteiro sobreviveu: editor, preview e status bar montam
      expect(value).toBe(restored);
      expect(document.querySelector('#output').textContent).toContain('Conteúdo restaurado');
      expect(document.querySelector('#status-stats').textContent.trim()).not.toBe('');
      expect(document.querySelector('#sidebar-status').textContent).toBe(t('quotaExceeded'));
      // o conteúdo segue no last_state → próximo boot tenta de novo
      expect(JSON.parse(localStorage.getItem(LAST_STATE_KEY)).value).toBe(restored);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real });
    }
  });

  it('A4: pagehide grava a edição pendente na hora, sem esperar o debounce de 300ms', async () => {
    await boot();

    monacoState.value = '# edição de uma aba fechada abruptamente';
    monacoState.contentListener();
    // sem nenhuma espera: o handler é síncrono e roda antes do timer de 300ms
    window.dispatchEvent(new Event('pagehide'));

    const stored = JSON.parse(localStorage.getItem(LAST_STATE_KEY)).value;
    expect(stored).toBe('# edição de uma aba fechada abruptamente');

    // `pendingSave` foi limpo: um segundo pagehide não regrava
    localStorage.setItem(LAST_STATE_KEY, seedEntry('marcador'));
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.parse(localStorage.getItem(LAST_STATE_KEY)).value).toBe('marcador');
  });

  it('A4: o listener de pagehide continua gravando após o segundo boot', async () => {
    await boot();
    await boot();

    monacoState.value = '# segunda sessão';
    monacoState.contentListener();
    window.dispatchEvent(new Event('pagehide'));

    expect(JSON.parse(localStorage.getItem(LAST_STATE_KEY)).value).toBe('# segunda sessão');
  });

  it('M3: falha no convert mantém o preview anterior e sinaliza no status', async () => {
    await boot();
    const beforeHtml = document.querySelector('#output').innerHTML;
    expect(beforeHtml).toBeTruthy();

    const errors = [];
    const onError = (e) => errors.push(e);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('error', onError);
    convertState.shouldThrow = true;

    try {
      monacoState.value = '# conteúdo que não renderiza';
      monacoState.contentListener();

      await vi.waitFor(
        () => {
          expect(document.querySelector('#sidebar-status').textContent).toBe(t('renderFailed'));
        },
        { timeout: 3000 },
      );
      // o HTML válido anterior permanece — nada é injetado quando o sanitizer lança
      expect(document.querySelector('#output').innerHTML).toBe(beforeHtml);
      expect(errors).toEqual([]);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      convertState.shouldThrow = false;
      window.removeEventListener('error', onError);
      consoleError.mockRestore();
    }
  });

  it('L4: falha ao gravar tema/rolagem vira mensagem no status e não aborta o handler', async () => {
    await boot({ dark: false });
    const status = document.querySelector('#sidebar-status');
    const theme = document.querySelector('#theme-checkbox');
    const scroll = document.querySelector('#sync-scroll-checkbox');
    expect(theme).toBeTruthy();
    expect(scroll).toBeTruthy();

    const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const broken = {
      getItem: () => null,
      setItem: () => {
        const err = new Error('quota cheia');
        err.name = 'QuotaExceededError';
        throw err;
      },
      removeItem: () => {},
      clear: () => {},
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: broken });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      theme.checked = !theme.checked;
      theme.dispatchEvent(new Event('change', { bubbles: true }));
      expect(status.textContent).toBe(t('quotaExceeded'));
      // O guard não abortou o resto do handler: o Monaco ainda recebeu o tema
      // novo, que é a última coisa que o `change` faz.
      await vi.waitFor(() => expect(monacoState.setThemeCalls.at(-1)).toBe('vs-dark'), {
        timeout: 2000,
      });

      status.textContent = '';
      scroll.checked = !scroll.checked;
      scroll.dispatchEvent(new Event('change', { bubbles: true }));
      expect(status.textContent).toBe(t('quotaExceeded'));
    } finally {
      consoleError.mockRestore();
      Object.defineProperty(globalThis, 'localStorage', real);
    }
  });
});

describe('ações da sidebar (handlers montados em main.js)', () => {
  const statusText = () => document.querySelector('#sidebar-status')?.textContent ?? '';

  function clickAction(action) {
    const btn = document.querySelector(`[data-sidebar-action="${action}"]`);
    expect(btn, `botão [data-sidebar-action="${action}"] ausente`).toBeTruthy();
    btn.click();
  }

  it('reset devolve o template e grava o documento ativo (reload não ressuscita o antigo)', async () => {
    await boot();
    monacoState.value = '# conteúdo que será descartado';
    monacoState.contentListener();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      clickAction('reset');

      expect(window.confirm).toHaveBeenCalledWith(t('resetConfirm'));
      expect(monacoState.value).toBe(getDefaultTemplate());

      const index = JSON.parse(localStorage.getItem(`${NAMESPACE}.documents`)).value;
      const contentKey = `${NAMESPACE}.documents.content.${index.activeId}`;
      expect(JSON.parse(localStorage.getItem(contentKey)).value).toBe(getDefaultTemplate());
    } finally {
      window.confirm.mockRestore();
    }
  });

  it('reset recusado pelo usuário não toca no editor', async () => {
    await boot();
    monacoState.value = '# conteúdo preservado';
    monacoState.contentListener();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      clickAction('reset');
      expect(monacoState.value).toBe('# conteúdo preservado');
    } finally {
      window.confirm.mockRestore();
    }
  });

  it('new cria um novo documento isolado sem confirm (D3 — não limpa o ativo)', async () => {
    await boot();
    monacoState.value = '# conteúdo preservado';
    monacoState.contentListener();
    const confirmSpy = vi.spyOn(window, 'confirm');
    try {
      clickAction('new');

      expect(confirmSpy).not.toHaveBeenCalled();
      // novo documento vazio no editor
      expect(monacoState.value).toBe('');

      const index = JSON.parse(localStorage.getItem(`${NAMESPACE}.documents`)).value;
      expect(index.documents).toHaveLength(2);
      // o conteúdo do documento anterior continua persistido (nada foi perdido)
      const anterior = index.documents.find((d) => d.id !== index.activeId);
      const contentKey = `${NAMESPACE}.documents.content.${anterior.id}`;
      expect(JSON.parse(localStorage.getItem(contentKey)).value).toBe('# conteúdo preservado');
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('copy escreve o conteúdo no clipboard e reporta "Copiado!"', async () => {
    await boot();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    clickAction('copy');
    await vi.waitFor(() => expect(statusText()).toBe(t('copied')));
    expect(writeText).toHaveBeenCalledWith(monacoState.value);
  });

  it('copy sem clipboard reporta copyError (nunca anuncia sucesso)', async () => {
    await boot();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    clickAction('copy');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(statusText()).not.toBe(t('copied'));
    // D11: a falha de clipboard é anunciada, como no copyHtml.
    expect(statusText()).toBe(t('copyError'));
  });

  it('copyHtml usa o canal plain e reporta "HTML copiado!"', async () => {
    await boot();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    clickAction('copyHtml');
    await vi.waitFor(() => expect(statusText()).toBe(t('copiedHtml')));
    expect(writeText).toHaveBeenCalled();
  });

  it('copyHtml sem clipboard reporta copyError', async () => {
    await boot();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    clickAction('copyHtml');
    await vi.waitFor(() => expect(statusText()).toBe(t('copyError')));
  });

  it('exportHtml monta o arquivo e reporta htmlExported com o nome', async () => {
    await boot();
    const hadCreate = 'createObjectURL' in URL;
    const hadRevoke = 'revokeObjectURL' in URL;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:fake';
    URL.revokeObjectURL = () => {};
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      clickAction('exportHtml');
      const prefix = t('htmlExported').split('{name}')[0];
      await vi.waitFor(() => expect(statusText().startsWith(prefix)).toBe(true));
      expect(statusText()).toContain('.html');
      expect(statusText()).not.toBe(t('exportHtmlError'));
    } finally {
      fetchSpy.mockRestore();
      if (hadCreate) URL.createObjectURL = originalCreate;
      else delete URL.createObjectURL;
      if (hadRevoke) URL.revokeObjectURL = originalRevoke;
      else delete URL.revokeObjectURL;
    }
  });

  it('exportHtml reporta exportHtmlError quando o download falha', async () => {
    await boot();
    const hadCreate = 'createObjectURL' in URL;
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = () => {
      throw new Error('bloqueado');
    };
    try {
      clickAction('exportHtml');
      await vi.waitFor(() => expect(statusText()).toBe(t('exportHtmlError')));
    } finally {
      if (hadCreate) URL.createObjectURL = originalCreate;
      else delete URL.createObjectURL;
    }
  });

  it.each([
    ['printSettings', 'print-settings-dialog'],
    ['toc', 'toc-dialog'],
    ['snapshots', 'snapshots-dialog'],
  ])('%s abre o diálogo %s', async (action, dialogId) => {
    await boot();
    clickAction(action);
    const dialog = document.getElementById(dialogId);
    expect(dialog, `#${dialogId} ausente`).toBeTruthy();
    expect(dialog.hasAttribute('open') || dialog.open).toBe(true);
  });

  it('com o sync de rolagem ligado, o scroll do editor propaga para o preview', async () => {
    await boot();
    const box = document.querySelector('#sync-scroll-checkbox');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));

    const preview = document.querySelector('#preview');
    const scrollTo = vi.fn();
    preview.scrollTo = scrollTo;
    monacoState.scrollListener({ scrollTop: 120, scrollHeight: 900, height: 400 });
    expect(scrollTo).toHaveBeenCalled();
  });

  it('com o sync desligado, o scroll do editor não mexe no preview', async () => {
    await boot();
    const preview = document.querySelector('#preview');
    const scrollTo = vi.fn();
    preview.scrollTo = scrollTo;
    monacoState.scrollListener({ scrollTop: 120, scrollHeight: 900, height: 400 });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe('H1/H6 — lacunas de verificação do boot', () => {
  it('H1: a edição alcança o conteúdo do documento ativo (wiring real do persistDraft)', async () => {
    await boot();
    monacoState.value = '# conteúdo que precisa sobreviver ao reload';
    monacoState.contentListener();
    window.dispatchEvent(new Event('pagehide'));

    const index = JSON.parse(localStorage.getItem(`${NAMESPACE}.documents`)).value;
    const contentKey = `${NAMESPACE}.documents.content.${index.activeId}`;
    expect(JSON.parse(localStorage.getItem(contentKey)).value).toBe(
      '# conteúdo que precisa sobreviver ao reload',
    );
    // o contrato legado também segue gravado
    expect(JSON.parse(localStorage.getItem(LAST_STATE_KEY)).value).toBe(
      '# conteúdo que precisa sobreviver ao reload',
    );
  });

  it('H6: boot com storage quase cheio anuncia o aviso de quota com o percentual', async () => {
    // ~4 MB já gravados → ≥90% do orçamento de 5 MB (QUOTA_WARN_PERCENT).
    // Sem o `boot()` do harness: ele faz `localStorage.clear()` no início e
    // apagaria o preenchimento.
    localStorage.clear();
    const bigValue = 'x'.repeat(2 * 1024 * 1024);
    localStorage.setItem('preenchimento-1', bigValue);
    localStorage.setItem('preenchimento-2', bigValue);
    localStorage.setItem(THEME_KEY, seedEntry(false));
    document.body.innerHTML = bodyHtml;
    const before = monacoState.createCalls;
    window.dispatchEvent(new Event('load'));
    await vi.waitFor(() => expect(monacoState.createCalls).toBe(before + 1), { timeout: 4000 });
    await vi.waitFor(() => expect(monacoState.editor.setValue).toHaveBeenCalled(), {
      timeout: 4000,
    });
    await new Promise((r) => setTimeout(r, 400));

    const status = document.querySelector('#sidebar-status')?.textContent ?? '';
    expect(status).toContain('%');
    expect(status).toContain('quase cheio');
  });
});
