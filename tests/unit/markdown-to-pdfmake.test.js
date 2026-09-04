import { describe, it, expect } from 'vitest';
import { markdownToPdfmake } from '../../src/pdf/markdown-to-pdfmake.js';

describe('markdownToPdfmake', () => {
  it('converte heading h1', () => {
    const doc = markdownToPdfmake('# Título');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].text).toEqual(['Título']);
    expect(doc.content[0].fontSize).toBe(22);
    expect(doc.content[0].bold).toBe(true);
  });

  it('converte heading h2', () => {
    const doc = markdownToPdfmake('## Subtítulo');
    expect(doc.content[0].fontSize).toBe(18);
  });

  it('converte paragraph simples', () => {
    const doc = markdownToPdfmake('Texto simples.');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].text).toEqual(['Texto simples.']);
  });

  it('converte paragraph com formatação inline', () => {
    const doc = markdownToPdfmake('Texto com **negrito** e *itálico*.');
    expect(doc.content).toHaveLength(1);
    const text = doc.content[0].text;
    expect(Array.isArray(text)).toBe(true);
    const bold = text.find((t) => t.bold === true);
    expect(bold).toBeDefined();
    expect(bold.text).toEqual(['negrito']);
    const italic = text.find((t) => t.italics === true);
    expect(italic).toBeDefined();
    expect(italic.text).toEqual(['itálico']);
  });

  it('converte lista não ordenada', () => {
    const doc = markdownToPdfmake('- Item 1\n- Item 2');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].ul).toBeDefined();
    expect(doc.content[0].ul).toHaveLength(2);
  });

  it('converte lista ordenada', () => {
    const doc = markdownToPdfmake('1. Primeiro\n2. Segundo');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].ol).toBeDefined();
    expect(doc.content[0].ol).toHaveLength(2);
  });

  it('converte tabela', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const doc = markdownToPdfmake(md);
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].table).toBeDefined();
    expect(doc.content[0].table.headerRows).toBe(1);
    expect(doc.content[0].table.body).toHaveLength(2);
    expect(doc.content[0].table.body[0][0].bold).toBe(true);
  });

  it('converte code block', () => {
    const md = '```js\nconst x = 1;\n```';
    const doc = markdownToPdfmake(md);
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].background).toBe('#f6f8fa');
  });

  it('converte blockquote', () => {
    const doc = markdownToPdfmake('> Citação');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].columns).toBeDefined();
    expect(doc.content[0].columns).toHaveLength(2);
  });

  it('converte link', () => {
    const doc = markdownToPdfmake('[Google](https://google.com)');
    expect(doc.content).toHaveLength(1);
    const text = doc.content[0].text;
    const link = Array.isArray(text) ? text.find((t) => t.link) : null;
    expect(link).toBeDefined();
    expect(link.link).toBe('https://google.com');
    expect(link.text).toBe('Google');
  });

  it('converte horizontal rule', () => {
    const doc = markdownToPdfmake('---');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].canvas).toBeDefined();
  });

  it('converte page-break comment', () => {
    const md = 'Texto\n\n<!-- page-break -->\n\n# Depois';
    const doc = markdownToPdfmake(md);
    const pageBreak = doc.content.find((c) => c.pageBreak === 'before');
    expect(pageBreak).toBeDefined();
  });

  it('ignora espaços em branco', () => {
    const doc = markdownToPdfmake('\n\n\n');
    expect(doc.content).toHaveLength(0);
  });

  it('converte markdown vazio', () => {
    const doc = markdownToPdfmake('');
    expect(doc.content).toHaveLength(0);
  });

  it('preserva hierarquia de headings', () => {
    const md = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
    const doc = markdownToPdfmake(md);
    expect(doc.content).toHaveLength(6);
    expect(doc.content[0].fontSize).toBe(22);
    expect(doc.content[1].fontSize).toBe(18);
    expect(doc.content[2].fontSize).toBe(15);
    expect(doc.content[3].fontSize).toBe(13);
    expect(doc.content[4].fontSize).toBe(11);
    expect(doc.content[5].fontSize).toBe(10);
  });

  it('retorna docDefinition com defaultStyle', () => {
    const doc = markdownToPdfmake('Texto');
    expect(doc.defaultStyle).toBeDefined();
    expect(doc.defaultStyle.fontSize).toBe(11);
  });

  it('converte inline code', () => {
    const doc = markdownToPdfmake('Use `console.log()`');
    const text = doc.content[0].text;
    expect(Array.isArray(text)).toBe(true);
    const code = text.find((t) => t.font === 'Courier');
    expect(code).toBeDefined();
  });

  it('converte math-block com placeholder HTML', () => {
    const md = '$$x^2$$';
    const doc = markdownToPdfmake(md);
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].text).toContain('KATEX');
    expect(doc.content[0].text).toContain('katex');
  });

  it('converte math-inline com placeholder HTML', () => {
    const md = 'Texto $x^2$ fim';
    const doc = markdownToPdfmake(md);
    expect(doc.content).toHaveLength(1);
    const text = doc.content[0].text;
    expect(Array.isArray(text)).toBe(true);
    const katexItem = text.find((t) => typeof t === 'object' && t.text && t.text.includes('KATEX'));
    expect(katexItem).toBeDefined();
  });

  it('converte mermaid code block como image quando SVG disponível', () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    const svgMap = new Map([
      ['graph TD\n  A-->B', '<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>'],
    ]);
    const doc = markdownToPdfmake(md, { mermaidSvgs: svgMap });
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].image).toBeDefined();
    expect(doc.content[0].image).toMatch(/^data:image\/svg\+xml,/);
  });

  it('converte mermaid code block como code quando SVG não disponível', () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    const doc = markdownToPdfmake(md, { mermaidSvgs: new Map() });
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].background).toBe('#f6f8fa');
  });
});
