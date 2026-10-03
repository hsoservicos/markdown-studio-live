// Chave do modo "PDF vetorial" (pdfmake) no localStorage.
//
// Fica num módulo próprio por dois motivos:
// 1. `exportPdf.js` e `exportPdfVector.js` declaravam a mesma constante — o
//    valor era literal em dois lugares e podia divergir sem ninguém perceber.
// 2. `exportPdf.js` precisa ler a flag **sem** importar `exportPdfVector.js`,
//    que é carregado sob demanda justamente para não embutir o pdfmake no
//    bundle principal.
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
    // storage indisponível — a preferência não persiste
  }
}
