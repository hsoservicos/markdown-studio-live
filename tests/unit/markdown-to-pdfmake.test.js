import { describe, it, expect } from 'vitest';
import {
  markdownToPdfmake,
  buildPdfDocDefinition,
  collectImageSrcs,
  resolveKatexPlaceholders,
  KATEX_PLACEHOLDER_PREFIX,
  KATEX_PLACEHOLDER_SUFFIX,
} from '../../src/pdf/markdown-to-pdfmake.js';

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

  it('converte inline code (A1: sem Courier — só Roboto existe no vfs)', () => {
    const doc = markdownToPdfmake('Use `console.log()`');
    const text = doc.content[0].text;
    expect(Array.isArray(text)).toBe(true);
    const code = text.find((t) => t.background === '#f0f0f0');
    expect(code).toBeDefined();
    expect(code.font).toBeUndefined();
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

  it('converte mermaid code block como svg content type quando disponível (A2)', () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>';
    const svgMap = new Map([['graph TD\n  A-->B', svg]]);
    const doc = markdownToPdfmake(md, { mermaidSvgs: svgMap });
    expect(doc.content).toHaveLength(1);
    // pdfmake: `image` só decodifica JPEG/PNG — SVG é o content type `svg`.
    expect(doc.content[0].svg).toBe(svg);
    expect(doc.content[0].image).toBeUndefined();
  });

  it('converte mermaid code block como code quando SVG não disponível', () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    const doc = markdownToPdfmake(md, { mermaidSvgs: new Map() });
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].background).toBe('#f6f8fa');
  });

  describe('links — allowlist de schemes (mesma do preview)', () => {
    function inlineText(md) {
      const doc = markdownToPdfmake(md);
      const text = doc.content[0]?.text;
      return Array.isArray(text) ? text : [text];
    }

    it('preserva mailto como link', () => {
      const link = inlineText('[contato](mailto:a@b.c)').find(
        (t) => typeof t === 'object' && t.link,
      );
      expect(link).toBeDefined();
      expect(link.link).toBe('mailto:a@b.c');
    });

    it('preserva link relativo como link', () => {
      const link = inlineText('[doc](/docs/x.md)').find((t) => typeof t === 'object' && t.link);
      expect(link).toBeDefined();
      expect(link.link).toBe('/docs/x.md');
    });

    it.each(['javascript:alert(1)', 'tel:5511999', 'vbscript:msgbox(1)', 'data:text/html,x'])(
      'não gera anotação para scheme ativo: %s',
      (href) => {
        const items = inlineText(`[clique](${href})`);
        // `typeof` evita casar com String.prototype.link (função truthy).
        expect(items.some((t) => typeof t === 'object' && t.link)).toBe(false);
        expect(items).toContain('clique');
      },
    );

    it('rótulo do link inseguro sobrevive sem virar anotação', () => {
      const doc = markdownToPdfmake('Texto [clique](javascript:alert(1)) fim');
      const flat = JSON.stringify(doc.content);
      expect(flat).not.toContain('"link"');
      expect(flat).toContain('clique');
    });
  });

  describe('imagens', () => {
    it('data URL PNG/JPEG vira item de bloco com image (único formato decodificável)', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      const doc = markdownToPdfmake(`![alt](${dataUrl})`);
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].image).toBe(dataUrl);
      expect(doc.content[0].text).toBeUndefined();
      const jpeg = markdownToPdfmake('![alt](data:image/jpeg;base64,/9j/4AAQ)');
      expect(jpeg.content[0].image).toBe('data:image/jpeg;base64,/9j/4AAQ');
    });

    it('imagem relativa degrada para o alt (pdfmake não decodifica href cru)', () => {
      const doc = markdownToPdfmake('![alt](/image/Markdown-mark.svg)');
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].image).toBeUndefined();
      expect(doc.content[0].text).toBe('alt');
    });

    it('imagem http(s) degrada para o alt (D6: remota não é suportada)', () => {
      const doc = markdownToPdfmake('![alt](https://example.com/x.png)');
      expect(doc.content[0].image).toBeUndefined();
      expect(doc.content[0].text).toBe('alt');
    });

    it('data URL de SVG degrada para o alt (só PNG/JPEG base64 são decodificáveis)', () => {
      const doc = markdownToPdfmake('![alt](data:image/svg+xml;base64,PHN2Zz4=)');
      expect(doc.content[0].image).toBeUndefined();
      expect(doc.content[0].text).toBe('alt');
    });

    it('imagem inline degrada para o alt sem vazar markdown cru', () => {
      const doc = markdownToPdfmake('Antes ![descrição](/x.png) depois');
      const flat = JSON.stringify(doc.content);
      expect(flat).not.toContain('![');
      expect(flat).not.toContain('/x.png');
      expect(flat).toContain('Antes');
      expect(flat).toContain('descrição');
    });

    it('imagem em heading degrada para o alt', () => {
      const doc = markdownToPdfmake('# Título ![descrição](/x.png)');
      const flat = JSON.stringify(doc.content);
      expect(flat).not.toContain('![');
      expect(flat).toContain('descrição');
    });

    it('imagem com scheme ativo degrada para o alt', () => {
      const doc = markdownToPdfmake('![alt](javascript:alert(1))');
      expect(doc.content[0].image).toBeUndefined();
      expect(JSON.stringify(doc.content)).not.toContain('javascript');
    });

    it('data:text/html não é embutido como imagem', () => {
      const doc = markdownToPdfmake('![alt](data:text/html,hello)');
      expect(doc.content[0].image).toBeUndefined();
    });
  });
});

describe('resolveKatexPlaceholders (M11 — KaTeX no PDF)', () => {
  const html = '<span class="katex">x^2</span>';
  const placeholder = `${KATEX_PLACEHOLDER_PREFIX}${html}${KATEX_PLACEHOLDER_SUFFIX}`;
  const dataUrl = 'data:image/svg+xml;base64,AAAA';
  const converter = async () => dataUrl;

  it('sem conversor devolve o conteúdo intacto', async () => {
    const items = [{ text: placeholder }];
    await expect(resolveKatexPlaceholders(items, null)).resolves.toBe(items);
  });

  it('math-block: o item vira nó de imagem {image,fit} no nível do conteúdo', async () => {
    const items = [{ text: placeholder, margin: [0, 5, 0, 5] }];
    const out = await resolveKatexPlaceholders(items, converter);

    expect(out).toHaveLength(1);
    expect(out[0].image).toBe(dataUrl);
    expect(out[0].fit).toEqual([300, 50]);
    expect(out[0].margin).toEqual([0, 5, 0, 5]);
    // `text: {image}` seria medido como texto pelo pdfmake (measureLeaf antes
    // de measureImage) — o nó não pode ter a propriedade `text`.
    expect(out[0].text).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('KATEX_HTML');
  });

  it('math-inline: só o run aninhado vira imagem e o texto ao redor fica', async () => {
    const items = [{ text: ['antes ', { text: placeholder }, ' depois'] }];
    const out = await resolveKatexPlaceholders(items, converter);

    expect(out[0].text).toHaveLength(3);
    expect(out[0].text[0]).toBe('antes ');
    expect(out[0].text[1]).toEqual({ image: dataUrl, fit: [300, 50] });
    expect(out[0].text[2]).toBe(' depois');
    expect(JSON.stringify(out)).not.toContain('KATEX_HTML');
  });

  it('placeholder em run aninhado sem conversor disponível é preservado', async () => {
    const run = { text: placeholder };
    const items = [{ text: ['a', run, 'b'] }];
    const out = await resolveKatexPlaceholders(items, async () => null);

    expect(out[0].text[1]).toBe(run);
  });

  it('conversor que falha mantém a string do placeholder', async () => {
    const items = [{ text: placeholder }];
    const out = await resolveKatexPlaceholders(items, async () => {
      throw new Error('canvas indisponível');
    });

    expect(out[0].text).toBe(placeholder);
  });

  it('placeholder sem sufixo de fechamento não é convertido', async () => {
    const broken = `${KATEX_PLACEHOLDER_PREFIX}${html}`;
    const items = [{ text: broken }];
    const out = await resolveKatexPlaceholders(items, converter);

    expect(out[0].text).toBe(broken);
  });

  it('itens sem placeholder passam adiante sem alteração', async () => {
    const item = { text: 'só texto', margin: [1, 2, 3, 4] };
    const out = await resolveKatexPlaceholders([item], converter);

    expect(out[0]).toBe(item);
  });

  it('e2e: $$x^2$$ sai do pipeline sem marcador KaTeX e como imagem', async () => {
    const { content } = markdownToPdfmake('$$x^2$$');
    const out = await resolveKatexPlaceholders(content, converter);

    expect(out[0].image).toBe(dataUrl);
    expect(JSON.stringify(out)).not.toContain('KATEX_HTML');
  });

  it('e2e: "Texto $x^2$ fim" preserva o texto e resolve só a matemática', async () => {
    const { content } = markdownToPdfmake('Texto $x^2$ fim');
    const out = await resolveKatexPlaceholders(content, converter);

    expect(out[0].text).toContain('Texto ');
    expect(out[0].text).toContain(' fim');
    expect(out[0].text).toContainEqual({ image: dataUrl, fit: [300, 50] });
    expect(JSON.stringify(out)).not.toContain('KATEX_HTML');
  });
});

describe('A4 — pageSize/orientation na rota vetorial', () => {
  it('aplica Letter/paisagem do print settings (AC-P2-9-1)', () => {
    const doc = buildPdfDocDefinition([], {
      paperSize: 'letter',
      orientation: 'landscape',
      margin: 5,
    });
    expect(doc.pageSize).toBe('LETTER');
    expect(doc.pageOrientation).toBe('landscape');
    expect(doc.pageMargins).toEqual([5, 15, 5, 15]);
  });

  it('default é A4 retrato; paperSize desconhecido cai em A4', () => {
    expect(buildPdfDocDefinition([]).pageSize).toBe('A4');
    expect(buildPdfDocDefinition([], { paperSize: 'a3' }).pageSize).toBe('A4');
    const portrait = buildPdfDocDefinition([], { paperSize: 'a4', orientation: 'portrait' });
    expect(portrait.pageOrientation).toBe('portrait');
  });
});

describe('A5/A6 — inline completo em tabelas, del e listas aninhadas', () => {
  it('tabela converte inline tokens das células (não markdown cru)', () => {
    const doc = markdownToPdfmake('| A | B |\n|---|---|\n| **negrito** | [link](https://ex.com) |');
    const table = doc.content[0].table;
    const headerCell = table.body[0][0];
    expect(headerCell.text).toEqual(['A']);
    const bodyCellBold = table.body[1][0].text;
    expect(JSON.stringify(bodyCellBold)).toContain('negrito');
    expect(JSON.stringify(bodyCellBold)).not.toContain('**');
    const bodyCellLink = table.body[1][1].text;
    expect(JSON.stringify(bodyCellLink)).toContain('link');
    expect(JSON.stringify(bodyCellLink)).not.toContain('](');
  });

  it('del vira lineThrough, não tildes cruas', () => {
    const doc = markdownToPdfmake('texto ~~riscado~~ aqui');
    const runs = doc.content[0].text;
    const del = runs.find((r) => r && r.decoration === 'lineThrough');
    expect(del).toBeDefined();
    expect(JSON.stringify(del)).toContain('riscado');
    expect(JSON.stringify(doc.content)).not.toContain('~~');
  });

  it('lista aninhada vira ul/ol dentro do item (não markdown cru)', () => {
    const doc = markdownToPdfmake('- pai\n  - filho1\n  - filho2');
    const ul = doc.content[0].ul;
    expect(ul).toHaveLength(1);
    expect(ul[0].ul).toHaveLength(2);
    expect(JSON.stringify(ul[0].ul[0].text)).toContain('filho1');
    expect(JSON.stringify(doc.content)).not.toContain('  - ');
  });
});

describe('A3 — imagens relativas resolvidas via mapa data URL', () => {
  it('usa o mapa imageDataUrls quando o src não é embutível diretamente', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const map = new Map([['/img/local.png', dataUrl]]);
    const doc = markdownToPdfmake('![alt](/img/local.png)', { imageDataUrls: map });
    expect(doc.content[0].image).toBe(dataUrl);
    expect(doc.content[0].text).toBeUndefined();
  });

  it('sem entrada no mapa degrada para o alt (contrato D6)', () => {
    const doc = markdownToPdfmake('![alt](/img/local.png)', { imageDataUrls: new Map() });
    expect(doc.content[0].image).toBeUndefined();
    expect(doc.content[0].text).toBe('alt');
  });

  it('collectImageSrcs lista só caminhos relativos (sem data/blob/rede)', () => {
    const md = [
      '![a](/img/um.png)',
      '![b](https://evil.example/x.png)',
      '![c](data:image/png;base64,AA=)',
      'texto ![d](img/dois.png) no meio',
    ].join('\n\n');
    expect(collectImageSrcs(md).sort()).toEqual(['/img/um.png', 'img/dois.png']);
  });
});

describe('A7 — resolveKatexPlaceholders alcança nós aninhados', () => {
  const html = '<span class="katex">x</span>';
  const placeholder = `${KATEX_PLACEHOLDER_PREFIX}${html}${KATEX_PLACEHOLDER_SUFFIX}`;
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const converter = async () => dataUrl;

  it('resolve placeholder em blockquote (columns[].text)', async () => {
    const { content } = markdownToPdfmake('> citando $x$ aqui');
    const out = await resolveKatexPlaceholders(content, converter);
    const flat = JSON.stringify(out);
    expect(flat).not.toContain('KATEX_HTML');
    expect(flat).toContain('data:image/png');
  });

  it('resolve placeholder em item de lista aninhada (ul[].text)', async () => {
    const { content } = markdownToPdfmake('- item com $x$ dentro\n  - sub $y$');
    const out = await resolveKatexPlaceholders(content, converter);
    const flat = JSON.stringify(out);
    expect(flat).not.toContain('KATEX_HTML');
    expect(flat).toContain('data:image/png');
  });

  it('resolve placeholder dentro de run aninhado (strong/em)', async () => {
    const items = [{ text: [{ text: [{ text: placeholder }], bold: true }] }];
    const out = await resolveKatexPlaceholders(items, converter);
    const flat = JSON.stringify(out);
    expect(flat).not.toContain('KATEX_HTML');
    expect(flat).toContain('data:image/png');
  });
});
