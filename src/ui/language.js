import { NAMESPACE, KEYS } from '../i18n/index.js';
import { setLocale, getLocaleCode } from '../i18n/index.js';

export const SUPPORTED_LOCALES = ['pt-BR', 'en'];

export const DEFAULT_LOCALE = 'pt-BR';

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

export function localKey() {
  return `${NAMESPACE}.${KEYS.locale}`;
}

export function getStoredLocale(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(localKey());
    return normalizeLocale(raw);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function setStoredLocale(locale, storage = globalThis.localStorage) {
  const code = normalizeLocale(locale);
  try {
    storage.setItem(localKey(), code);
  } catch {
    // storage indisponível — seleção não persiste
  }
  return code;
}

export function applyStoredLocale({
  container = document,
  storage = globalThis.localStorage,
} = {}) {
  const code = getStoredLocale(storage);
  setLocale(code);
  if (container && container.documentElement) {
    container.documentElement.setAttribute('lang', code);
  }
  return code;
}

export function setupLanguageSelector({
  container = document,
  storage = globalThis.localStorage,
  onReload = () => window.location.reload(),
} = {}) {
  const select = container.querySelector('#lang-select');
  if (!select) {
    return null;
  }
  select.value = getLocaleCode();
  select.addEventListener('change', () => {
    setStoredLocale(select.value, storage);
    if (onReload) {
      onReload(select.value);
    }
  });
  return select;
}
