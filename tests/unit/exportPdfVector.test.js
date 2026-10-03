import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({
  renderMermaidDiagrams: vi.fn(() => Promise.resolve()),
  getMermaidTheme: vi.fn(() => 'default'),
  pauseMermaidScheduling: vi.fn(),
  resumeMermaidScheduling: vi.fn(),
  markdownToPdfmake: vi.fn(() => ({ content: [{ text: 'test' }] })),
  buildPdfDocDefinition: vi.fn((content) => ({ content })),
  resolveKatexPlaceholders: vi.fn((content) => Promise.resolve(content)),
  captureMermaidSvgs: vi.fn(() => new Map()),
  katexHtmlToDataUrl: vi.fn(() => Promise.resolve(null)),
  getDocumentBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(100))),
}));

vi.mock('../../src/render/mermaid.js', () => ({
  renderMermaidDiagrams: state.renderMermaidDiagrams,
  getMermaidTheme: state.getMermaidTheme,
  pauseMermaidScheduling: state.pauseMermaidScheduling,
  resumeMermaidScheduling: state.resumeMermaidScheduling,
}));

vi.mock('../../src/pdf/markdown-to-pdfmake.js', () => ({
  markdownToPdfmake: state.markdownToPdfmake,
  buildPdfDocDefinition: state.buildPdfDocDefinition,
  resolveKatexPlaceholders: state.resolveKatexPlaceholders,
  collectImageSrcs: () => [],
}));

vi.mock('../../src/pdf/svg-embed.js', () => ({
  captureMermaidSvgs: state.captureMermaidSvgs,
}));

vi.mock('../../src/render/katexExt.js', () => ({
  katexHtmlToDataUrl: state.katexHtmlToDataUrl,
}));

vi.mock('../../src/pdf/pdfmake-adapter.js', () => ({
  getDocumentBuffer: state.getDocumentBuffer,
}));

import {
  isVectorPdfEnabled,
  setVectorPdfEnabled,
  resolveImageDataUrls,
} from '../../src/ui/exportPdfVector.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

describe('isVectorPdfEnabled', () => {
  it('retorna false por padrão', () => {
    expect(isVectorPdfEnabled(fakeStorage())).toBe(false);
  });

  it('retorna true quando flag é "true"', () => {
    const storage = fakeStorage();
    storage.setItem('com.markdownstudio.pdf.vector', 'true');
    expect(isVectorPdfEnabled(storage)).toBe(true);
  });

  it('retorna false quando flag é "false"', () => {
    const storage = fakeStorage();
    storage.setItem('com.markdownstudio.pdf.vector', 'false');
    expect(isVectorPdfEnabled(storage)).toBe(false);
  });

  it('retorna false quando storage lança', () => {
    const broken = {
      getItem: () => {
        throw new Error('x');
      },
    };
    expect(isVectorPdfEnabled(broken)).toBe(false);
  });
});

describe('setVectorPdfEnabled', () => {
  it('grava "true" no storage', () => {
    const storage = fakeStorage();
    setVectorPdfEnabled(true, storage);
    expect(storage.getItem('com.markdownstudio.pdf.vector')).toBe('true');
  });

  it('grava "false" no storage', () => {
    const storage = fakeStorage();
    setVectorPdfEnabled(false, storage);
    expect(storage.getItem('com.markdownstudio.pdf.vector')).toBe('false');
  });

  it('não lança quando storage lança', () => {
    const broken = {
      setItem: () => {
        throw new Error('x');
      },
    };
    expect(() => setVectorPdfEnabled(true, broken)).not.toThrow();
  });
});

describe('exportPdfVector (integration with mocks)', () => {
  let exportPdfVector;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '<div id="output"></div>';
    window.URL.createObjectURL = vi.fn(() => 'blob:fake');
    window.URL.revokeObjectURL = vi.fn();
    const mod = await import('../../src/ui/exportPdfVector.js');
    exportPdfVector = mod.exportPdfVector;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  it('exporta com sucesso quando tudo OK', async () => {
    const onStatus = vi.fn();
    const getMarkdown = vi.fn(() => '# Hello');
    const anchor = { click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    await exportPdfVector({ onStatus, getMarkdown });
    expect(onStatus).toHaveBeenCalledWith('PDF exportado!');
    expect(state.renderMermaidDiagrams).toHaveBeenCalledWith('default');
    expect(state.markdownToPdfmake).toHaveBeenCalled();
  });

  it('nomeia o download com o título do documento ativo sanitizado (AC-P2-10-3)', async () => {
    const onStatus = vi.fn();
    const getMarkdown = vi.fn(() => '# Hello');
    const getDocName = vi.fn(() => 'Relatório/2026: final?.md');
    const anchor = { click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    await exportPdfVector({ onStatus, getMarkdown, getDocName });
    expect(anchor.download).toBe('Relatório 2026 final.pdf');
  });

  it('cai no fallback markdown-preview.pdf sem título utilizável', async () => {
    const onStatus = vi.fn();
    const getMarkdown = vi.fn(() => '# Hello');
    const getDocName = vi.fn(() => '');
    const anchor = { click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    await exportPdfVector({ onStatus, getMarkdown, getDocName });
    expect(anchor.download).toBe('markdown-preview.pdf');
  });

  it('reporta erro quando getMarkdown retorna vazio', async () => {
    const onStatus = vi.fn();
    const getMarkdown = vi.fn(() => '');
    await exportPdfVector({ onStatus, getMarkdown });
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('reporta erro quando getMarkdown não é fornecido', async () => {
    const onStatus = vi.fn();
    await exportPdfVector({ onStatus });
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('reporta pdfUnavailable quando adapter falha', async () => {
    const onStatus = vi.fn();
    const getMarkdown = vi.fn(() => '# test');
    state.getDocumentBuffer.mockRejectedValueOnce(new Error('pdfmake fail'));
    const anchor = { click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    await exportPdfVector({ onStatus, getMarkdown });
    expect(onStatus).toHaveBeenCalledWith('Falha ao exportar o PDF.');
  });
});

describe('resolveImageDataUrls (A3 — fetch de imagens relativas)', () => {
  it('resolve PNG/JPEG de mesma origem para data URL', async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const fetchImpl = vi.fn(async () => ({ ok: true, blob: async () => png }));
    const map = await resolveImageDataUrls(['/img/a.png', '/img/b.jpeg'], fetchImpl);
    expect(map.get('/img/a.png')).toMatch(/^data:image\/png/);
    expect(map.get('/img/b.jpeg')).toMatch(/^data:image\/png/);
  });

  it('ignora tipos não decodificáveis (SVG), respostas falhas e erros de rede', async () => {
    const svg = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    const fetchImpl = vi.fn(async (src) => {
      if (src === '/x.svg') return { ok: true, blob: async () => svg };
      if (src === '/404.png') return { ok: false };
      throw new Error('offline');
    });
    const map = await resolveImageDataUrls(['/x.svg', '/404.png', '/boom.png'], fetchImpl);
    expect(map.size).toBe(0);
  });

  it('sem fetch devolve mapa vazio sem lançar', async () => {
    await expect(resolveImageDataUrls(['/a.png'], undefined)).resolves.toEqual(new Map());
  });
});
