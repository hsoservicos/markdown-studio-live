import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractTocFromMarkdown, buildTocHtml } from '../../src/render/toc.js';
import { convert, visibleHeadingText } from '../../src/render/convert.js';

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

  it('texto visível: imagem vira alt, link vira texto, ênfase sai (fonte dos ids — D8)', () => {
    expect(visibleHeadingText('Veja [docs](https://ex.com)')).toBe('Veja docs');
    expect(visibleHeadingText('Imagem ![alt](/x.png)')).toBe('Imagem alt');
    expect(visibleHeadingText('**Negrito** e *itálico* e `código`')).toBe(
      'Negrito e itálico e código',
    );
    expect(visibleHeadingText('Escapado \\*literal\\*')).toBe('Escapado *literal*');
    expect(visibleHeadingText('Com <b>tag</b> inline')).toBe('Com tag inline');
  });

  it('contrato D8: ids do TOC e do preview são idênticos para o mesmo documento', () => {
    const md = [
      '# Veja [docs](https://ex.com)',
      '',
      '## Imagem ![alt](/x.png)',
      '',
      '## Tom & Jerry',
      '',
      '## Use `npm test`',
      '',
      '## **Negrito** no título',
      '',
      '### Repetido',
      '',
      '### Repetido',
    ].join('\n');

    const tocIds = extractTocFromMarkdown(md).map((i) => i.id);
    const dom = new JSDOM(convert(md));
    const renderedIds = [...dom.window.document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(
      (h) => h.id,
    );
    expect(tocIds).toEqual(renderedIds);
    // os casos que divergiam antes da unificação
    expect(tocIds[0]).toBe('veja-docs');
    expect(tocIds[1]).toBe('imagem-alt');
    expect(tocIds[2]).toBe('tom-jerry');
    expect(tocIds[5]).toBe('repetido');
    expect(tocIds[6]).toBe('repetido-1');
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

describe('D9 — bordas do extrator de TOC', () => {
  it('fence de 4+ crases não fecha com linha de 3 crases dentro', () => {
    const md = '````\n```\n# falso heading\n```\n````\n\n# real';
    expect(extractTocFromMarkdown(md).map((i) => i.id)).toEqual(['real']);
  });

  it('setext vira heading h1/h2', () => {
    const md = 'Título\n===\n\nSeção\n---\n';
    const items = extractTocFromMarkdown(md);
    expect(items.map((i) => [i.level, i.id])).toEqual([
      [1, 'titulo'],
      [2, 'secao'],
    ]);
  });

  it('heading sem texto visível não vira âncora quebrada', () => {
    expect(extractTocFromMarkdown('## ***')).toEqual([]);
    expect(extractTocFromMarkdown('# ok\n\n## ***').map((i) => i.id)).toEqual(['ok']);
  });
});
