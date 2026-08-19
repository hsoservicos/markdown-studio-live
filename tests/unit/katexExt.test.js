import { describe, it, expect } from 'vitest';
import {
  renderInlineMath,
  renderBlockMath,
  createMathExtensions,
} from '../../src/render/katexExt.js';

describe('renderInlineMath', () => {
  it('renderiza fórmula inline com classe katex', () => {
    const html = renderInlineMath('x^2');
    expect(html).toContain('class="katex"');
    expect(html).toContain('x');
  });

  it('fórmula inválida não lança (throwOnError: false)', () => {
    expect(() => renderInlineMath('\\frac{1}{')).not.toThrow();
    expect(renderInlineMath('\\frac{1}{')).toContain('katex');
  });
});

describe('renderBlockMath', () => {
  it('envolve em .katex-display com displayMode', () => {
    const html = renderBlockMath('\\frac{a}{b}');
    expect(html).toContain('katex-display');
    expect(html).toContain('class="katex"');
  });
});

describe('createMathExtensions', () => {
  const [block, inline] = createMathExtensions();

  it('expõe extensões de bloco e inline', () => {
    expect(block.name).toBe('math-block');
    expect(block.level).toBe('block');
    expect(inline.name).toBe('math-inline');
    expect(inline.level).toBe('inline');
  });

  it('tokenizer de bloco captura $$...$$', () => {
    const token = block.tokenizer('$$\nE=mc^2\n$$ resto');
    expect(token).toMatchObject({ type: 'math-block', text: 'E=mc^2' });
    expect(block.renderer(token)).toContain('katex-display');
  });

  it('tokenizer de bloco ignora $$ vazio', () => {
    expect(block.tokenizer('$$ $$ x')).toBeUndefined();
  });

  it('tokenizer inline captura $...$ simples', () => {
    const token = inline.tokenizer('$a+b$ resto');
    expect(token).toMatchObject({ type: 'math-inline', text: 'a+b' });
  });

  it('tokenizer inline não captura $$ (deixa para o bloco) nem multilinha', () => {
    expect(inline.tokenizer('$$x$$')).toBeUndefined();
    expect(inline.tokenizer('$a\nb$')).toBeUndefined();
  });

  it('start aponta para o primeiro $', () => {
    expect(block.start('x $$ y')).toBe(2);
    expect(inline.start('x $ y')).toBe(2);
    expect(inline.start('sem cifra')).toBe(-1);
  });
});
