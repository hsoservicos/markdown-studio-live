import { describe, it, expect } from 'vitest';
import { extractTocFromHtml, extractTocFromMarkdown, buildTocHtml } from '../../src/render/toc.js';

describe('extractTocFromMarkdown', () => {
  it('extrai headings com nível, texto, id e linha', () => {
    const items = extractTocFromMarkdown('# Título\n\n## Seção Ênfase\n\n### Sub');
    expect(items).toEqual([
      { level: 1, text: 'Título', id: 'titulo', line: 1 },
      { level: 2, text: 'Seção Ênfase', id: 'secao-enfase', line: 3 },
      { level: 3, text: 'Sub', id: 'sub', line: 5 },
    ]);
  });

  it('ignora falsos positivos (código e texto sem espaço)', () => {
    expect(extractTocFromMarkdown('#--\n##SemEspaco\n```\n# não\n```')).toHaveLength(0);
  });

  it('suporta sufixo numérico em títulos repetidos', () => {
    const items = extractTocFromMarkdown('# Repetido\n\n# Repetido');
    expect(items.map((i) => i.id)).toEqual(['repetido', 'repetido-1']);
  });

  it('slug customizável via opts', () => {
    const items = extractTocFromMarkdown('# A', { slug: () => 'x' });
    expect(items[0].id).toBe('x');
  });

  it('retorna vazio com entrada nula/vazia', () => {
    expect(extractTocFromMarkdown('')).toEqual([]);
    expect(extractTocFromMarkdown(null)).toEqual([]);
  });
});

describe('extractTocFromHtml', () => {
  it('extrai headings do HTML renderizado com ids', () => {
    const html = '<h1 id="titulo">Título</h1><p>x</p><h2 id="s-1">Seção</h2>';
    expect(extractTocFromHtml(html)).toEqual([
      { level: 1, text: 'Título', id: 'titulo' },
      { level: 2, text: 'Seção', id: 's-1' },
    ]);
  });

  it('retorna vazio sem html', () => {
    expect(extractTocFromHtml('')).toEqual([]);
    expect(extractTocFromHtml(null)).toEqual([]);
  });
});

describe('buildTocHtml', () => {
  it('gera lista aninhada com âncoras', () => {
    const html = buildTocHtml([
      { level: 1, text: 'A', id: 'a' },
      { level: 2, text: 'B', id: 'b' },
    ]);
    expect(html).toContain('<ul class="toc-list">');
    expect(html).toContain('href="#a"');
    expect(html).toContain('data-toc-target="b"');
    expect(html).toContain('padding-left:1.2em');
  });

  it('escapa texto com caracteres reservados', () => {
    const html = buildTocHtml([{ level: 1, text: '<script> & "q"', id: 'x' }]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('retorna vazio para lista vazia', () => {
    expect(buildTocHtml([])).toBe('');
    expect(buildTocHtml(null)).toBe('');
  });
});
