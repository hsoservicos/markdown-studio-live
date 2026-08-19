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
});
