import { describe, it, expect, vi } from 'vitest';
import { computePreviewTargetY, scrollPreviewTo } from '../../src/ui/scrollSync.js';

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

describe('scrollPreviewTo', () => {
  it('chama scrollTo no preview com o target calculado', () => {
    const scrollTo = vi.fn();
    const previewElement = {
      scrollHeight: 2000,
      clientHeight: 600,
      scrollTo,
    };
    const editor = {
      getLayoutInfo: () => ({ height: 500 }),
    };
    const editorEvent = {
      scrollTop: 250,
      scrollHeight: 1000,
    };
    scrollPreviewTo(editorEvent, editor, previewElement);
    expect(scrollTo).toHaveBeenCalledWith(0, 700);
  });

  it('chama scrollTo(0, 0) quando editor está no topo', () => {
    const scrollTo = vi.fn();
    const previewElement = {
      scrollHeight: 2000,
      clientHeight: 600,
      scrollTo,
    };
    const editor = {
      getLayoutInfo: () => ({ height: 500 }),
    };
    const editorEvent = {
      scrollTop: 0,
      scrollHeight: 1000,
    };
    scrollPreviewTo(editorEvent, editor, previewElement);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
