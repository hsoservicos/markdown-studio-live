import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setLocale } from '../../src/i18n/index.js';
import { buildExportOptions, DEFAULT_PDF_FILENAME } from '../../src/ui/exportPdf.js';

const state = vi.hoisted(() => ({
  renderMermaidDiagrams: vi.fn(() => Promise.resolve()),
  getMermaidTheme: vi.fn(() => 'default'),
  pauseMermaidScheduling: vi.fn(),
  resumeMermaidScheduling: vi.fn(),
  html2pdf: undefined,
  default: undefined,
}));

vi.mock('../../src/render/mermaid.js', () => ({
  renderMermaidDiagrams: state.renderMermaidDiagrams,
  getMermaidTheme: state.getMermaidTheme,
  pauseMermaidScheduling: state.pauseMermaidScheduling,
  resumeMermaidScheduling: state.resumeMermaidScheduling,
}));

vi.mock('html2pdf.js', () => state);

import { exportPreviewToPdf } from '../../src/ui/exportPdf.js';
import { renderMermaidDiagrams, getMermaidTheme } from '../../src/render/mermaid.js';

function buildChain() {
  const worker = {
    set: vi.fn(() => worker),
    from: vi.fn(() => worker),
    toPdf: vi.fn(() => worker),
    get: vi.fn(() => ({ internal: { pageSize: {}, events: {} }, text: vi.fn() })),
    save: vi.fn(() => Promise.resolve()),
  };
  return worker;
}

describe('buildExportOptions', () => {
  it('configura A4 retrato com filename padrão', () => {
    const options = buildExportOptions();
    expect(options.filename).toBe(DEFAULT_PDF_FILENAME);
    expect(options.jsPDF).toMatchObject({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    expect(options.html2canvas.scale).toBe(2);
  });

  it('aceita filename customizado', () => {
    expect(buildExportOptions('nota.pdf').filename).toBe('nota.pdf');
  });

  it('onclone força tema light, largura conforme papel/orientação e injeta print style', () => {
    const options = buildExportOptions('nota.pdf', {
      margin: 15,
      paperSize: 'a4',
      orientation: 'landscape',
    });
    expect(options.margin).toBe(15);
    expect(options.jsPDF).toMatchObject({ format: 'a4', orientation: 'landscape' });
    const preview = { style: { width: '', maxWidth: '' } };
    const markdownLink = { setAttribute: vi.fn() };
    const appended = [];
    const clonedHead = { appendChild: (el) => appended.push(el) };
    const clonedDoc = {
      documentElement: { setAttribute: vi.fn() },
      getElementById: vi.fn((id) => {
        if (id === 'gh-markdown-link') {
          return markdownLink;
        }
        if (id === 'preview-wrapper') {
          return preview;
        }
        return null;
      }),
      createElement: vi.fn(() => ({ textContent: '' })),
      head: clonedHead,
    };
    options.html2canvas.onclone(clonedDoc);
    expect(clonedDoc.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    expect(markdownLink.setAttribute).toHaveBeenCalledWith('href', 'css/github-markdown-light.css');
    expect(preview.style.width).toBe('210mm');
    expect(preview.style.maxWidth).toBe('210mm');
    expect(appended).toHaveLength(1);
    expect(appended[0].id).toBe('pdf-print-style');
    expect(appended[0].textContent).toContain('@page');
  });

  it('onclone usa largura A4 retrato padrão', () => {
    const options = buildExportOptions();
    const preview = { style: { width: '', maxWidth: '' } };
    const clonedDoc = {
      documentElement: { setAttribute: vi.fn() },
      getElementById: vi.fn((id) => (id === 'preview-wrapper' ? preview : null)),
      createElement: vi.fn(() => ({ textContent: '' })),
      head: { appendChild: vi.fn() },
    };
    options.html2canvas.onclone(clonedDoc);
    expect(preview.style.width).toBe('190mm');
    expect(options.jsPDF).toMatchObject({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  });
});

describe('exportPreviewToPdf', () => {
  let chain;

  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('pt-BR');
    chain = buildChain();
    state.default = () => chain;
    document.body.innerHTML = '<div id="preview-wrapper"></div>';
    window.alert = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('não faz nada quando não há preview', async () => {
    document.body.innerHTML = '';
    const onStatus = vi.fn();
    await exportPreviewToPdf({ onStatus });
    expect(chain.save).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('reporta indisponibilidade no status quando a lib não carrega (B5)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    state.default = undefined;
    const onStatus = vi.fn();
    await exportPreviewToPdf({ onStatus });
    expect(onStatus).toHaveBeenCalledWith(
      'A exportação de PDF ainda não está disponível. Tente novamente em instantes.',
    );
    console.warn.mockRestore();
  });

  it('exporta o preview e informa sucesso', async () => {
    const onStatus = vi.fn();
    await expect(exportPreviewToPdf({ onStatus })).resolves.toBeUndefined();
    expect(chain.set).toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalledWith(document.querySelector('#preview-wrapper'));
    expect(chain.toPdf).toHaveBeenCalled();
    expect(chain.get).toHaveBeenCalledWith('pdf');
    expect(chain.save).toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith('PDF exportado!');
    expect(state.pauseMermaidScheduling).toHaveBeenCalled();
    expect(state.resumeMermaidScheduling).toHaveBeenCalled();
    expect(renderMermaidDiagrams).toHaveBeenCalledWith('default');
    expect(renderMermaidDiagrams).toHaveBeenCalledTimes(1);
  });

  it('exporta com configurações de impressão customizadas', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onStatus = vi.fn();
    await exportPreviewToPdf(
      { onStatus },
      { margin: 20, paperSize: 'letter', orientation: 'landscape', headerText: '', footerText: '' },
    );
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        margin: 20,
        jsPDF: expect.objectContaining({ format: 'letter', orientation: 'landscape' }),
      }),
    );
    expect(onStatus).toHaveBeenCalledWith('PDF exportado!');
    console.warn.mockRestore();
  });

  it('informa erro quando o save falha e restaura mermaid dark', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getMermaidTheme.mockReturnValue('dark');
    chain.save.mockRejectedValueOnce(new Error('canvas'));
    const onStatus = vi.fn();
    await exportPreviewToPdf({ onStatus });
    expect(onStatus).toHaveBeenCalledWith('Falha ao exportar o PDF.');
    expect(renderMermaidDiagrams).toHaveBeenNthCalledWith(1, 'default');
    expect(renderMermaidDiagrams).toHaveBeenCalledTimes(2);
    expect(state.resumeMermaidScheduling).toHaveBeenCalled();
    console.error.mockRestore();
  });
});
