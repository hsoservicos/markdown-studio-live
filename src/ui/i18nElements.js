import { t } from '../i18n/index.js';

/**
 * Aplica traduções aos atributos de marcação i18n dentro do DOM.
 * Suporta: textContent (data-i18n), placeholder, aria-label, alt, title e
 * <meta content> — todas resolvidas via `t(key)`.
 */
export function applyI18n({ container = document } = {}) {
  if (!container) {
    return;
  }
  container.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  container.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    el.placeholder = t(key);
  });
  container.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.dataset.i18nAriaLabel;
    el.setAttribute('aria-label', t(key));
  });
  container.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    const key = el.dataset.i18nAlt;
    el.setAttribute('alt', t(key));
  });
  container.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    el.title = t(key);
  });
  container.querySelectorAll('[data-i18n-content]').forEach((el) => {
    const key = el.dataset.i18nContent;
    el.setAttribute('content', t(key));
  });
}
