import { NAMESPACE, KEYS } from '../i18n/index.js';
import { removeItem } from '../storage.js';

export function resolveBootInput({ lastContent, defaultInput, isUntouchedTemplate }) {
  return !lastContent || isUntouchedTemplate(lastContent) ? defaultInput : lastContent;
}

/**
 * Resolve o conteúdo de boot quando já existe um índice de documentos.
 *
 * O conteúdo do documento ativo é a fonte da verdade (AC-P2-10-1). A única
 * exceção é o legado de documento único SEM conteúdo persistido
 * (`docContent == null`): versões anteriores gravavam as edições apenas em
 * `last_state`, e nesse cenário — e só nele — o rascunho é a edição mais
 * recente e tem precedência. Com conteúdo presente, um rascunho de um
 * documento fechado nunca pode contaminar o ativo.
 *
 * @param {{ lastContent: string|null, docContent: string|null, documentCount?: number, defaultInput: string, isUntouchedTemplate: (value: string) => boolean }} opts
 * @returns {string} conteúdo a carregar no editor
 */
export function resolveDocumentBootInput({
  lastContent,
  docContent,
  documentCount = 0,
  defaultInput,
  isUntouchedTemplate,
}) {
  const draft = lastContent && !isUntouchedTemplate(lastContent) ? lastContent : null;

  // B1 (AC-P2-10-1): `documents.content.*` é a fonte da verdade no boot. O
  // `draft` de `last_state` só entra quando NÃO existe conteúdo persistido do
  // documento (migração legada de documento único) — com conteúdo presente,
  // um rascunho de um documento FECHADO não pode contaminar o remanescente
  // (o skip de template do `persistDraft` mantém em `last_state` o texto do
  // documento anterior ao trocar para um doc de template).
  if (documentCount === 1 && docContent == null && draft) {
    return draft;
  }
  if (docContent != null && !isUntouchedTemplate(docContent)) {
    return docContent;
  }
  // Com mais de um documento o rascunho não tem como ser atribuído ao ativo;
  // o template é a resposta que não contamina nada.
  return defaultInput;
}

/**
 * Persiste um rascunho do editor. Grava (1) `last_state` — contrato legado, usado
 * pela migração de primeiro boot — e (2) o conteúdo do documento ativo, que é o
 * que o boot lê. Sem (2) as edições eram descartadas no reload e `last_state`
 * acabava sobrescrito com o conteúdo congelado do documento.
 *
 * Templates não editados não são gravados: é o que faz a troca de idioma devolver
 * o template do idioma corrente em vez do outro.
 *
 * @param {string} value
 * @param {{ isUntouchedTemplate: (value: string) => boolean, setDraft: (value: string) => void, getActiveDocId?: () => string|null, saveDocContent?: (id: string, value: string) => void }} opts
 * @returns {boolean} `true` quando algo foi persistido (o anel de snapshots só avança então)
 */
export function persistDraft(
  value,
  { isUntouchedTemplate, setDraft, getActiveDocId, saveDocContent },
) {
  if (isUntouchedTemplate(value)) {
    return false;
  }
  setDraft(value);
  const docId = getActiveDocId?.();
  if (docId) {
    saveDocContent?.(docId, value);
  }
  return true;
}

export function resetMarkdownEditor({
  editor,
  defaultInput,
  hasEdited = false,
  confirm = () => true,
  scrollTop = () => {},
}) {
  const changed = editor.getValue() !== defaultInput;
  if (hasEdited || changed) {
    if (!confirm()) {
      return false;
    }
  }
  editor.setValue(defaultInput);
  editor.revealPosition({ lineNumber: 1, column: 1 });
  editor.focus();
  // A2: remove o rascunho persistido para que um reload volte ao template do
  // idioma corrente em vez de restaurar o conteúdo antigo.
  removeItem(NAMESPACE, KEYS.lastState);
  scrollTop();
  return true;
}
