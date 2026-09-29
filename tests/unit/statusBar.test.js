import { describe, it, expect, vi } from 'vitest';
import {
  computeStats,
  formatStats,
  renderStats,
  setupStatusBar,
  checkStorageQuota,
  measureStorageUsage,
} from '../../src/ui/statusBar.js';

const tFn = {
  words: '{n} palavras',
  chars: '{n} caracteres',
  lines: '{n} linhas',
  readingTime: '~{n} min de leitura',
};

describe('computeStats', () => {
  it('conta palavras, caracteres, linhas e tempo de leitura', () => {
    expect(computeStats('um dois\ntres quatro')).toEqual({
      words: 4,
      characters: 19,
      lines: 2,
      readingMinutes: 1,
    });
  });

  it('documento vazio zera tudo', () => {
    expect(computeStats('')).toEqual({ words: 0, characters: 0, lines: 0, readingMinutes: 0 });
  });

  it('arredonda tempo de leitura por 200 palavras/min', () => {
    const text = Array.from({ length: 450 }, (_, i) => `palavra${i}`).join(' ');
    expect(computeStats(text).readingMinutes).toBe(2);
  });

  it('tolerância a null/undefined', () => {
    expect(computeStats(null).words).toBe(0);
    expect(computeStats(undefined).lines).toBe(0);
  });

  it('uma palavra retorna 1 min de leitura', () => {
    expect(computeStats('hello').readingMinutes).toBe(1);
  });
});

describe('formatStats', () => {
  it('monta texto localizado', () => {
    const stats = { words: 3, characters: 11, lines: 1, readingMinutes: 1 };
    expect(formatStats(stats, (k) => tFn[k])).toBe(
      '3 palavras · 11 caracteres · 1 linhas · ~1 min de leitura',
    );
  });

  it('prefixa com nome do arquivo quando presente', () => {
    const stats = { words: 1, characters: 5, lines: 1, readingMinutes: 1 };
    expect(formatStats(stats, (k) => tFn[k], 'nota.md')).toContain('nota.md · ');
  });

  it('sem arquivo não prefixa', () => {
    const stats = { words: 1, characters: 5, lines: 1, readingMinutes: 1 };
    const result = formatStats(stats, (k) => tFn[k]);
    expect(result).not.toContain('nota.md');
  });
});

describe('renderStats', () => {
  it('renderStats escreve no container', () => {
    const el = document.createElement('span');
    renderStats(el, { words: 2, characters: 8, lines: 1, readingMinutes: 1 }, (k) => tFn[k]);
    expect(el.textContent).toContain('2 palavras');
  });

  it('renderStats retorna null sem container', () => {
    expect(renderStats(null, { words: 0, characters: 0, lines: 0, readingMinutes: 0 })).toBeNull();
  });

  it('renderStats com fileName', () => {
    const el = document.createElement('span');
    renderStats(
      el,
      { words: 1, characters: 5, lines: 1, readingMinutes: 1 },
      (k) => tFn[k],
      'test.md',
    );
    expect(el.textContent).toContain('test.md');
  });
});

/** Storage falso somente-leitura, com as escritas espiadas. */
function fakeStorage(entries) {
  const map = new Map(entries);
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

describe('measureStorageUsage', () => {
  it('conta 2 bytes por caractere de chave e valor (UTF-16)', () => {
    expect(measureStorageUsage(fakeStorage([['abc', 'de']]))).toEqual({ bytes: 10, entries: 1 });
  });

  it('storage vazio zera', () => {
    expect(measureStorageUsage(fakeStorage([]))).toEqual({ bytes: 0, entries: 0 });
  });
});

describe('checkStorageQuota', () => {
  it('retorna ok: true quando storage funciona', () => {
    const result = checkStorageQuota();
    expect(result.ok).toBe(true);
  });

  it('não escreve nada no storage (a versão anterior gravava 1 MB por boot)', () => {
    const storage = fakeStorage([['last_state', 'x']]);
    const result = checkStorageQuota({ storage });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, percentUsed: 0 });
  });

  it('não escreve nada no localStorage real no caminho padrão', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    try {
      const result = checkStorageQuota();
      expect(setSpy).not.toHaveBeenCalled();
      expect(removeSpy).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
    } finally {
      setSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  it('marca ok: false quando o uso passa do limite', () => {
    const storage = fakeStorage([['k', 'x'.repeat(49)]]); // (1 + 49) * 2 = 100 bytes
    const result = checkStorageQuota({ storage, quotaBytes: 100 });
    expect(result.bytes).toBe(100);
    expect(result.percentUsed).toBe(100);
    expect(result.ok).toBe(false);
  });

  it('permanece ok enquanto o uso está abaixo do limite', () => {
    const storage = fakeStorage([['k', 'x']]); // (1 + 1) * 2 = 4 bytes
    const result = checkStorageQuota({ storage, quotaBytes: 100 });
    expect(result.percentUsed).toBe(4);
    expect(result.ok).toBe(true);
  });

  it('percentUsed é limitado a 100', () => {
    const storage = fakeStorage([['k', 'x'.repeat(999)]]);
    expect(checkStorageQuota({ storage, quotaBytes: 10 }).percentUsed).toBe(100);
  });

  it('storage que lança degrada para ok: true (sem crash)', () => {
    const result = checkStorageQuota({
      storage: {
        get length() {
          throw new Error('SecurityError');
        },
      },
    });
    expect(result).toMatchObject({ ok: true, percentUsed: 0 });
  });
});

describe('setupStatusBar', () => {
  it('setupStatusBar retorna null sem o elemento #status-stats', () => {
    const container = document.createElement('footer');
    expect(setupStatusBar({ container, getContent: () => '' })).toBeNull();
  });

  it('setupStatusBar retorna objeto com update e render', () => {
    const container = document.createElement('footer');
    const el = document.createElement('span');
    el.id = 'status-stats';
    container.appendChild(el);
    const bar = setupStatusBar({ container, getContent: () => 'test' });
    expect(bar).toHaveProperty('update');
    expect(bar).toHaveProperty('render');
    expect(bar).toHaveProperty('checkQuota');
  });

  it('setupStatusBar atualiza pelo conteúdo atual', () => {
    const container = document.createElement('footer');
    const el = document.createElement('span');
    el.id = 'status-stats';
    container.appendChild(el);
    let content = 'um dois';
    const bar = setupStatusBar({ container, getContent: () => content, tFn: (k) => tFn[k] });
    bar.render();
    expect(el.textContent).toContain('2 palavras');
    content = 'a b c d e f g h i j k l m n o p q r s t u v w x y z';
    bar.render();
    expect(el.textContent).toContain('26 palavras');
  });

  it('setupStatusBar com getFileName', () => {
    const container = document.createElement('footer');
    const el = document.createElement('span');
    el.id = 'status-stats';
    container.appendChild(el);
    const bar = setupStatusBar({
      container,
      getContent: () => 'test',
      tFn: (k) => tFn[k],
      getFileName: () => 'doc.md',
    });
    bar.render();
    expect(el.textContent).toContain('doc.md');
  });
});
