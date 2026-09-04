import { setItem, removeItem, safeGet, StorageError } from './storage.js';
import { NAMESPACE } from './i18n/index.js';

export const INDEX_VERSION = 1;
export const INDEX_KEY = 'documents';
export const CONTENT_KEY = 'documents.content';

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function contentKeyFor(id) {
  return `${CONTENT_KEY}.${id}`;
}

function normalizeDocuments(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const item of list) {
    if (!item || typeof item.id !== 'string' || !item.id) continue;
    const existing = byId.get(item.id);
    if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
      byId.set(item.id, { id: item.id, title: item.title || '', updatedAt: item.updatedAt || 0 });
    }
  }
  return Array.from(byId.values());
}

export function freshIndex() {
  return { version: INDEX_VERSION, activeId: null, documents: [] };
}

export function safeGetIndex() {
  const raw = safeGet(NAMESPACE, INDEX_KEY, { type: 'object', defaultValue: null });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return freshIndex();
  }
  const documents = normalizeDocuments(raw.documents);
  let activeId = typeof raw.activeId === 'string' && raw.activeId ? raw.activeId : null;
  if (activeId && !documents.some((d) => d.id === activeId)) {
    activeId = documents.length ? documents[0].id : null;
  }
  return { version: INDEX_VERSION, activeId, documents };
}

function saveIndex(index) {
  try {
    setItem(NAMESPACE, INDEX_KEY, index);
  } catch (e) {
    const err =
      e instanceof StorageError ? e : new StorageError('Falha ao gravar índice de documentos.', e);
    if (!err.code) err.code = classifyError(e);
    throw err;
  }
}

export function listDocuments() {
  return safeGetIndex().documents;
}

export function getActiveDocument() {
  const index = safeGetIndex();
  const found = index.documents.find((d) => d.id === index.activeId);
  return found || index.documents[0] || null;
}

export function getDocumentById(id) {
  const index = safeGetIndex();
  return index.documents.find((d) => d.id === id) || null;
}

export function getContent(id) {
  return safeGet(NAMESPACE, contentKeyFor(id), { type: 'string', defaultValue: null });
}

function classifyError(e) {
  const cause = e && e.cause;
  const name = (cause && cause.name) || (e && e.name);
  if (name === 'QuotaExceededError') return 'quota';
  if (name === 'SecurityError') return 'security';
  return 'generic';
}

/**
 * Gravação atômica de duas chaves: índice + um valor por id.
 * Se a segunda gravação falhar, reverte a primeira ao valor anterior.
 * Lança um erro com a propriedade `code` ('quota' | 'security' | 'generic') que a
 * camada de UI usa para escolher a mensagem i18n.
 */
function atomicWrite(previousIndexValue, nextIndexValue, key, nextValue) {
  try {
    setItem(NAMESPACE, INDEX_KEY, nextIndexValue);
    try {
      setItem(NAMESPACE, key, nextValue);
    } catch (e) {
      try {
        if (previousIndexValue == null) {
          removeItem(NAMESPACE, INDEX_KEY);
        } else {
          setItem(NAMESPACE, INDEX_KEY, previousIndexValue);
        }
      } catch {
        // rollback é best-effort; o erro original abaixo prevalece
      }
      const err = new StorageError('Gravação de documento falhou; alteração revertida.', e);
      err.code = classifyError(e);
      throw err;
    }
  } catch (e) {
    const err = e instanceof StorageError ? e : new StorageError('Falha ao gravar documento.', e);
    if (!err.code) err.code = classifyError(e);
    throw err;
  }
}

export function createDocument({ title = 'Documento', initialContent = '' } = {}) {
  const id = createId();
  const now = Date.now();
  const current = safeGetIndex();
  const previousDocuments = current.documents;
  const next = {
    version: INDEX_VERSION,
    activeId: id,
    documents: [...previousDocuments, { id, title: title || 'Documento', updatedAt: now }],
  };
  atomicWrite(current, next, contentKeyFor(id), initialContent);
  return { id, title: title || 'Documento', updatedAt: now };
}

export function updateTitle(id, title) {
  const index = safeGetIndex();
  const doc = index.documents.find((d) => d.id === id);
  if (!doc) return false;
  const next = {
    ...index,
    documents: index.documents.map((d) =>
      d.id === id ? { ...d, title: title || d.title, updatedAt: Date.now() } : d,
    ),
  };
  saveIndex(next);
  return true;
}

export function setActive(id) {
  const index = safeGetIndex();
  if (!index.documents.some((d) => d.id === id)) return false;
  saveIndex({ ...index, activeId: id });
  return true;
}

export function deleteDocument(id) {
  const index = safeGetIndex();
  const remaining = index.documents.filter((d) => d.id !== id);
  if (remaining.length === index.documents.length) return false;
  let activeId = index.activeId;
  if (activeId === id) {
    const nextActive = remaining[0] || null;
    activeId = nextActive ? nextActive.id : null;
  }
  saveIndex({ ...index, documents: remaining, activeId });
  try {
    removeItem(NAMESPACE, contentKeyFor(id));
  } catch {
    // conteúdo órfão tolerado na deleção; índice já atualizado
  }
  return true;
}

export function setContent(id, value) {
  setItem(NAMESPACE, contentKeyFor(id), value);
  const index = safeGetIndex();
  const next = {
    ...index,
    documents: index.documents.map((d) => (d.id === id ? { ...d, updatedAt: Date.now() } : d)),
  };
  try {
    saveIndex(next);
  } catch (e) {
    const err =
      e instanceof StorageError
        ? e
        : new StorageError('Falha ao atualizar índice após conteúdo.', e);
    err.code = classifyError(e);
    throw err;
  }
  return true;
}
