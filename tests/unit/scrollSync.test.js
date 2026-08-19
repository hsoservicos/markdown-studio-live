import { describe, it, expect } from 'vitest';
import { computePreviewTargetY } from '../../src/ui/scrollSync.js';

describe('computePreviewTargetY (sync de scroll por proporção)', () => {
  function fakePreview(scrollHeight, clientHeight) {
    return { scrollHeight, clientHeight };
  }

  it('mapeia topo do editor para topo do preview', () => {
    const preview = fakePreview(2000, 600);
    expect(computePreviewTargetY(0, 1000, 500, preview)).toBe(0);
  });

  it('mapeia fundo do editor para fundo do preview', () => {
    const preview = fakePreview(2000, 600);
    const maxPreviewScroll = 2000 - 600; // 1400
    expect(computePreviewTargetY(500, 1000, 500, preview)).toBe(maxPreviewScroll);
  });

  it('retorna 0 quando não há rolagem no editor (maxScrollTop ≤ 0)', () => {
    const preview = fakePreview(800, 600);
    expect(computePreviewTargetY(0, 400, 400, preview)).toBe(0);
  });

  it('valor intermediário é proporcional', () => {
    const preview = fakePreview(1000, 500); // maxPreview = 500
    expect(computePreviewTargetY(100, 1000, 500, preview)).toBe(100);
  });
});
