import { NAMESPACE, KEYS } from '../i18n/index.js';
import { removeItem } from '../storage.js';

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

export function newMarkdownEditor({
  editor,
  hasEdited = false,
  confirm = () => true,
  scrollTop = () => {},
}) {
  if (hasEdited || editor.getValue() !== '') {
    if (!confirm()) {
      return false;
    }
  }
  editor.setValue('');
  editor.revealPosition({ lineNumber: 1, column: 1 });
  editor.focus();
  scrollTop();
  return true;
}
