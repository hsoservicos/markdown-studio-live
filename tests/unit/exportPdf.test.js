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

  it('onclone força tema light e largura A4 no clone', () => {
    const options = buildExportOptions();
    const preview = { style: { width: '', maxWidth: '' } };
    const markdownLink = { setAttribute: vi.fn() };
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
    };
    options.html2canvas.onclone(clonedDoc);
    expect(clonedDoc.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    expect(markdownLink.setAttribute).toHaveBeenCalledWith('href', 'css/github-markdown-light.css');
    expect(preview.style.width).toBe('190mm');
    expect(preview.style.maxWidth).toBe('190mm');
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

  it('alerta indisponível quando a lib não carrega', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    state.default = undefined;
    await exportPreviewToPdf({});
    expect(window.alert).toHaveBeenCalledWith(
      'A exportação de PDF ainda não está disponível. Tente novamente em instantes.',
    );
    console.warn.mockRestore();
  });

  it('exporta o preview e informa sucesso', async () => {
    const onStatus = vi.fn();
    await expect(exportPreviewToPdf({ onStatus })).resolves.toBeUndefined();
    expect(chain.set).toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalledWith(document.querySelector('#preview-wrapper'));
    expect(chain.save).toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith('PDF exportado!');
    expect(state.pauseMermaidScheduling).toHaveBeenCalled();
    expect(state.resumeMermaidScheduling).toHaveBeenCalled();
    expect(renderMermaidDiagrams).toHaveBeenCalledWith('default');
    expect(renderMermaidDiagrams).toHaveBeenCalledTimes(1);
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
