import { renderMermaidDiagrams } from '../render/mermaid.js';
import { getMermaidTheme } from '../render/mermaid.js';
import { pauseMermaidScheduling } from '../render/mermaid.js';
import { resumeMermaidScheduling } from '../render/mermaid.js';
import { t } from '../i18n/index.js';
import { DEFAULT_PRINT_SETTINGS, normalizePrintSettings } from './printSettings.js';
import {
  markdownToPdfmake,
  buildPdfDocDefinition,
  resolveKatexPlaceholders,
} from '../pdf/markdown-to-pdfmake.js';
import { captureMermaidSvgs } from '../pdf/svg-embed.js';
import { katexHtmlToDataUrl } from '../render/katexExt.js';

export const PDF_VECTOR_FLAG = 'com.markdownstudio.pdf.vector';

export function isVectorPdfEnabled(storage = globalThis.localStorage) {
  try {
    return storage.getItem(PDF_VECTOR_FLAG) === 'true';
  } catch {
    return false;
  }
}

export function setVectorPdfEnabled(enabled, storage = globalThis.localStorage) {
  try {
    storage.setItem(PDF_VECTOR_FLAG, String(enabled));
  } catch {
    // storage indisponible
  }
}

export async function exportPdfVector(
  { onStatus, getMarkdown } = {},
  printSettings = DEFAULT_PRINT_SETTINGS,
) {
  if (!getMarkdown) {
    return;
  }

  const markdown = getMarkdown();
  if (!markdown) {
    return;
  }

  let adapter;
  try {
    adapter = await import('../pdf/pdfmake-adapter.js');
  } catch (error) {
    console.warn(error);
    onStatus?.(t('pdfUnavailable'));
    return;
  }

  const restoreDarkMermaid = getMermaidTheme() === 'dark';

  pauseMermaidScheduling();

  try {
    await renderMermaidDiagrams('default');

    const outputElement = document.querySelector('#output');
    const mermaidSvgs = captureMermaidSvgs(outputElement);

    const { content: rawContent } = markdownToPdfmake(markdown, { mermaidSvgs });
    const content = await resolveKatexPlaceholders(rawContent, katexHtmlToDataUrl);
    const settings = normalizePrintSettings(printSettings);
    const docDefinition = buildPdfDocDefinition(content, settings);

    const buffer = await adapter.getDocumentBuffer(docDefinition);
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'markdown-preview.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

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
