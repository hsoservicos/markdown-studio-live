import { describe, it, expect } from 'vitest';
import { captureMermaidSvgs } from '../../src/pdf/svg-embed.js';

describe('captureMermaidSvgs', () => {
  it('captura SVGs de elementos .mermaid', () => {
    const root = {
      querySelectorAll: () => [
        {
          dataset: { mermaidSource: 'graph TD\n  A-->B' },
          querySelector: () => ({ outerHTML: '<svg>diagram</svg>' }),
        },
      ],
    };
    const map = captureMermaidSvgs(root);
    expect(map.size).toBe(1);
    expect(map.get('graph TD\n  A-->B')).toBe('<svg>diagram</svg>');
  });

  it('retorna mapa vazio quando não há mermaid', () => {
    const root = { querySelectorAll: () => [] };
    const map = captureMermaidSvgs(root);
    expect(map.size).toBe(0);
  });

  it('retorna mapa vazio quando root é null', () => {
    expect(captureMermaidSvgs(null).size).toBe(0);
  });

  it('retorna mapa vazio quando root não tem querySelectorAll', () => {
    expect(captureMermaidSvgs({}).size).toBe(0);
  });

  it('ignora elementos .mermaid sem SVG', () => {
    const root = {
      querySelectorAll: () => [
        {
          dataset: { mermaidSource: 'invalid' },
          querySelector: () => null,
        },
      ],
    };
    const map = captureMermaidSvgs(root);
    expect(map.size).toBe(0);
  });
});
