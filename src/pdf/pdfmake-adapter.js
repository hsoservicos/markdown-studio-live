let pdfMakeInstance = null;
let fontsConfigured = false;

async function loadPdfMake() {
  if (pdfMakeInstance) {
    return pdfMakeInstance;
  }
  const pdfMakeModule = await import('pdfmake/build/pdfmake.js');
  const pdfFonts = await import('pdfmake/build/vfs_fonts.js');
  const pdfMake = pdfMakeModule.default || pdfMakeModule;
  pdfMake.vfs = pdfFonts.default || pdfFonts;
  pdfMake.fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
    Courier: {
      normal: 'Courier-Regular.ttf',
      bold: 'Courier-Bold.ttf',
      italics: 'Courier-Oblique.ttf',
      bolditalics: 'Courier-BoldOblique.ttf',
    },
  };
  fontsConfigured = true;
  pdfMakeInstance = pdfMake;
  return pdfMakeInstance;
}

export function isPdfMakeAvailable() {
  return pdfMakeInstance != null && fontsConfigured;
}

export async function createPdfDocument(docDefinition) {
  const pdfMake = await loadPdfMake();
  return pdfMake.createPdf(docDefinition);
}

export async function getDocumentBuffer(docDefinition) {
  const doc = await createPdfDocument(docDefinition);
  return new Promise((resolve) => {
    doc.getBuffer((buffer) => {
      resolve(buffer);
    });
  });
}
