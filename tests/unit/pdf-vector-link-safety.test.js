import { describe, it, expect } from 'vitest';
import { markdownToPdfmake, buildPdfDocDefinition } from '../../src/pdf/markdown-to-pdfmake.js';

/**
 * Regressão de segurança do PDF vetorial (P2 da auditoria).
 *
 * O conversor monta o `docDefinition` direto dos tokens do `marked`, **sem**
 * passar pelo DOMPurify — que é a única fronteira do preview. O bug original
 * estava no `case 'link'`: copiava `token.href` sem checar scheme, então
 * `[clique](javascript:alert(1))` virava uma anotação de link clicável no PDF.
 *
 * Em vez de inspecionar um único item de conteúdo, este teste varre a árvore
 * inteira (parágrafo, heading, lista, blockquote, dentro de `strong`/`em` e o
 * `docDefinition` final entregue ao pdfmake). Qualquer caminho futuro que
 * recrie um `link` sem a allowlist de `urlPolicy.js` quebra aqui.
 */

const UNSAFE_HREFS = [
  'javascript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,x',
  'tel:+5511999',
];

const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

/** Varre a árvore procurando toda propriedade `link` de pdfmake. */
function collectLinks(node, out = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectLinks(item, out);
    return out;
  }
  if (node && typeof node === 'object') {
    if (typeof node.link === 'string') {
      out.push(node.link);
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') {
        collectLinks(value, out);
      }
    }
  }
  return out;
}

function schemeOf(url) {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(String(url));
  return match ? match[1].toLowerCase() : null;
}

function unsafeSchemes(links) {
  return links.map(schemeOf).filter((scheme) => scheme !== null && !ALLOWED_SCHEMES.has(scheme));
}

/** Cobre todos os caminhos que emitem `link`: parágrafo, heading, list, blockquote, ênfase. */
function markdownWithLinks(href) {
  return [
    `Parágrafo: [seguro](https://ok.test/) e [perigoso](${href})`,
    `## Título com [perigoso](${href})`,
    `- item não ordenado com [perigoso](${href})`,
    `1. item ordenado com [perigoso](${href})`,
    `> citação com [perigoso](${href})`,
    `**negrito com [perigoso](${href})**`,
    `*itálico com [perigoso](${href})*`,
  ].join('\n\n');
}

describe('PDF vetorial — nenhum link inseguro vira anotação', () => {
  it.each(UNSAFE_HREFS)('%s não produz nenhuma anotação em nenhum contexto', (href) => {
    const { content } = markdownToPdfmake(markdownWithLinks(href));
    const docDefinition = buildPdfDocDefinition(content, {});

    // Nem como `link` da árvore...
    expect(collectLinks(docDefinition)).not.toContain(href);
    expect(unsafeSchemes(collectLinks(docDefinition))).toEqual([]);

    // ...nem em lugar nenhum do payload serializado (poderia entrar por
    // outro caminho, ex.: texto bruto de token HTML inline).
    expect(JSON.stringify(docDefinition)).not.toContain(href);
  });

  it('o docDefinition final também fica limpo (o que o pdfmake recebe)', () => {
    const { content } = markdownToPdfmake(markdownWithLinks('javascript:alert(1)'));
    const links = collectLinks(content);
    expect(links).not.toEqual([]);
    expect(unsafeSchemes(links)).toEqual([]);
    // um único link seguro sobrevive (o do parágrafo inicial)
    expect(links).toContain('https://ok.test/');
  });

  it('links seguros continuam virando anotação — o teste não é vazio', () => {
    const { content } = markdownToPdfmake(
      '[web](https://ok.test/) [mail](mailto:a@b.c) [relativo](/docs/x.md) [âncora](#secao)',
    );
    const links = collectLinks(content);
    expect(links).toEqual(
      expect.arrayContaining(['https://ok.test/', 'mailto:a@b.c', '/docs/x.md', '#secao']),
    );
    expect(unsafeSchemes(links)).toEqual([]);
  });

  it('rótulo do link bloqueado sobrevive como texto, sem markdown cru', () => {
    const doc = markdownToPdfmake('antes [perigoso](javascript:alert(1)) depois');
    const flat = JSON.stringify(doc.content);
    expect(flat).toContain('perigoso');
    expect(flat).toContain('antes');
    expect(flat).toContain('depois');
    expect(flat).not.toContain('javascript:');
    expect(flat).not.toContain('](javascript:');
  });
});
