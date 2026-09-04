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

import { isVectorPdfEnabled, setVectorPdfEnabled } from '../../src/ui/exportPdfVector.js';

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
