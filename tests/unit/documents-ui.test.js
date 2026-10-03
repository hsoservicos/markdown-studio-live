import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupDocumentManager, uniqueName } from '../../src/ui/documents-ui.js';
import {
  createDocument,
  setActive,
  getActiveDocument,
  getContent,
  setContent,
  listDocuments,
  deleteDocument,
} from '../../src/documents.js';
import { t, getDefaultTemplate } from '../../src/i18n/index.js';
import { pushSnapshot, listSnapshots } from '../../src/ui/snapshots.js';

function makeEditor(value = '') {
  let current = value;
  return {
    getValue: () => current,
    setValue: vi.fn((next) => {
      current = next;
    }),
    revealPosition: vi.fn(),
  };
}

function mountDom() {
  document.body.innerHTML = `
    <div class="sidebar-docs">
      <button id="doc-new-btn" type="button" aria-label="Novo documento"></button>
      <ul id="document-list" class="doc-list"></ul>
    </div>
  `;
}

function setup({ editorValue = '', confirm = () => true } = {}) {
  const editor = makeEditor(editorValue);
  const statuses = [];
  const api = setupDocumentManager({
    container: document,
    editor,
    getEditorContent: () => editor.getValue(),
    onStatus: (message) => statuses.push(message),
    confirm,
  });
  return { api, editor, statuses };
}

beforeEach(() => {
  localStorage.clear();
  mountDom();
});

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('uniqueName', () => {
  it('devolve o próprio nome quando não há colisão', () => {
    expect(uniqueName('Documento', [])).toBe('Documento');
    expect(uniqueName('  Documento  ', ['Outro'])).toBe('Documento');
  });

  it('P0: sufixa sem entrar em loop infinito quando o nome já existe', () => {
    expect(uniqueName('Documento', ['Documento'])).toBe('Documento (2)');
    expect(uniqueName('Documento', ['Documento', 'Documento (2)'])).toBe('Documento (3)');
  });

  it('ignora o nome atual ao renomear (evita sufixo espúrio)', () => {
    expect(uniqueName('Documento', ['Documento'], 'Documento')).toBe('Documento');
    expect(uniqueName('DOCUMENTO', ['documento'], 'documento')).toBe('DOCUMENTO');
  });

  it('cai no nome padrão quando o valor é vazio', () => {
    expect(uniqueName('   ', [])).toBeTruthy();
  });
});

describe('setupDocumentManager', () => {
  it('retorna null quando não há lista de documentos no DOM', () => {
    document.body.innerHTML = '';
    expect(setupDocumentManager({ container: document, editor: makeEditor() })).toBeNull();
  });

  it('marca o documento ativo com aria-current e o nome na lista', () => {
    const doc = createDocument({ title: 'Notas', initialContent: '# x' });
    setup();

    const items = document.querySelectorAll('.doc-item');
    expect(items).toHaveLength(1);
    expect(items[0].dataset.docId).toBe(doc.id);
    expect(items[0].getAttribute('aria-current')).toBe('true');
    expect(items[0].querySelector('.doc-name').textContent).toBe('Notas');
  });

  it('semeia o documento inicial com o conteúdo do editor, sem apagá-lo', () => {
    const { editor } = setup({ editorValue: '# template do boot' });

    expect(editor.setValue).not.toHaveBeenCalled();
    expect(editor.getValue()).toBe('# template do boot');
    expect(getContent(getActiveDocument().id)).toBe('# template do boot');
  });

  it('cria novo documento pelo botão, com nome único', () => {
    createDocument({ title: 'Documento', initialContent: '' });
    setup();

    document.querySelector('#doc-new-btn').click();
    document.querySelector('#doc-new-btn').click();

    expect(listDocuments()).toHaveLength(3);
    expect(listDocuments().map((d) => d.title)).toEqual([
      'Documento',
      'Documento (2)',
      'Documento (3)',
    ]);
    expect(document.querySelectorAll('.doc-item')).toHaveLength(3);
  });

  it('seleciona o documento ativo ao alternar e persiste o conteúdo anterior', () => {
    const a = createDocument({ title: 'A', initialContent: 'conteúdo A' });
    const b = createDocument({ title: 'B', initialContent: 'conteúdo B' });
    const { api, editor } = setup({ editorValue: 'editado em B' });

    api.switchTo(a.id);

    expect(editor.setValue).toHaveBeenCalledWith('conteúdo A');
    // O conteúdo que estava no editor foi salvo no documento que estava ativo.
    expect(getContent(b.id)).toBe('editado em B');
    expect(getActiveDocument().id).toBe(a.id);
    expect(api.getCurrent().id).toBe(a.id);
  });

  it('renomeia com trim', () => {
    const doc = createDocument({ title: 'Antes' });
    const { api } = setup();
    vi.spyOn(window, 'prompt').mockReturnValue('  Depois  ');

    api.rename(doc.id);

    expect(listDocuments()[0].title).toBe('Depois');
  });

  it('rejeita nome em branco mantendo o título anterior', () => {
    const doc = createDocument({ title: 'Antes' });
    const { api, statuses } = setup();
    vi.spyOn(window, 'prompt').mockReturnValue('   ');

    api.rename(doc.id);

    expect(listDocuments()[0].title).toBe('Antes');
    expect(statuses).toHaveLength(1);
  });

  it('sufixa nome duplicado no rename e reporta o conflito', () => {
    const a = createDocument({ title: 'A' });
    createDocument({ title: 'B' });
    const { api, statuses } = setup();
    vi.spyOn(window, 'prompt').mockReturnValue('B');

    api.rename(a.id);

    expect(listDocuments().map((d) => d.title)).toEqual(['B (2)', 'B']);
    expect(statuses.at(-1)).toContain('B (2)');
  });

  it('mantém o título quando o prompt é cancelado', () => {
    const doc = createDocument({ title: 'Antes' });
    const { api } = setup();
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    api.rename(doc.id);

    expect(listDocuments()[0].title).toBe('Antes');
  });

  it('M8: documento apagado durante o prompt não é anunciado como salvo', () => {
    createDocument({ title: 'A' });
    const b = createDocument({ title: 'B' });
    const { api, statuses } = setup();
    vi.spyOn(window, 'prompt').mockImplementation(() => {
      // outra aba apaga enquanto o prompt está aberto — a janela real de race
      deleteDocument(b.id);
      return 'B renomeado';
    });

    api.rename(b.id);

    // o guard só enxerga exceções; sem capturar o `false` do `updateTitle`
    // a UI teria anunciado o rename como gravado
    expect(statuses.at(-1)).toBe(t('docOpRefused'));
    expect(statuses.some((m) => m.includes('B renomeado'))).toBe(false);
    // a lista é recarregada e o documento fantasma some
    expect(listDocuments().map((d) => d.title)).toEqual(['A']);
    expect(document.querySelectorAll('.doc-item')).toHaveLength(1);
  });

  it('fecha o documento após confirmação e carrega o restante', () => {
    const a = createDocument({ title: 'A', initialContent: 'conteúdo A' });
    const b = createDocument({ title: 'B', initialContent: 'conteúdo B' });
    const { editor } = setup({ editorValue: 'conteúdo B' });
    expect(getActiveDocument().id).toBe(b.id);

    document.querySelector(`.doc-item[data-doc-id="${b.id}"] .doc-close-btn`).click();

    expect(listDocuments().map((d) => d.id)).toEqual([a.id]);
    expect(getContent(b.id)).toBeNull();
    expect(editor.setValue).toHaveBeenCalledWith('conteúdo A');
  });

  it('não fecha o documento quando o usuário cancela', () => {
    createDocument({ title: 'A' });
    createDocument({ title: 'B' });
    setup({ confirm: () => false });

    document.querySelector('.doc-close-btn').click();

    expect(listDocuments()).toHaveLength(2);
  });

  it('nunca fecha o último documento', () => {
    createDocument({ title: 'Único' });
    setup();

    document.querySelector('.doc-close-btn').click();

    expect(listDocuments()).toHaveLength(1);
  });

  it('é operável por teclado: Enter alterna e Delete fecha', () => {
    const a = createDocument({ title: 'A', initialContent: 'conteúdo A' });
    const b = createDocument({ title: 'B', initialContent: 'conteúdo B' });
    setActive(b.id);
    const { editor } = setup({ editorValue: 'conteúdo B' });

    const itemA = document.querySelector(`.doc-item[data-doc-id="${a.id}"]`);
    itemA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(editor.setValue).toHaveBeenCalledWith('conteúdo A');

    const itemB = document.querySelector(`.doc-item[data-doc-id="${b.id}"]`);
    itemB.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(listDocuments()).toHaveLength(1);
  });

  it('o botão de fechar da linha fecha aquela linha, sem trocar para ela', () => {
    const a = createDocument({ title: 'A', initialContent: 'conteúdo A' });
    const b = createDocument({ title: 'B', initialContent: 'conteúdo B' });
    const { editor } = setup({ editorValue: 'conteúdo B' });

    document.querySelector(`.doc-item[data-doc-id="${a.id}"] .doc-close-btn`).click();

    expect(listDocuments().map((d) => d.id)).toEqual([b.id]);
    expect(getActiveDocument().id).toBe(b.id);
    // M4: B já é o que está aberto. Recarregá-lo aqui seria `setValue` com o
    // mesmo texto — que limpa o undo stack do Monaco e joga o scroll para o
    // topo — só porque uma outra linha foi fechada.
    expect(editor.setValue).not.toHaveBeenCalled();
    // a lista foi re-renderizada mesmo sem recarregar o documento
    expect(document.querySelectorAll('.doc-item')).toHaveLength(1);
  });

  it('refresh re-renderiza a lista a partir do índice', () => {
    const { api } = setup();
    expect(document.querySelectorAll('.doc-item')).toHaveLength(1);

    createDocument({ title: 'Outro', initialContent: '' });
    api.refresh();

    expect(document.querySelectorAll('.doc-item')).toHaveLength(2);
  });

  it('persiste o conteúdo do documento ativo antes de criar outro', () => {
    const first = createDocument({ title: 'Primeiro', initialContent: '' });
    setContent(first.id, 'antigo');
    const { editor } = setup({ editorValue: 'antigo' });
    editor.setValue.mockImplementation(() => {});
    // simula edição viva no editor compartilhado
    editor.getValue = () => 'editado agora';

    document.querySelector('#doc-new-btn').click();

    expect(getContent(first.id)).toBe('editado agora');
  });
});

// F2: localStorage pode estourar a quota. Sem guard, a StorageError abortava o
// handler de evento em silêncio — o clique "não fazia nada" e a perda só
// aparecia no reload. O contrato é: não lançar, avisar no status, abortar.
describe('falha de escrita no localStorage', () => {
  function failWrites() {
    const err = new Error('quota');
    err.name = 'QuotaExceededError';
    return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw err;
    });
  }

  it('criação reporta quota no status e não lança', () => {
    createDocument({ title: 'A' });
    const { statuses } = setup();
    const before = listDocuments().length;
    failWrites();

    expect(() => document.querySelector('#doc-new-btn').click()).not.toThrow();

    expect(listDocuments()).toHaveLength(before);
    expect(statuses.at(-1)).toContain('armazenamento cheio');
  });

  it('troca de documento aborta quando o save anterior falha', () => {
    const a = createDocument({ title: 'A', initialContent: 'conteúdo A' });
    const b = createDocument({ title: 'B', initialContent: 'conteúdo B' });
    const { api, editor, statuses } = setup({ editorValue: 'editado em B' });
    expect(getActiveDocument().id).toBe(b.id);
    const setValueCalls = editor.setValue.mock.calls.length;
    failWrites();

    expect(() => api.switchTo(a.id)).not.toThrow();

    // não trocou: carregar A descartaria o "editado em B" que não foi salvo
    expect(editor.setValue.mock.calls).toHaveLength(setValueCalls);
    expect(getActiveDocument().id).toBe(b.id);
    expect(statuses.at(-1)).toContain('armazenamento cheio');
  });

  it('renomear reporta quota no status e mantém o título', () => {
    const doc = createDocument({ title: 'Antes' });
    const { api, statuses } = setup();
    vi.spyOn(window, 'prompt').mockReturnValue('Depois');
    failWrites();

    expect(() => api.rename(doc.id)).not.toThrow();

    expect(listDocuments()[0].title).toBe('Antes');
    expect(statuses.at(-1)).toContain('armazenamento cheio');
  });

  it('fecha documento reporta quota quando a gravação prévia falha', () => {
    createDocument({ title: 'A' });
    createDocument({ title: 'B' });
    const { statuses } = setup({ confirm: () => true });
    expect(listDocuments()).toHaveLength(2);
    failWrites();

    expect(() => document.querySelector('.doc-close-btn').click()).not.toThrow();

    // nada mudou: nem o save nem a remoção passaram
    expect(listDocuments()).toHaveLength(2);
    expect(statuses.at(-1)).toContain('armazenamento cheio');
  });
});

describe('B3/B4/B7 — renomear, fechar o último e recusa honesta', () => {
  it('B3: cada linha tem botão de renomear que aciona o prompt e grava o título', () => {
    createDocument({ title: 'A', initialContent: '' });
    setup();
    const renameBtn = document.querySelector('[data-doc-rename]');
    expect(renameBtn).toBeTruthy();
    expect(renameBtn.getAttribute('aria-label')).toBe(t('docRename'));
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Novo nome');
    renameBtn.click();
    expect(prompt).toHaveBeenCalled();
    expect(listDocuments()[0].title).toBe('Novo nome');
  });

  it('B4: fechar o último documento abre o template do idioma corrente', () => {
    const doc = createDocument({ title: 'Único', initialContent: '# conteúdo' });
    setActive(doc.id);
    const { editor } = setup();
    document.querySelector('[data-doc-close]').click();

    const docs = listDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe(t('docDefaultName'));
    expect(getContent(docs[0].id)).toBe(getDefaultTemplate());
    expect(editor.setValue).toHaveBeenCalledWith(getDefaultTemplate());
  });

  it('B7: deleteDocument false (documento sumiu no meio) reporta docOpRefused', () => {
    const doc = createDocument({ title: 'A', initialContent: 'x' });
    setActive(doc.id);
    const { statuses } = setup({
      // janela de corrida real: outra aba remove o doc enquanto o confirm
      // está aberto — o delete seguinte devolve false.
      confirm: () => {
        deleteDocument(doc.id);
        return true;
      },
    });
    document.querySelector('[data-doc-close]').click();
    expect(statuses).toContain(t('docOpRefused'));
  });

  it('B6: fechar documento migra os snapshots dele para o ativo seguinte', () => {
    const a = createDocument({ title: 'A', initialContent: 'x' });
    const b = createDocument({ title: 'B', initialContent: 'y' });
    setActive(a.id);
    setup();
    pushSnapshot('# snap de A', { ts: 1, docId: a.id });
    pushSnapshot('# snap de B', { ts: 2, docId: b.id });

    document.querySelector('[data-doc-close]').click();

    const list = listSnapshots();
    expect(list.find((s) => s.content === '# snap de A').docId).toBe(b.id);
    expect(list.find((s) => s.content === '# snap de B').docId).toBe(b.id);
  });
});
