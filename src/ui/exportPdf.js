import { renderMermaidDiagrams } from '../render/mermaid.js';
import { getMermaidTheme } from '../render/mermaid.js';
import { pauseMermaidScheduling } from '../render/mermaid.js';
import { resumeMermaidScheduling } from '../render/mermaid.js';
import { t } from '../i18n/index.js';
import {
  DEFAULT_PRINT_SETTINGS,
  getPrintStylesheetCss,
  normalizePrintSettings,
  stampPageHeaderFooter,
} from './printSettings.js';

export const DEFAULT_PDF_FILENAME = 'markdown-preview.pdf';

const PAPER_WIDTH_MM = { a4: 210, letter: 216 };

export function buildExportOptions(
  filename = DEFAULT_PDF_FILENAME,
  settings = DEFAULT_PRINT_SETTINGS,
) {
  const { margin, paperSize, orientation } = normalizePrintSettings(settings);
  const paperWidth = PAPER_WIDTH_MM[paperSize] ?? 210;
  const previewWidth = orientation === 'landscape' ? `${paperWidth}mm` : '190mm';
  const stylesheet = getPrintStylesheetCss(settings);
  return {
    margin,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      onclone: (clonedDoc) => {
        clonedDoc.documentElement.setAttribute('data-theme', 'light');
        const markdownLink = clonedDoc.getElementById('gh-markdown-link');
        if (markdownLink) {
          markdownLink.setAttribute('href', 'css/github-markdown-light.css');
        }
        const clonedPreview = clonedDoc.getElementById('preview-wrapper');
        if (clonedPreview) {
          clonedPreview.style.width = previewWidth;
          clonedPreview.style.maxWidth = previewWidth;
        }
        // P0-2: quebras de página conscientes + @page no clone do PDF.
        const styleEl = clonedDoc.createElement('style');
        styleEl.id = 'pdf-print-style';
        styleEl.textContent = stylesheet;
        clonedDoc.head?.appendChild(styleEl);
      },
    },
    jsPDF: { unit: 'mm', format: paperSize, orientation },
  };
}

// html2pdf.js é carregado sob demanda (chunk separado) para manter o boot
// enxuto e 100% local — sem CDN.
export async function loadHtml2Pdf() {
  const module = await import('html2pdf.js');
  const html2pdf = module.default ?? module.html2pdf ?? module;
  if (typeof html2pdf !== 'function') {
    throw new Error('html2pdf unavailable');
  }
  return html2pdf;
}

export async function exportPreviewToPdf(
  { onStatus } = {},
  printSettings = DEFAULT_PRINT_SETTINGS,
) {
  const previewElement = document.querySelector('#preview-wrapper');
  if (!previewElement) {
    return;
  }

  let html2pdf;
  try {
    html2pdf = await loadHtml2Pdf();
  } catch (error) {
    console.warn(error);
    // B5: erro reportado no canal único de status (aria-live), sem dialog
    // nativo bloqueante.
    onStatus?.(t('pdfUnavailable'));
    return;
  }

  const restoreDarkMermaid = getMermaidTheme() === 'dark';

  // M1: enquanto o html2pdf clona o DOM (demorado), nenhum agendamento de
  // re-render do mermaid (ex.: troca de tema no debounce) pode mutar o DOM.
  pauseMermaidScheduling();

  try {
    // M1: renderiza mermaid no tema claro antes de clonar o DOM.
    await renderMermaidDiagrams('default');
    const worker = html2pdf()
      .set(buildExportOptions(DEFAULT_PDF_FILENAME, printSettings))
      .from(previewElement)
      .toPdf();
    // P0-1: cabeçalho/rodapé configuráveis via hook toPdf().get('pdf').
    stampPageHeaderFooter(worker.get('pdf'), printSettings);
    await worker.save();
    onStatus?.(t('pdfExported'));
  } catch (error) {
    console.error(t('exportError'), error);
    onStatus?.(t('exportError'));
  } finally {
    resumeMermaidScheduling();
    if (restoreDarkMermaid) {
      renderMermaidDiagrams();
    }
  }
}
