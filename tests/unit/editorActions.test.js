import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resetMarkdownEditor,
  newMarkdownEditor,
  resolveBootInput,
  resolveDocumentBootInput,
  persistDraft,
} from '../../src/ui/editorActions.js';
import { NAMESPACE, KEYS } from '../../src/i18n/index.js';
import { getItem, setItem } from '../../src/storage.js';

function makeEditor(value) {
  let current = value;
  return {
    getValue: () => current,
    setValue: (next) => {
      current = next;
    },
    revealPosition: vi.fn(),
    focus: vi.fn(),
  };
}

describe('resetMarkdownEditor', () => {
  const defaultInput = '<h1>Template</h1>';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('remove o rascunho persistido (last_state) ao resetar', () => {
    setItem(NAMESPACE, KEYS.lastState, 'rascunho antigo');
    const editor = makeEditor('rascunho antigo');
    const scrollTop = vi.fn();

    const ok = resetMarkdownEditor({
      editor,
      defaultInput,
      hasEdited: true,
      confirm: () => true,
      scrollTop,
    });

    expect(ok).toBe(true);
    expect(editor.getValue()).toBe(defaultInput);
    expect(editor.focus).toHaveBeenCalled();
    expect(scrollTop).toHaveBeenCalled();
    expect(getItem(NAMESPACE, KEYS.lastState)).toBeNull();
  });

  it('não remove o rascunho quando o usuário cancela', () => {
    setItem(NAMESPACE, KEYS.lastState, 'rascunho antigo');
    const editor = makeEditor('rascunho antigo');

    const ok = resetMarkdownEditor({
      editor,
      defaultInput,
      hasEdited: true,
      confirm: () => false,
    });

    expect(ok).toBe(false);
    expect(editor.getValue()).toBe('rascunho antigo');
    expect(getItem(NAMESPACE, KEYS.lastState)).toBe('rascunho antigo');
  });

  it('não pede confirmação quando nada foi editado ou alterado', () => {
    const editor = makeEditor(defaultInput);
    const confirm = vi.fn(() => false);

    const ok = resetMarkdownEditor({
      editor,
      defaultInput,
      hasEdited: false,
      confirm,
    });

    expect(ok).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('resolveBootInput', () => {
  const defaultInput = '<h1>Template</h1>';
  const isUntouchedTemplate = (v) => v === 'PT' || v === 'EN';

  it('usa o template quando não há rascunho', () => {
    expect(resolveBootInput({ lastContent: null, defaultInput, isUntouchedTemplate })).toBe(
      defaultInput,
    );
  });

  it('usa o template quando o rascunho é vazio', () => {
    expect(resolveBootInput({ lastContent: '', defaultInput, isUntouchedTemplate })).toBe(
      defaultInput,
    );
  });

  it('usa o template quando o rascunho é um template não editado', () => {
    expect(resolveBootInput({ lastContent: 'PT', defaultInput, isUntouchedTemplate })).toBe(
      defaultInput,
    );
    expect(resolveBootInput({ lastContent: 'EN', defaultInput, isUntouchedTemplate })).toBe(
      defaultInput,
    );
  });

  it('restaura o rascunho editado no boot', () => {
    expect(resolveBootInput({ lastContent: '# rascunho', defaultInput, isUntouchedTemplate })).toBe(
      '# rascunho',
    );
  });
});

describe('resolveDocumentBootInput', () => {
  const defaultInput = '<h1>Template</h1>';
  const isUntouchedTemplate = (v) => v === 'PT' || v === 'EN';
  const resolve = (overrides = {}) =>
    resolveDocumentBootInput({ defaultInput, isUntouchedTemplate, documentCount: 1, ...overrides });

  it('P0: rascunho mais recente vence o conteúdo congelado do único documento', () => {
    expect(resolve({ lastContent: '# Sessão 2', docContent: '# Sessão 1' })).toBe('# Sessão 2');
  });

  it('com mais de um documento, o conteúdo do doc ativo vence o rascunho legado', () => {
    expect(
      resolve({ lastContent: '# outro doc', docContent: '# doc ativo', documentCount: 2 }),
    ).toBe('# doc ativo');
  });

  it('usa o conteúdo do documento quando não há rascunho', () => {
    expect(resolve({ lastContent: null, docContent: '# documento' })).toBe('# documento');
  });

  it('ignora conteúdo de documento que é template não editado', () => {
    expect(resolve({ lastContent: null, docContent: 'PT' })).toBe(defaultInput);
  });

  it('cai no template quando não há rascunho nem conteúdo', () => {
    expect(resolve({ lastContent: null, docContent: null })).toBe(defaultInput);
  });

  it('preserva documento vazio (novo arquivo) em vez de cair no template', () => {
    expect(resolve({ lastContent: null, docContent: '' })).toBe('');
  });

  it('M6: rascunho legado não vaza para um documento de template com 2+ docs', () => {
    // `persistDraft` não grava template, então `last_state` ainda guarda o
    // texto do documento anterior — e ele não pode ser injetado aqui.
    expect(
      resolve({ lastContent: '# texto de outro doc', docContent: 'PT', documentCount: 2 }),
    ).toBe(defaultInput);
  });

  it('M6: com 2+ docs e conteúdo ilegível, cai no template e não no rascunho', () => {
    expect(resolve({ lastContent: '# sessão antiga', docContent: null, documentCount: 2 })).toBe(
      defaultInput,
    );
  });

  it('M6: com 1 doc o legado de documento único continua prevalecendo', () => {
    expect(resolve({ lastContent: '# sessão', docContent: null, documentCount: 1 })).toBe(
      '# sessão',
    );
    expect(resolve({ lastContent: '# sessão', docContent: 'PT', documentCount: 1 })).toBe(
      '# sessão',
    );
  });
});

describe('persistDraft', () => {
  const isUntouchedTemplate = (v) => v === 'PT' || v === 'EN';

  it('P0: grava o rascunho no last_state E no conteúdo do documento ativo', () => {
    const setDraft = vi.fn();
    const saveDocContent = vi.fn();

    const persisted = persistDraft('# nova edição', {
      isUntouchedTemplate,
      setDraft,
      getActiveDocId: () => 'doc-1',
      saveDocContent,
    });

    expect(persisted).toBe(true);
    expect(setDraft).toHaveBeenCalledWith('# nova edição');
    expect(saveDocContent).toHaveBeenCalledWith('doc-1', '# nova edição');
  });

  it('grava apenas last_state quando não há documento ativo (migração de 1º boot)', () => {
    const setDraft = vi.fn();
    const saveDocContent = vi.fn();

    persistDraft('# rascunho', {
      isUntouchedTemplate,
      setDraft,
      getActiveDocId: () => null,
      saveDocContent,
    });

    expect(setDraft).toHaveBeenCalledWith('# rascunho');
    expect(saveDocContent).not.toHaveBeenCalled();
  });

  it('não persiste template não editado e não avança o anel de snapshots', () => {
    const setDraft = vi.fn();
    const saveDocContent = vi.fn();

    const persisted = persistDraft('PT', {
      isUntouchedTemplate,
      setDraft,
      getActiveDocId: () => 'doc-1',
      saveDocContent,
    });

    expect(persisted).toBe(false);
    expect(setDraft).not.toHaveBeenCalled();
    expect(saveDocContent).not.toHaveBeenCalled();
  });
});

describe('newMarkdownEditor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('limpa o editor e volta ao topo', () => {
    const editor = makeEditor('# Conteúdo');
    const scrollTop = vi.fn();

    const ok = newMarkdownEditor({
      editor,
      hasEdited: true,
      confirm: () => true,
      scrollTop,
    });

    expect(ok).toBe(true);
    expect(editor.getValue()).toBe('');
    expect(editor.focus).toHaveBeenCalled();
    expect(scrollTop).toHaveBeenCalled();
  });

  it('mantém o conteúdo quando o usuário cancela', () => {
    const editor = makeEditor('# Conteúdo');

    const ok = newMarkdownEditor({
      editor,
      hasEdited: true,
      confirm: () => false,
    });

    expect(ok).toBe(false);
    expect(editor.getValue()).toBe('# Conteúdo');
  });
});
