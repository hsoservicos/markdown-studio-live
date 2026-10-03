import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderInlineMath,
  renderBlockMath,
  katexHtmlToDataUrl,
  createMathExtensions,
} from '../../src/render/katexExt.js';

// Mock do rasterizador: o contrato de alta-resolução (PNG 3×) precisa ser
// pinado observando as opções reais passadas ao `html2canvas` — o jsdom não
// tem canvas, então o caminho real só exercitaria o `catch`.
const html2canvasMock = vi.fn();
vi.mock('html2canvas', () => ({ default: (...args) => html2canvasMock(...args) }));

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

describe('katexHtmlToDataUrl', () => {
  const countOrphans = () =>
    [...document.body.querySelectorAll('div')].filter((el) =>
      (el.getAttribute('style') || '').includes('-9999px'),
    ).length;

  beforeEach(() => {
    html2canvasMock.mockReset();
  });

  it('não deixa o container invisível preso em document.body quando o rasterizador falha', async () => {
    expect(countOrphans()).toBe(0);
    // jsdom não tem canvas: o caminho real aqui é o `catch` — e era ali que o
    // `removeChild` ficava de fora, deixando um nó órfão por fórmula que falhasse.
    html2canvasMock.mockRejectedValue(new Error('canvas indisponível'));
    const result = await katexHtmlToDataUrl('<span class="katex">x</span>');
    expect(result).toBeNull();
    expect(countOrphans()).toBe(0);
  });

  it('rasteriza em PNG 3× com fundo transparente (contrato AC-P2-9-2) e limpa o container', async () => {
    html2canvasMock.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,AAA' });
    const result = await katexHtmlToDataUrl('<span class="katex">x</span>');
    expect(result).toBe('data:image/png;base64,AAA');
    // O KaTeX não tem saída `svg` (enum htmlAndMathml|html|mathml): a rota
    // vetorial fixa raster de alta resolução em scale 3.
    expect(html2canvasMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scale: 3, backgroundColor: null }),
    );
    expect(countOrphans()).toBe(0);
  });
});
