import { describe, it, expect, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pdfMake: null,
}));

vi.mock('pdfmake/build/pdfmake.js', () => ({
  default: state.pdfMake,
}));

vi.mock('pdfmake/build/vfs_fonts.js', () => ({
  default: {},
}));

import { isPdfMakeAvailable, createPdfDocument } from '../../src/pdf/pdfmake-adapter.js';

import { buildPdfDocDefinition } from '../../src/pdf/markdown-to-pdfmake.js';

describe('buildPdfDocDefinition', () => {
  it('cria docDefinition com content e pageMargins', () => {
    const doc = buildPdfDocDefinition([{ text: 'Hello' }]);
    expect(doc.content).toHaveLength(1);
    expect(doc.pageMargins).toBeDefined();
    expect(doc.pageMargins).toHaveLength(4);
  });

  it('aplica margem customizada', () => {
    const doc = buildPdfDocDefinition([], { margin: 20 });
    expect(doc.pageMargins).toEqual([20, 30, 20, 30]);
  });

  it('adiciona header quando headerText definido', () => {
    const doc = buildPdfDocDefinition([], { headerText: 'Cabeçalho' });
    expect(doc.header).toBeDefined();
    const header = doc.header(1, 1);
    expect(header).toHaveLength(1);
    expect(header[0].text).toBe('Cabeçalho');
  });

  it('adiciona footer quando footerText definido', () => {
    const doc = buildPdfDocDefinition([], { footerText: 'Página {page}' });
    expect(doc.footer).toBeDefined();
    const footer = doc.footer(3, 5);
    expect(footer).toHaveLength(1);
    expect(footer[0].text).toBe('Página 3');
  });

  it('substitui {page} no header e footer', () => {
    const doc = buildPdfDocDefinition([], {
      headerText: 'Doc {page}',
      footerText: 'Página {page} de {total}',
    });
    const header = doc.header(2, 10);
    expect(header[0].text).toBe('Doc 2');
    const footer = doc.footer(5, 10);
    expect(footer[0].text).toBe('Página 5 de {total}');
  });

  it('não adiciona header/footer quando vazio', () => {
    const doc = buildPdfDocDefinition([]);
    expect(doc.header).toBeUndefined();
    expect(doc.footer).toBeUndefined();
  });
});

describe('isPdfMakeAvailable', () => {
  it('retorna false quando não inicializado', () => {
    expect(isPdfMakeAvailable()).toBe(false);
  });
});

describe('createPdfDocument', () => {
  it('lança quando pdfmake não está disponível', async () => {
    await expect(createPdfDocument({ content: [] })).rejects.toThrow();
  });
});
