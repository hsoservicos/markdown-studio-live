import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setLocale, getLocaleCode } from '../../src/i18n/index.js';
import { NAMESPACE, KEYS } from '../../src/i18n/index.js';
import {
  normalizeLocale,
  getStoredLocale,
  setStoredLocale,
  applyStoredLocale,
  setupLanguageSelector,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} from '../../src/ui/language.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    clear: () => map.clear(),
  };
}

describe('language helpers', () => {
  let storage;

  beforeEach(() => {
    storage = fakeStorage();
  });

  describe('normalizeLocale', () => {
    it('aceita apenas locais suportados', () => {
      for (const code of SUPPORTED_LOCALES) {
        expect(normalizeLocale(code)).toBe(code);
      }
      expect(normalizeLocale('fr')).toBe(DEFAULT_LOCALE);
      expect(normalizeLocale('')).toBe(DEFAULT_LOCALE);
      expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    });
  });

  describe('getStoredLocale / setStoredLocale', () => {
    it('default é pt-BR quando nada armazenado', () => {
      expect(getStoredLocale(storage)).toBe('pt-BR');
    });

    it('persiste e restaura o local escolhido', () => {
      setStoredLocale('en', storage);
      expect(storage.getItem(`${NAMESPACE}.${KEYS.locale}`)).toBe('en');
      expect(getStoredLocale(storage)).toBe('en');
    });

    it('normaliza local inválido ao gravar', () => {
      expect(setStoredLocale('fr', storage)).toBe('pt-BR');
      expect(getStoredLocale(storage)).toBe('pt-BR');
    });

    it('não lança quando storage indisponível', () => {
      const broken = {
        getItem() {
          throw new Error('x');
        },
        setItem() {
          throw new Error('y');
        },
      };
      expect(getStoredLocale(broken)).toBe('pt-BR');
      expect(setStoredLocale('en', broken)).toBe('en');
    });
  });

  describe('applyStoredLocale', () => {
    it('aplica o local armazenado ao i18n e ao <html lang>', () => {
      setStoredLocale('en', storage);
      const container = { documentElement: { setAttribute: vi.fn() } };
      const code = applyStoredLocale({ container, storage });
      expect(code).toBe('en');
      expect(getLocaleCode()).toBe('en');
      expect(container.documentElement.setAttribute).toHaveBeenCalledWith('lang', 'en');
    });

    it('default pt-BR sem armazenamento', () => {
      const container = { documentElement: { setAttribute: vi.fn() } };
      expect(applyStoredLocale({ container, storage })).toBe('pt-BR');
      expect(getLocaleCode()).toBe('pt-BR');
    });

    it('não quebra sem documentElement', () => {
      expect(applyStoredLocale({ container: null, storage })).toBe('pt-BR');
    });
  });

  describe('setupLanguageSelector', () => {
    it('sincroniza o select com a locale atual', () => {
      setLocale('en');
      const select = { value: '', addEventListener: vi.fn() };
      const container = { querySelector: vi.fn(() => select) };
      setupLanguageSelector({ container, onReload: vi.fn() });
      expect(container.querySelector).toHaveBeenCalledWith('#lang-select');
      expect(select.value).toBe('en');
    });

    it('persiste a escolha e aciona onReload na mudança', () => {
      setLocale('pt-BR');
      let changeHandler;
      const select = {
        value: 'en',
        addEventListener: vi.fn((type, handler) => {
          changeHandler = handler;
        }),
      };
      const container = { querySelector: vi.fn(() => select) };
      const onReload = vi.fn();
      const selectEl = setupLanguageSelector({ container, storage, onReload });
      expect(select.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      select.value = 'en';
      changeHandler({ currentTarget: select });
      expect(selectEl).toBe(select);
      expect(getStoredLocale(storage)).toBe('en');
      expect(onReload).toHaveBeenCalledWith('en');
    });

    it('retorna null sem o elemento #lang-select', () => {
      const container = { querySelector: vi.fn(() => null) };
      expect(setupLanguageSelector({ container, onReload: vi.fn() })).toBeNull();
    });
  });
});
