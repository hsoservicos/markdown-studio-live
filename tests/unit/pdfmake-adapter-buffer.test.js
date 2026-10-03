import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * A3: `getDocumentBuffer` só tinha `resolve`. Se o pdfmake nunca chamasse o
 * callback, a promise ficava pendurada para sempre e o `finally` de
 * exportPdfVector.js — que chama `resumeMermaidScheduling()` — nunca rodava,
 * deixando o mermaid mudo no resto da sessão.
 */

const harness = vi.hoisted(() => ({
  getBuffer: null,
}));

vi.mock('pdfmake/build/pdfmake.js', () => ({
  default: {
    createPdf: () => ({
      getBuffer: (cb) => harness.getBuffer(cb),
    }),
  },
}));

vi.mock('pdfmake/build/vfs_fonts.js', () => ({ default: {} }));

import { getDocumentBuffer } from '../../src/pdf/pdfmake-adapter.js';

async function flushMicrotasks() {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
}

describe('getDocumentBuffer (A3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness.getBuffer = (cb) => cb(new Uint8Array([1, 2, 3]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolve quando o callback chega e limpa o timeout', async () => {
    const promise = getDocumentBuffer({ content: [] });
    await flushMicrotasks();

    await expect(promise).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejeita quando o pdfmake nunca chama o callback (timeout de 30s)', async () => {
    harness.getBuffer = () => {};

    const promise = getDocumentBuffer({ content: [] });
    await flushMicrotasks();

    const assertion = expect(promise).rejects.toThrow(/não devolveu o buffer/);
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
  });

  it('não rejeita um callback atrasado que chega após o timeout', async () => {
    let late = null;
    harness.getBuffer = (cb) => {
      late = cb;
    };

    const promise = getDocumentBuffer({ content: [] });
    await flushMicrotasks();

    const assertion = expect(promise).rejects.toThrow(/não devolveu o buffer/);
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;

    late(new Uint8Array([9]));
    expect(vi.getTimerCount()).toBe(0);
  });
});
