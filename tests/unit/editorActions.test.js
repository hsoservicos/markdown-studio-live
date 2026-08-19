import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resetMarkdownEditor,
  newMarkdownEditor,
  resolveBootInput,
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
