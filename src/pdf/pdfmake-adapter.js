let pdfMakeInstance = null;

async function loadPdfMake() {
  if (pdfMakeInstance) {
    return pdfMakeInstance;
  }
  const pdfMakeModule = await import('pdfmake/build/pdfmake.js');
  const pdfFonts = await import('pdfmake/build/vfs_fonts.js');
  const pdfMake = pdfMakeModule.default || pdfMakeModule;
  pdfMake.vfs = pdfFonts.default || pdfFonts;
  // A1: só Roboto existe no vfs do pdfmake — a declaração `Courier` apontava
  // para TTFs inexistentes e todo codespan/code block abortava o export.
  // Código usa a fonte base com fundo de destaque (ver markdown-to-pdfmake).
  pdfMake.fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  };
  pdfMakeInstance = pdfMake;
  return pdfMakeInstance;
}

export async function createPdfDocument(docDefinition) {
  const pdfMake = await loadPdfMake();
  return pdfMake.createPdf(docDefinition);
}

// A3: o pdfmake não tem forma de cancelar um render. Se `getBuffer` nunca
// chamar o callback, a promise fica pendurada e o `finally` de
// exportPdfVector.js nunca executa — `resumeMermaidScheduling()` não é
// chamado e o mermaid fica mudo no resto da sessão. O timeout garante que a
// promise sempre assente.
const GET_BUFFER_TIMEOUT_MS = 30_000;

export async function getDocumentBuffer(docDefinition) {
  const doc = await createPdfDocument(docDefinition);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(`pdfmake não devolveu o buffer em ${GET_BUFFER_TIMEOUT_MS}ms`));
    }, GET_BUFFER_TIMEOUT_MS);
    doc.getBuffer((buffer) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(buffer);
    });
  });
}
