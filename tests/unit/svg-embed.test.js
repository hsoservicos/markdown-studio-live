import { describe, it, expect } from 'vitest';
import { svgToDataUrl, captureMermaidSvgs } from '../../src/pdf/svg-embed.js';

describe('svgToDataUrl', () => {
  it('converte SVG válido para data URL', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Hi</text></svg>';
    const result = svgToDataUrl(svg);
    expect(result).toMatch(/^data:image\/svg\+xml,/);
    expect(result).toContain('Hi');
  });

  it('retorna null para input vazio', () => {
    expect(svgToDataUrl(null)).toBeNull();
    expect(svgToDataUrl('')).toBeNull();
    expect(svgToDataUrl(undefined)).toBeNull();
  });

  it('retorna null para input que não é SVG', () => {
    expect(svgToDataUrl('not svg')).toBeNull();
    expect(svgToDataUrl('<div>html</div>')).toBeNull();
  });

  it('preserva aspas no SVG', () => {
    const svg = '<svg><text x="10" y="20">Test</text></svg>';
    const result = svgToDataUrl(svg);
    expect(result).toContain('%22');
  });
});

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
