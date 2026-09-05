import { describe, it, expect } from 'vitest';
import {
  computeStats,
  formatStats,
  renderStats,
  setupStatusBar,
  checkStorageQuota,
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

describe('checkStorageQuota', () => {
  it('retorna ok: true quando storage funciona', () => {
    const result = checkStorageQuota();
    expect(result.ok).toBe(true);
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
