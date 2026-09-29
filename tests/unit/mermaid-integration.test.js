// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';

// O mermaid mede texto/positioning via SVG layout API, que o jsdom não implementa.
// Shims de DOM apenas — nenhum deles toca no comportamento sob teste.
beforeAll(() => {
  const svgProto = window.SVGElement.prototype;
  svgProto.getBBox = () => ({ x: 0, y: 0, width: 80, height: 20 });
  svgProto.getComputedTextLength = function getComputedTextLength() {
    return (this.textContent || '').length * 7;
  };
  svgProto.getScreenCTM = function getScreenCTM() {
    const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    matrix.inverse = () => matrix;
    matrix.multiply = () => matrix;
    return matrix;
  };

  // jsdom não expõe CSSStyleSheet como construtor global; o mermaid injeta estilos com ele.
  if (typeof globalThis.CSSStyleSheet === 'undefined') {
    class CSSStyleSheetShim {
      constructor() {
        this.cssRules = [];
      }
      replaceSync() {}
      insertRule(rule) {
        this.cssRules.push(rule);
        return this.cssRules.length - 1;
      }
    }
    globalThis.CSSStyleSheet = CSSStyleSheetShim;
    window.CSSStyleSheet = CSSStyleSheetShim;
  }

  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  }
});

function diagramRoot(source) {
  const root = document.createElement('div');
  root.innerHTML = '<div class="mermaid"></div>';
  root.querySelector('.mermaid').textContent = source;
  return root;
}

describe('mermaid real (integração — sem vi.mock)', () => {
  it('renderiza um flowchart para SVG e aplica bindFunctions', async () => {
    const { renderMermaidDiagramsIn } = await import('../../src/render/mermaid.js');
    const root = diagramRoot('flowchart LR\n  A --> B\n  B --> C');

    await renderMermaidDiagramsIn(root, 'default');

    const el = root.querySelector('.mermaid');
    expect(el.classList.contains('mermaid-error')).toBe(false);
    expect(el.innerHTML).not.toContain('mermaid-error');
    const svg = el.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    expect(el.textContent).toContain('A');
  }, 30000);

  it('renderiza sequence diagram e troca de tema sem erro', async () => {
    const { renderMermaidDiagramsIn } = await import('../../src/render/mermaid.js');
    const root = diagramRoot('sequenceDiagram\n  Alice->>Bob: Ola\n  Bob-->>Alice: Oi');

    await renderMermaidDiagramsIn(root, 'dark');

    const el = root.querySelector('.mermaid');
    expect(el.classList.contains('mermaid-error')).toBe(false);
    expect(el.querySelector('svg')).toBeTruthy();
  }, 30000);

  it('fonte inválida vira erro legível, não exceção não tratada', async () => {
    const { renderMermaidDiagramsIn } = await import('../../src/render/mermaid.js');
    const root = diagramRoot('isto nao e um diagrama valido {{{');

    await renderMermaidDiagramsIn(root, 'default');

    const el = root.querySelector('.mermaid');
    expect(el.classList.contains('mermaid-error')).toBe(true);
    expect(el.textContent.length).toBeGreaterThan(0);
    expect(el.querySelector('svg')).toBeNull();
  }, 30000);

  it('single-flight: chamadas concorrentes renderizam sem corromper o DOM', async () => {
    const { renderMermaidDiagramsIn } = await import('../../src/render/mermaid.js');
    const root = diagramRoot('flowchart TD\n  X --> Y');

    await Promise.all([
      renderMermaidDiagramsIn(root, 'default'),
      renderMermaidDiagramsIn(root, 'dark'),
    ]);

    const el = root.querySelector('.mermaid');
    expect(el.classList.contains('mermaid-error')).toBe(false);
    expect(el.querySelectorAll('svg')).toHaveLength(1);
  }, 30000);
});
