const DEFAULT_EXPIRY = new Date(2099, 1, 1);

export class StorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

function safeNow() {
  return Date.now();
}

function isExpired(entry) {
  return entry.expiresAt != null && Number(entry.expiresAt) <= safeNow();
}

const BOOLEAN_LEGACY = { true: true, false: false, 1: true, 0: false };

function validateValue(fullKey, value, type) {
  if (value == null) {
    return value;
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string' && value in BOOLEAN_LEGACY) {
      return BOOLEAN_LEGACY[value];
    }
    throw new StorageError(`Valor inválido para '${fullKey}': esperado booleano`);
  }
  if (type === 'string' && typeof value !== 'string') {
    throw new StorageError(`Valor inválido para '${fullKey}': esperado string`);
  }
  if (type === 'number' && typeof value !== 'number') {
    throw new StorageError(`Valor inválido para '${fullKey}': esperado número`);
  }
  return value;
}

/**
 * Lê o valor do storage aplicando validação opcional de tipo na fronteira.
 * Fragmentos corrompidos (schema inesperado) lançam `StorageError` em vez de
 * restaurarem silenciosamente — cabe ao chamador decidir o fallback.
 */
export function getItem(namespace, key, { type } = {}) {
  const fullKey = `${namespace}.${key}`;
  let raw;
  try {
    raw = localStorage.getItem(fullKey);
  } catch (e) {
    throw new StorageError(`Falha ao ler '${fullKey}' do localStorage`, e);
  }
  if (raw == null) {
    return null;
  }
  let value;
  try {
    const entry = JSON.parse(raw);
    if (entry && typeof entry === 'object' && 'value' in entry) {
      if (isExpired(entry)) {
        removeItem(namespace, key);
        return null;
      }
      value = entry.value;
    } else {
      // valor legado não-JSON → devolve como está
      value = raw;
    }
  } catch {
    // valor legado não-JSON → devolve como está
    value = raw;
  }
  return validateValue(fullKey, value, type);
}

export function setItem(namespace, key, value, expiresAt = DEFAULT_EXPIRY) {
  const fullKey = `${namespace}.${key}`;
  const entry = {
    value,
    expiresAt: expiresAt instanceof Date ? expiresAt.getTime() : expiresAt,
  };
  try {
    localStorage.setItem(fullKey, JSON.stringify(entry));
  } catch (e) {
    throw new StorageError(`Falha ao gravar '${fullKey}' no localStorage`, e);
  }
}

export function removeItem(namespace, key) {
  try {
    localStorage.removeItem(`${namespace}.${key}`);
  } catch (e) {
    throw new StorageError(`Falha ao remover '${namespace}.${key}' do localStorage`, e);
  }
}

export function getRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    throw new StorageError(`Falha ao ler '${key}' do localStorage`, e);
  }
}

export function setRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    throw new StorageError(`Falha ao gravar '${key}' no localStorage`, e);
  }
}
