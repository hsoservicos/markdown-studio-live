import { describe, it, expect } from 'vitest';
import { convert, escapeHtml } from '../../src/render/convert.js';

describe('convert (pipeline marked → DOMPurify)', () => {
  it('renderiza em negrito', () => {
    const html = convert('**negrito**');
    expect(html).toContain('<strong>negrito</strong>');
  });

  it('renderiza cabeçalho h1', () => {
    const html = convert('# Título');
    expect(html).toMatch(/<h1[^>]*>/);
    expect(html).toContain('Título');
    expect(html).toContain('</h1>');
  });

  it('sanitiza scripts (XSS bloqueado)', () => {
    const html = convert('<script>alert(1)</script>\n\n*ok*');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
    expect(html).toContain('<em>ok</em>');
  });

  it('sanitiza onclick em atributo', () => {
    const html = convert('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('bloco mermaid vira <pre class="mermaid">', () => {
    const html = convert('```mermaid\ngraph TD\n  A --> B\n```');
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain('graph TD');
  });

  it('bloco de código normal continua renderizado pelo marked', () => {
    const html = convert('```js\nconst a = 1;\n```');
    expect(html).toContain('const a = 1');
    expect(html).not.toContain('class="mermaid"');
  });

  it('escapeHtml escapa caracteres perigosos', () => {
    expect(escapeHtml('<img src="x">')).toBe('&lt;img src=&quot;x&quot;&gt;');
    expect(escapeHtml('a & b < c > d "e" \'f\'')).toBe(
      'a &amp; b &lt; c &gt; d &quot;e&quot; &#39;f&#39;',
    );
  });

  it('bloco mermaid escapa conteúdo HTML injetado', () => {
    const html = convert('```mermaid\ngraph TD\n  A --> B <script>alert(1)</script>\n```');
    expect(html).toContain('<pre class="mermaid">');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A --&gt; B');
  });

  it('comentário/atributo no bloco mermaid não escapa do <pre>', () => {
    const html = convert('```mermaid\nA --> B "><img src=x>\n```');
    expect(html).toContain('<pre class="mermaid">');
    expect(html).not.toContain('<img');
    // ">" é escapado (&gt;); aspas em texto são re-serializadas literais pelo
    // DOM após sanitização — o importante é que < / > impedem criar elemento.
    expect(html).toContain('&gt;&lt;img src=x&gt;');
  });

  it('tabela renderiza com célula', () => {
    const html = convert('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<td>1</td>');
  });

  it('cabeçalho ganha id slug (âncoras clicáveis)', () => {
    const html = convert('## Ênfase e formatação de texto');
    expect(html).toContain('<h2 id="enfase-e-formatacao-de-texto">');
  });

  it('cabeçalhos repetidos ganham sufixo numérico', () => {
    const html = convert('# Título\n\n# Título');
    expect(html).toContain('<h1 id="titulo">');
    expect(html).toContain('<h1 id="titulo-1">');
  });

  it('<!-- page-break --> vira divisor semântico de quebra de página', () => {
    const html = convert('Capítulo A\n\n<!-- page-break -->\n\nCapítulo B');
    expect(html).toContain('<div class="page-break"');
    expect(html).not.toContain('page-break -->');
  });

  it('comentário comum continua sendo removido pelo DOMPurify', () => {
    const html = convert('Olá\n\n<!-- notícia interna -->\n\nMundo');
    expect(html).not.toContain('<!--');
  });

  it('fórmula inline $...$ renderiza KaTeX', () => {
    const html = convert('A energia é $E=mc^2$ hoje.');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('$E=mc^2$');
  });

  it('fórmula em bloco $$...$$ renderiza KaTeX display', () => {
    const html = convert('Texto\n\n$$\n\\frac{a}{b}\n$$\n\nFim');
    expect(html).toContain('katex-display');
  });

  it('XSS dentro de fórmula é neutralizado', () => {
    const html = convert('$<script>alert(1)</script>$');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)</script>');
  });

  it('cifra dentro de código inline não vira fórmula', () => {
    const html = convert('Use `$x$` como literal.');
    expect(html).toContain('<code>');
    expect(html).not.toContain('katex');
  });
});
