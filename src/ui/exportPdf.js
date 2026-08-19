import { renderMermaidDiagrams } from '../render/mermaid.js';
import { getMermaidTheme } from '../render/mermaid.js';
import { pauseMermaidScheduling } from '../render/mermaid.js';
import { resumeMermaidScheduling } from '../render/mermaid.js';
import { t } from '../i18n/index.js';

export const DEFAULT_PDF_FILENAME = 'markdown-preview.pdf';

export function buildExportOptions(filename = DEFAULT_PDF_FILENAME) {
  return {
    margin: 10,
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
          clonedPreview.style.width = '190mm';
          clonedPreview.style.maxWidth = '190mm';
        }
      },
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
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

export async function exportPreviewToPdf({ onStatus } = {}) {
  const previewElement = document.querySelector('#preview-wrapper');
  if (!previewElement) {
    return;
  }

  let html2pdf;
  try {
    html2pdf = await loadHtml2Pdf();
  } catch (error) {
    console.warn(error);
    window.alert(t('pdfUnavailable'));
    return;
  }

  const restoreDarkMermaid = getMermaidTheme() === 'dark';

  // M1: enquanto o html2pdf clona o DOM (demorado), nenhum agendamento de
  // re-render do mermaid (ex.: troca de tema no debounce) pode mutar o DOM.
  pauseMermaidScheduling();

  try {
    await renderMermaidDiagrams('default');
    await html2pdf().set(buildExportOptions()).from(previewElement).save();
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
