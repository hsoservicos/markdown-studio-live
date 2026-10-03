export const PRINT_SETTINGS_KEY = 'com.markdownstudio.print_settings';

export const DEFAULT_PRINT_SETTINGS = {
  margin: 10, // mm
  paperSize: 'a4', // a4 | letter
  orientation: 'portrait', // portrait | landscape
  headerText: '', // texto do cabeçalho (imprime em todas as páginas; {page} vira nº)
  footerText: '', // texto do rodapé ({page} vira nº da página)
};

export const PAPER_SIZES = ['a4', 'letter'];
export const ORIENTATIONS = ['portrait', 'landscape'];

function clamp(value, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return null;
  }
  return Math.min(max, Math.max(min, num));
}

function cleanText(value) {
  return typeof value === 'string' ? value.slice(0, 200) : '';
}

export function normalizePrintSettings(settings) {
  const margin = clamp(settings?.margin, 0, 40);
  const paperSize = PAPER_SIZES.includes(settings?.paperSize) ? settings.paperSize : 'a4';
  const orientation = ORIENTATIONS.includes(settings?.orientation)
    ? settings.orientation
    : 'portrait';
  return {
    margin: margin ?? DEFAULT_PRINT_SETTINGS.margin,
    paperSize,
    orientation,
    headerText: cleanText(settings?.headerText),
    footerText: cleanText(settings?.footerText),
  };
}

export function loadPrintSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(PRINT_SETTINGS_KEY);
    if (raw == null) {
      return { ...DEFAULT_PRINT_SETTINGS };
    }
    return normalizePrintSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS };
  }
}

export function savePrintSettings(settings, storage = globalThis.localStorage) {
  const normalized = normalizePrintSettings(settings);
  try {
    storage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // storage indisponível — impressão segue com defaults
  }
  return normalized;
}

function resolvePageNumber(text, pageNumber) {
  return String(text).replace(/\{page\}/g, String(pageNumber));
}

/**
 * Estampa cabeçalho/rodapé configurados em um documento jsPDF (html2pdf).
 * O hook `toPdf().get('pdf')` entrega o objeto jsPDF; aqui escrevemos o texto
 * na primeira página e subscrevemos `addPage` para todas as seguintes.
 */
export function stampPageHeaderFooter(pdf, settings = DEFAULT_PRINT_SETTINGS) {
  const { headerText, footerText } = normalizePrintSettings(settings);
  if (!headerText && !footerText) {
    return;
  }
  if (!pdf || typeof pdf.text !== 'function') {
    // D6: `worker.get('pdf')` sem devolver jsPDF — o carimbo de cabeçalho/
    // rodapé era perdido em silêncio e o usuário só via no PDF gerado.
    console.warn('[pdf] jsPDF indisponível; cabeçalho/rodapé omitidos do export');
    return;
  }
  const pageWidth =
    typeof pdf.internal?.pageSize?.getWidth === 'function' ? pdf.internal.pageSize.getWidth() : 210;
  // D5: a altura da página é do papel do export — fixo em 287mm (A4) fazia o
  // rodapé sair do papel em Letter/paisagem.
  const pageHeight =
    typeof pdf.internal?.pageSize?.getHeight === 'function'
      ? pdf.internal.pageSize.getHeight()
      : 297;
  const font = typeof pdf.setFontSize === 'function' ? () => pdf.setFontSize(8) : () => {};
  const write = () => {
    font();
    const page =
      typeof pdf.getCurrentPageInfo === 'function' ? pdf.getCurrentPageInfo().pageNumber : 1;
    if (headerText) {
      pdf.text(resolvePageNumber(headerText, page), pageWidth / 2, 5, { align: 'center' });
    }
    if (footerText) {
      pdf.text(resolvePageNumber(footerText, page), pageWidth / 2, pageHeight - 10, {
        align: 'center',
      });
    }
  };
  write();
  if (typeof pdf.internal?.events?.subscribe === 'function') {
    pdf.internal.events.subscribe('addPage', write);
  }
}

/**
 * Folha de estilo injetada no clone do PDF e no @media print do documento:
 * @page (papel/margem) e quebras conscientes.
 *
 * Cabeçalho/rodapé com `{page}` NÃO saem aqui: em impressão via browser não
 * existe conteúdo fixo por página em CSS (o `{page}` é do diálogo de impressão
 * do navegador) — eles são carimbados apenas nos caminhos de PDF
 * (`stampPageHeaderFooter` no raster, `header`/`footer` no docDefinition do
 * pdfmake). A chrome do app é escondida pelo `@media print` do `style.css`.
 */
export function getPrintStylesheetCss(settings = DEFAULT_PRINT_SETTINGS) {
  const { margin, paperSize, orientation } = normalizePrintSettings(settings);
  return `
@page { size: ${paperSize} ${orientation}; margin: ${margin}mm; }
@media print {
  .page-break { break-after: page; page-break-after: always; }
  .markdown-body table,
  .markdown-body pre,
  .markdown-body blockquote,
  .markdown-body figure,
  .markdown-body li,
  .markdown-body .mermaid,
  .markdown-body .katex-display {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4 {
    break-after: avoid;
    page-break-after: avoid;
  }
}
`;
}

export const PRINT_STYLE_ID = 'print-settings-style';

export function applyPrintSettingsCss(settings, doc = globalThis.document) {
  if (!doc || typeof doc.createElement !== 'function') {
    return null;
  }
  let style = doc.getElementById(PRINT_STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = PRINT_STYLE_ID;
    if (typeof doc.head?.appendChild === 'function') {
      doc.head.appendChild(style);
    }
  }
  style.textContent = getPrintStylesheetCss(settings);
  return style;
}
