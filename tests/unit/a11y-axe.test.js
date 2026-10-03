import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

/**
 * Auditoria a11y automatizada com axe-core sobre o `index.html` REAL e o CSS
 * real de `public/css/style.css` (o jsdom não busca `<link href>`, então o
 * stylesheet é injetado para o axe enxergar cores e estados computados).
 *
 * Três estados da UI: shell inicial, diálogos abertos e sidebar recolhida.
 * Qualquer violação nova do axe quebra o gate — a falha lista regra, impacto e
 * os seletores afetados para a correção ser direta.
 *
 * Limitação do jsdom aceita de propósito: `color-contrast` só alcança
 * "incomplete" (o jsdom não computa pseudo-elementos), então ele não é
 * assertável aqui e fica de fora do contrato — ver ALLOWED_INCOMPLETE.
 */

const INDEX_HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const STYLE_CSS = readFileSync(resolve(process.cwd(), 'public/css/style.css'), 'utf8');

// Regras que o jsdom não consegue concluir (não são violações, só "incomplete").
// Só `color-contrast` é tolerado; qualquer outra regra nova aqui sinaliza que o
// setup do jsdom perdeu cobertura e merece investigação.
const ALLOWED_INCOMPLETE = new Set(['color-contrast']);

function loadRealIndexHtml() {
  const parsed = new JSDOM(INDEX_HTML);
  const root = parsed.window.document.documentElement;
  document.documentElement.setAttribute('lang', root.getAttribute('lang') ?? '');
  document.head.innerHTML = parsed.window.document.head.innerHTML;
  document.body.innerHTML = parsed.window.document.body.innerHTML;
  // jsdom não implementa `elementFromPoint`; o axe chama dentro de
  // `isModalOpen` e aborta as regras de landmark/heading com "incomplete".
  if (typeof document.elementFromPoint !== 'function') {
    document.elementFromPoint = () => document.body;
  }
  if (typeof document.elementsFromPoint !== 'function') {
    document.elementsFromPoint = () => [document.body];
  }
  const style = document.createElement('style');
  style.id = 'audit-css';
  style.textContent = STYLE_CSS;
  document.head.appendChild(style);
}

function describeViolations(violations) {
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.help}\n` +
        v.nodes
          .slice(0, 10)
          .map((n) => `  - ${n.target.join(' ')}`)
          .join('\n'),
    )
    .join('\n');
}

const runAudit = () =>
  axe.run(document, {
    resultTypes: ['violations', 'incomplete'],
    rules: { 'color-contrast': { enabled: true } },
  });

async function expectNoViolations() {
  const results = await runAudit();
  expect(results.violations, describeViolations(results.violations)).toEqual([]);
  const unexpected = results.incomplete
    .map((r) => r.id)
    .filter((id) => !ALLOWED_INCOMPLETE.has(id));
  expect(unexpected, 'regras "incomplete" fora da allow-list do jsdom').toEqual([]);
}

beforeEach(() => {
  loadRealIndexHtml();
});

afterAll(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('a11y (axe-core) sobre o index.html real', () => {
  it('estado inicial não tem violações', async () => {
    await expectNoViolations();
  });

  it('diálogos abertos não têm violações', async () => {
    document.querySelectorAll('dialog').forEach((d) => d.setAttribute('open', ''));
    await expectNoViolations();
  });

  it('sidebar recolhida não tem violações', async () => {
    document.getElementById('sidebar')?.classList.add('is-collapsed');
    await expectNoViolations();
  });
});
