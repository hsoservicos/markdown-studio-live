import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mermaidState = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(() => Promise.resolve({ svg: '<svg>ok</svg>', bindFunctions: undefined })),
}));

vi.mock('mermaid', () => ({ default: mermaidState }));

import {
  renderMermaidDiagramsIn,
  scheduleMermaidRender,
  pauseMermaidScheduling,
  resumeMermaidScheduling,
} from '../../src/render/mermaid.js';

function makeDeferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function mermaidRoot() {
  const root = document.createElement('div');
  root.innerHTML = '<div class="mermaid">graph TD; A</div>';
  return root;
}

describe('renderMermaidDiagramsIn (single-flight)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('serializa chamadas concorrentes ao mermaid.render', async () => {
    const root = mermaidRoot();
    const first = makeDeferred();
    mermaidState.render
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(
        Promise.resolve({ svg: '<svg>segunda</svg>', bindFunctions: undefined }),
      );

    const p1 = renderMermaidDiagramsIn(root);
    const p2 = renderMermaidDiagramsIn(root);

    // A primeira passagem já iniciou o mermaid.render; a segunda só aguarda.
    expect(mermaidState.render).toHaveBeenCalledTimes(1);

    first.resolve({ svg: '<svg>primeira</svg>', bindFunctions: undefined });
    await p1;
    await p2;

    expect(mermaidState.render).toHaveBeenCalledTimes(2);
    expect(root.querySelector('.mermaid').innerHTML).toBe('<svg>segunda</svg>');
  });

  it('aguarda a passagem em voo e ainda aplica o version-guard', async () => {
    const root = mermaidRoot();
    const first = makeDeferred();
    mermaidState.render.mockReturnValueOnce(first.promise);

    const p1 = renderMermaidDiagramsIn(root);
    const p2 = renderMermaidDiagramsIn(root);
    // Segunda passagem incrementa renderVersion: quando a primeira terminar,
    // ela não deve escrever o SVG obsoleto.
    first.resolve({ svg: '<svg>stale</svg>', bindFunctions: undefined });
    await p1;
    await p2;

    expect(root.querySelector('.mermaid').innerHTML).not.toContain('stale');
  });

  it('não faz nada quando não há root', async () => {
    await expect(renderMermaidDiagramsIn(null)).resolves.toBeUndefined();
    expect(mermaidState.render).not.toHaveBeenCalled();
  });
});

describe('pauseMermaidScheduling / resumeMermaidScheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="output"><div class="mermaid">graph TD; A</div></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('pausado, um agendamento pendente é cancelado e nenhum novo render ocorre', async () => {
    scheduleMermaidRender(10);
    pauseMermaidScheduling();
    await vi.advanceTimersByTimeAsync(30);
    expect(mermaidState.render).not.toHaveBeenCalled();

    scheduleMermaidRender(10);
    await vi.advanceTimersByTimeAsync(30);
    expect(mermaidState.render).not.toHaveBeenCalled();
  });

  it('resume restaura o agendamento', async () => {
    pauseMermaidScheduling();
    resumeMermaidScheduling();
    scheduleMermaidRender(10);
    await vi.advanceTimersByTimeAsync(30);
    expect(mermaidState.render).toHaveBeenCalledTimes(1);
  });
});
