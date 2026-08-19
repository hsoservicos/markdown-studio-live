import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getItem, setItem, removeItem, getRaw, setRaw, StorageError } from '../../src/storage.js';
import { NAMESPACE, KEYS } from '../../src/i18n/index.js';

function store() {
  return globalThis.localStorage;
}

describe('storage wrapper', () => {
  beforeEach(() => {
    store().clear();
  });
  afterEach(() => {
    store().clear();
  });

  it('persiste e restaura valor string', () => {
    setItem(NAMESPACE, KEYS.lastState, '# título');
    expect(getItem(NAMESPACE, KEYS.lastState)).toBe('# título');
  });

  it('persiste e restaura boolean', () => {
    setItem(NAMESPACE, KEYS.theme, true);
    expect(getItem(NAMESPACE, KEYS.theme)).toBe(true);
  });

  it('retorna null para chave ausente', () => {
    expect(getItem(NAMESPACE, 'nao-existe')).toBeNull();
  });

  it('removeItem apaga a chave', () => {
    setItem(NAMESPACE, KEYS.scrollBar, true);
    removeItem(NAMESPACE, KEYS.scrollBar);
    expect(getItem(NAMESPACE, KEYS.scrollBar)).toBeNull();
  });

  it('getRaw/setRaw operam com chave crua (boot do tema)', () => {
    setRaw(KEYS.themeBoot, 'dark');
    expect(getRaw(KEYS.themeBoot)).toBe('dark');
  });

  it('respeita expiração futura (2099) — valor expirado retorna null', () => {
    const past = new Date(Date.now() - 1000);
    setItem(NAMESPACE, 'chave-teste', 'valor', past);
    expect(getItem(NAMESPACE, 'chave-teste')).toBeNull();
    expect(store().getItem(`${NAMESPACE}.chave-teste`)).toBeNull();
  });

  it('lê valor legado não-JSON como string bruta', () => {
    store().setItem(`${NAMESPACE}.legado`, 'texto-simples');
    expect(getItem(NAMESPACE, 'legado')).toBe('texto-simples');
  });

  it('lança StorageError quando localStorage indisponível', () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    expect(() => getItem(NAMESPACE, KEYS.lastState)).toThrow(StorageError);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        return original;
      },
    });
  });
});

describe('getItem com validação de tipo (M4)', () => {
  beforeEach(() => {
    store().clear();
  });
  afterEach(() => {
    store().clear();
  });

  it('valida string na fronteira', () => {
    setItem(NAMESPACE, KEYS.lastState, '# título');
    expect(getItem(NAMESPACE, KEYS.lastState, { type: 'string' })).toBe('# título');
  });

  it('lança StorageError quando last_state não é string (corrompido)', () => {
    setItem(NAMESPACE, KEYS.lastState, { corrompido: true });
    expect(() => getItem(NAMESPACE, KEYS.lastState, { type: 'string' })).toThrow(StorageError);
  });

  it('lança StorageError quando valor numérico corrompe chave boolean', () => {
    setItem(NAMESPACE, KEYS.theme, 42);
    expect(() => getItem(NAMESPACE, KEYS.theme, { type: 'boolean' })).toThrow(StorageError);
  });

  it('normaliza boolean legado salvo como string "true"/"false"', () => {
    store().setItem(`${NAMESPACE}.${KEYS.theme}`, 'true');
    expect(getItem(NAMESPACE, KEYS.theme, { type: 'boolean' })).toBe(true);
    store().setItem(`${NAMESPACE}.${KEYS.theme}`, 'false');
    expect(getItem(NAMESPACE, KEYS.theme, { type: 'boolean' })).toBe(false);
  });

  it('boolean legado numérico (1/0) também é normalizado', () => {
    store().setItem(`${NAMESPACE}.${KEYS.scrollBar}`, '1');
    expect(getItem(NAMESPACE, KEYS.scrollBar, { type: 'boolean' })).toBe(true);
    store().setItem(`${NAMESPACE}.${KEYS.scrollBar}`, '0');
    expect(getItem(NAMESPACE, KEYS.scrollBar, { type: 'boolean' })).toBe(false);
  });

  it('chave ausente volta null mesmo com tipo exigido', () => {
    expect(getItem(NAMESPACE, 'nao-existe', { type: 'string' })).toBeNull();
  });
});
