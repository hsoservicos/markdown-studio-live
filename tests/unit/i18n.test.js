import { describe, it, expect } from 'vitest';
import {
  setLocale,
  getDefaultTemplate,
  DEFAULT_TEMPLATE_PT,
  DEFAULT_TEMPLATE_EN,
  DEFAULT_TEMPLATE,
} from '../../src/i18n/index.js';
import { SUPPORTED_LOCALES } from '../../src/ui/language.js';

function headingCount(template) {
  return (template.match(/^#{1,3} /gm) || []).length;
}

describe('templates i18n por locale', () => {
  it.each(SUPPORTED_LOCALES)('fornece template não vazio para %s', (code) => {
    setLocale(code);
    const template = getDefaultTemplate();
    expect(template).toBeTruthy();
    expect(template.length).toBeGreaterThan(100);
  });

  it('por padrão o template é pt-BR', () => {
    setLocale('pt-BR');
    expect(getDefaultTemplate()).toBe(DEFAULT_TEMPLATE_PT);
  });

  it('em inglês o template é o EN e diverge do PT', () => {
    setLocale('en');
    expect(getDefaultTemplate()).toBe(DEFAULT_TEMPLATE_EN);
    expect(DEFAULT_TEMPLATE_EN).not.toBe(DEFAULT_TEMPLATE_PT);
  });

  it('DEFAULT_TEMPLATE (compat) aponta para o template PT', () => {
    expect(DEFAULT_TEMPLATE).toBe(DEFAULT_TEMPLATE_PT);
  });

  it('templates têm estrutura de cabeçalho equivalente', () => {
    expect(headingCount(DEFAULT_TEMPLATE_EN)).toBe(headingCount(DEFAULT_TEMPLATE_PT));
  });
});
