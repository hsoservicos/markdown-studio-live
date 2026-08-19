import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyI18n } from '../../src/ui/i18nElements.js';
import { setLocale } from '../../src/i18n/index.js';

describe('applyI18n', () => {
  let container;

  beforeEach(() => {
    setLocale('pt-BR');
    container = document.createElement('div');
    container.innerHTML = `
      <span data-i18n="darkMode"></span>
      <input data-i18n-placeholder="syncLabel">
      <button data-i18n-aria-label="themeLabel"></button>
      <img data-i18n-alt="githubAlt">
      <div data-i18n-title="openManual"></div>
      <meta data-i18n-content="metaDescription">
    `;
  });

  afterEach(() => {
    setLocale('pt-BR');
  });

  it('aplica texto traduzido via data-i18n', () => {
    applyI18n({ container });
    expect(container.querySelector('[data-i18n="darkMode"]').textContent).toBe('Modo escuro');
  });

  it('aplica placeholder, aria-label, alt, title e content', () => {
    applyI18n({ container });
    expect(container.querySelector('[data-i18n-placeholder]').placeholder).toBe(
      'Sincronizar rolagem',
    );
    expect(container.querySelector('[data-i18n-aria-label]').getAttribute('aria-label')).toBe(
      'Modo escuro',
    );
    expect(container.querySelector('[data-i18n-alt]').getAttribute('alt')).toBe(
      'Repositório no GitHub',
    );
    expect(container.querySelector('[data-i18n-title]').title).toContain('Manual');
    expect(container.querySelector('[data-i18n-content]').getAttribute('content')).toContain(
      'Markdown-Studio',
    );
  });

  it('segue a locale corrente (en)', () => {
    setLocale('en');
    applyI18n({ container });
    expect(container.querySelector('[data-i18n="darkMode"]').textContent).toBe('Dark mode');
  });

  it('não falha quando não há container', () => {
    expect(() => applyI18n({ container: null })).not.toThrow();
    expect(() => applyI18n({})).not.toThrow();
  });
});
