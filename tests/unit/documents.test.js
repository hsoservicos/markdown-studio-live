import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createId,
  safeGetIndex,
  freshIndex,
  listDocuments,
  getActiveDocument,
  getDocumentById,
  getContent,
  createDocument,
  updateTitle,
  setActive,
  deleteDocument,
  setContent,
  INDEX_KEY,
  CONTENT_KEY,
  INDEX_VERSION,
} from '../../src/documents.js';
import { NAMESPACE, KEYS } from '../../src/i18n/index.js';
import { getItem, setItem, removeItem } from '../../src/storage.js';
import {
  resolveBootInput,
  resolveDocumentBootInput,
  persistDraft,
} from '../../src/ui/editorActions.js';

function store() {
  return globalThis.localStorage;
}

beforeEach(() => {
  store().clear();
});
afterEach(() => {
  store().clear();
});

describe('documents layer', () => {
  it('createId gera UUID quando disponível', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'abc-123' });
    expect(createId()).toBe('abc-123');
    vi.unstubAllGlobals();
  });

  it('createId usa fallback quando crypto.randomUUID indisponível', () => {
    vi.stubGlobal('crypto', undefined);
    const id = createId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(id).not.toBe('abc-123');
    vi.unstubAllGlobals();
  });

  it('safeGetIndex retorna índice vazio quando ausente', () => {
    const idx = safeGetIndex();
    expect(idx).toEqual(freshIndex());
    expect(idx.version).toBe(INDEX_VERSION);
    expect(idx.documents).toEqual([]);
  });

  it('cria documento e o torna ativo', () => {
    const doc = createDocument({ title: 'Rascunho', initialContent: 'x' });
    expect(doc).toMatchObject({ title: 'Rascunho' });
    expect(doc.id).toBeTruthy();
    const index = safeGetIndex();
    expect(index.activeId).toBe(doc.id);
    expect(index.documents).toHaveLength(1);
    expect(getContent(doc.id)).toBe('x');
    expect(getActiveDocument()).toMatchObject({ id: doc.id, title: 'Rascunho' });
  });

  it('round-trip de conteúdo é exato', () => {
    const doc = createDocument({ title: 'A', initialContent: '' });
    const content = 'novo\nconteúdo **markdown**';
    setContent(doc.id, content);
    expect(getContent(doc.id)).toBe(content);
  });

  it('listDocuments reflete documentos criados', () => {
    const d1 = createDocument({ title: 'Um' });
    const d2 = createDocument({ title: 'Dois' });
    expect(listDocuments().map((d) => d.title)).toEqual(['Um', 'Dois']);
    expect(listDocuments().map((d) => d.id)).toContain(d1.id);
    expect(listDocuments().map((d) => d.id)).toContain(d2.id);
  });

  it('setActive alterna o documento ativo', () => {
    const d1 = createDocument({ title: 'Um' });
    const d2 = createDocument({ title: 'Dois' });
    expect(setActive(d1.id)).toBe(true);
    expect(getActiveDocument().id).toBe(d1.id);
    expect(setActive(d2.id)).toBe(true);
    expect(getActiveDocument().id).toBe(d2.id);
    expect(setActive('inexistente')).toBe(false);
  });

  it('updateTitle renomeia e atualiza timestamp', () => {
    const doc = createDocument({ title: 'Antes' });
    expect(updateTitle(doc.id, 'Depois')).toBe(true);
    expect(getDocumentById(doc.id).title).toBe('Depois');
    expect(updateTitle('inexistente', 'X')).toBe(false);
  });

  it('deleteDocument remove índice e conteúdo; promove próximo quando ativo', () => {
    const d1 = createDocument({ title: 'Um' });
    const d2 = createDocument({ title: 'Dois' });
    setActive(d1.id);
    expect(deleteDocument(d1.id)).toBe(true);
    expect(getDocumentById(d1.id)).toBeNull();
    expect(getContent(d1.id)).toBeNull();
    expect(getActiveDocument().id).toBe(d2.id);
    expect(deleteDocument('inexistente')).toBe(false);
  });

  it('safeGetIndex deduplica ids mantendo o maior updatedAt', () => {
    store().setItem(
      `${NAMESPACE}.${INDEX_KEY}`,
      JSON.stringify({
        value: {
          version: 1,
          activeId: 'aa',
          documents: [
            { id: 'aa', title: 'antigo', updatedAt: 100 },
            { id: 'aa', title: 'novo', updatedAt: 200 },
            { id: 'bb', title: 'outro', updatedAt: 150 },
          ],
        },
        expiresAt: new Date(2099, 1, 1).getTime(),
      }),
    );
    const index = safeGetIndex();
    expect(index.documents.map((d) => d.id)).toEqual(['aa', 'bb']);
    expect(index.documents.find((d) => d.id === 'aa').title).toBe('novo');
  });

  it('safeGetIndex corrige activeId órfão para o primeiro documento', () => {
    store().setItem(
      `${NAMESPACE}.${INDEX_KEY}`,
      JSON.stringify({
        value: {
          version: 1,
          activeId: 'zz',
          documents: [{ id: 'aa', title: 'Um', updatedAt: 100 }],
        },
        expiresAt: new Date(2099, 1, 1).getTime(),
      }),
    );
    const index = safeGetIndex();
    expect(index.activeId).toBe('aa');
  });

  it('safeGetIndex tolera índice não-objeto e inválido', () => {
    store().setItem(
      `${NAMESPACE}.${INDEX_KEY}`,
      JSON.stringify({ value: 'not-an-object', expiresAt: new Date(2099, 1, 1).getTime() }),
    );
    expect(safeGetIndex()).toEqual(freshIndex());
  });

  it('setContent em índice corrompido grava conteúdo e reinicia índice', () => {
    const doc = createDocument({ title: 'Um', initialContent: '' });
    store().setItem(
      `${NAMESPACE}.${INDEX_KEY}`,
      JSON.stringify({ value: null, expiresAt: new Date(2099, 1, 1).getTime() }),
    );
    setContent(doc.id, 'valor persistido');
    expect(getContent(doc.id)).toBe('valor persistido');
    expect(safeGetIndex().documents).toEqual([]);
  });

  it('gravação atômica reverte índice quando conteúdo falha', () => {
    installThrowingStorage('QuotaExceededError');
    let caught;
    try {
      createDocument({ title: 'A', initialContent: 'x' });
    } catch (err) {
      caught = err;
    }
    restoreStorage();
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('quota');
    expect(safeGetIndex()).toEqual(freshIndex());
  });

  it('SecurityError é classificado com code security e não corrompe', () => {
    installThrowingStorage('SecurityError');
    let caught;
    try {
      createDocument({ title: 'A' });
    } catch (err) {
      caught = err;
    }
    restoreStorage();
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('security');
  });

  it('quotaExceeded preserva a última versão salva (conteúdo anterior intacto)', () => {
    const doc = createDocument({ title: 'A', initialContent: 'versão anterior' });
    expect(getContent(doc.id)).toBe('versão anterior');
    installThrowingStorage('QuotaExceededError');
    let caught;
    try {
      setContent(doc.id, 'novo conteudo');
    } catch (err) {
      caught = err;
    }
    restoreStorage();
    expect(caught).toBeTruthy();
    expect(getContent(doc.id)).toBe('versão anterior');
  });

  it('fonte do índice (índice falha) também reporta erro tipado com code', () => {
    installIndexThrowingStorage('QuotaExceededError');
    let caught;
    try {
      createDocument({ title: 'A' });
    } catch (err) {
      caught = err;
    }
    restoreStorage();
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('quota');
  });
});

/**
 * Regressão P0: as edições eram gravadas apenas em `last_state`, enquanto o boot
 * lia o conteúdo do documento ativo — que ficava congelado no momento da
 * migração. Estes testes exercitam o ciclo completo (digitação → reload) sobre os
 * módulos reais de storage/documentos, não sobre mocks.
 */
describe('ciclo de persistência entre sessões (regressão P0)', () => {
  const defaultInput = '# Template';
  const isUntouchedTemplate = (v) => v === defaultInput;

  // Liga o núcleo puro aos módulos reais — mesmo wiring do scheduleSave.
  const wire = () => ({
    isUntouchedTemplate,
    setDraft: (v) => setItem(NAMESPACE, KEYS.lastState, v),
    getActiveDocId: () => getActiveDocument()?.id ?? null,
    saveDocContent: (id, v) => setContent(id, v),
  });

  // Espelha a decisão de boot do src/main.js.
  const boot = () => {
    const lastContent = getItem(NAMESPACE, KEYS.lastState, { type: 'string' });
    const index = safeGetIndex();
    if (index.documents.length > 0) {
      const active = getActiveDocument();
      return resolveDocumentBootInput({
        lastContent,
        docContent: active ? getContent(active.id) : null,
        documentCount: index.documents.length,
        defaultInput,
        isUntouchedTemplate,
      });
    }
    return resolveBootInput({ lastContent, defaultInput, isUntouchedTemplate });
  };

  it('não perde edições depois que a migração cria o documento', () => {
    // sessão 1 — sem índice: só há rascunho em last_state.
    expect(boot()).toBe(defaultInput);
    persistDraft('# Sessão 1', wire());
    expect(boot()).toBe('# Sessão 1');

    // sessão 2 (reload) — o boot migra last_state para um documento.
    createDocument({
      title: 'Documento restaurado',
      initialContent: getItem(NAMESPACE, KEYS.lastState, { type: 'string' }),
    });
    expect(boot()).toBe('# Sessão 1');

    // sessão 2 — o usuário edita de novo.
    persistDraft('# Sessão 2', wire());

    // A edição precisa ter chegado ao conteúdo do documento (write path), e
    // não apenas a `last_state` — era exatamente isso que estava faltando.
    expect(getContent(getActiveDocument().id)).toBe('# Sessão 2');

    // sessão 3 (reload) — a edição da sessão 2 precisa sobreviver.
    expect(boot()).toBe('# Sessão 2');
  });

  it('mantém last_state e o conteúdo do documento em sincronia a cada edição', () => {
    const doc = createDocument({ title: 'Doc', initialContent: '' });
    persistDraft('# alinhado', wire());
    expect(getContent(doc.id)).toBe('# alinhado');
    expect(getItem(NAMESPACE, KEYS.lastState, { type: 'string' })).toBe('# alinhado');
  });

  it('reset não ressuscita o conteúdo descartado no próximo boot', () => {
    const doc = createDocument({ title: 'Documento restaurado', initialContent: '# antigo' });
    persistDraft('# antigo', wire());

    // O que reset() + resetMarkdownEditor() fazem.
    setContent(doc.id, defaultInput);
    removeItem(NAMESPACE, KEYS.lastState);

    expect(boot()).toBe(defaultInput);
  });
});

let originalStorage;
function installThrowingStorage(errorName) {
  const real = globalThis.localStorage;
  originalStorage = real;
  const proxy = new Proxy(real, {
    get(target, prop) {
      if (prop === 'setItem') {
        return (key, value) => {
          if (String(key).includes(`${CONTENT_KEY}.`)) {
            const e = new Error(errorName);
            e.name = errorName;
            throw e;
          }
          return target.setItem(key, value);
        };
      }
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: proxy });
}
function installIndexThrowingStorage(errorName) {
  const real = globalThis.localStorage;
  originalStorage = real;
  const proxy = new Proxy(real, {
    get(target, prop) {
      if (prop === 'setItem') {
        return (key, value) => {
          if (String(key).endsWith(`${INDEX_KEY}`)) {
            const e = new Error(errorName);
            e.name = errorName;
            throw e;
          }
          return target.setItem(key, value);
        };
      }
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: proxy });
}
function restoreStorage() {
  if (originalStorage) {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalStorage,
    });
    originalStorage = undefined;
  }
}
