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
  collectImageSrcs,
} from '../pdf/markdown-to-pdfmake.js';
import { captureMermaidSvgs } from '../pdf/svg-embed.js';
import { katexHtmlToDataUrl } from '../render/katexExt.js';
import { sanitizeDownloadName } from './files.js';

// Re-exportados aqui para manter a API pública que `exportPdf.js` e os testes
// já consomem; a definição é única em `pdfVectorFlag.js`.
export { PDF_VECTOR_FLAG, isVectorPdfEnabled, setVectorPdfEnabled } from './pdfVectorFlag.js';

/**
 * A3: resolve imagens relativas (mesma origem) para data URL PNG/JPEG via
 * fetch, para o pdfmake conseguir embutir. O que não for decodificável
 * (SVG, tipo desconhecido, fetch falho) simplesmente não entra no mapa e o
 * conversor degrada para o alt.
 * @param {string[]} srcs
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<Map<string, string>>}
 */
export async function resolveImageDataUrls(srcs, fetchImpl = globalThis.fetch) {
  const map = new Map();
  if (typeof fetchImpl !== 'function') {
    return map;
  }
  for (const src of srcs ?? []) {
    try {
      const res = await fetchImpl(src);
      if (!res?.ok) {
        continue;
      }
      const blob = await res.blob();
      if (!/^image\/(?:png|jpe?g)$/i.test(blob.type)) {
        continue;
      }
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
      if (dataUrl.startsWith('data:image/')) {
        map.set(src, dataUrl);
      }
    } catch {
      // imagem indisponível degrada para alt no conversor
    }
  }
  return map;
}

export async function exportPdfVector(
  { onStatus, getMarkdown, getDocName } = {},
  printSettings = DEFAULT_PRINT_SETTINGS,
) {
  if (!getMarkdown) {
    return;
  }

  const markdown = getMarkdown();
  if (!markdown) {
    return;
  }

  onStatus?.(t('pdfGenerating'));

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

    // A3: imagens relativas viram data URL PNG/JPEG quando buscáveis.
    const imageDataUrls = await resolveImageDataUrls(collectImageSrcs(markdown));
    const { content: rawContent } = markdownToPdfmake(markdown, { mermaidSvgs, imageDataUrls });
    const content = await resolveKatexPlaceholders(rawContent, katexHtmlToDataUrl);
    const settings = normalizePrintSettings(printSettings);
    const docDefinition = buildPdfDocDefinition(content, settings);

    const buffer = await adapter.getDocumentBuffer(docDefinition);
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    // AC-P2-10-3: nome do documento ativo, sanitizado; fallback legado
    // `markdown-preview.pdf` quando não há título utilizável.
    anchor.download = sanitizeDownloadName(getDocName?.(), '.pdf', 'markdown-preview');
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
