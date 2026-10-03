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

    // Lazy-load: o módulo resolve em microtask antes do primeiro render.
    await vi.waitFor(() => expect(mermaidState.render).toHaveBeenCalledTimes(1));
    // A segunda passagem não partiu — o single-flight ainda segura uma em voo.
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
    // Só depois do primeiro render entrar em voo a segunda passagem incrementa
    // renderVersion: quando a primeira terminar, ela não escreve o SVG obsoleto.
    await vi.waitFor(() => expect(mermaidState.render).toHaveBeenCalledTimes(1));
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
    // O lazy-load do mermaid resolve em microtask após o timer disparar.
    await vi.waitFor(() => expect(mermaidState.render).toHaveBeenCalledTimes(1));
  });

  it('M7: agendamento feito enquanto pausado é reposto no resume', async () => {
    pauseMermaidScheduling();
    scheduleMermaidRender(10);
    await vi.advanceTimersByTimeAsync(50);
    expect(mermaidState.render).not.toHaveBeenCalled();

    resumeMermaidScheduling();
    await vi.advanceTimersByTimeAsync(300);
    expect(mermaidState.render).toHaveBeenCalledTimes(1);
  });

  it('M7: render que o pause cancela também é reposto no resume', async () => {
    scheduleMermaidRender(10);
    pauseMermaidScheduling();
    await vi.advanceTimersByTimeAsync(50);
    expect(mermaidState.render).not.toHaveBeenCalled();

    resumeMermaidScheduling();
    await vi.advanceTimersByTimeAsync(300);
    expect(mermaidState.render).toHaveBeenCalledTimes(1);
  });

  it('M7: resume sem pedido pendente não renderiza à toa', async () => {
    pauseMermaidScheduling();
    resumeMermaidScheduling();
    await vi.advanceTimersByTimeAsync(300);
    expect(mermaidState.render).not.toHaveBeenCalled();
  });
});

describe('guards de corrida e isolamento de falha (M12)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('falha em um diagrama não aborta os demais da mesma passagem', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="mermaid">quebrado</div><div class="mermaid">saudavel</div>';
    mermaidState.render
      .mockRejectedValueOnce(new Error('Parse error on line 1'))
      .mockResolvedValueOnce({ svg: '<svg>ok</svg>', bindFunctions: undefined });

    await renderMermaidDiagramsIn(root);

    const [bad, good] = root.querySelectorAll('.mermaid');
    expect(bad.classList.contains('mermaid-error')).toBe(true);
    expect(bad.textContent).toContain('Parse error on line 1');
    expect(good.classList.contains('mermaid-error')).toBe(false);
    expect(good.innerHTML).toBe('<svg>ok</svg>');
  });

  it('um erro que escapa do loop não prende o single-flight (sem deadlock)', async () => {
    mermaidState.initialize.mockImplementationOnce(() => {
      throw new Error('initialize falhou');
    });
    const root = mermaidRoot();

    await expect(renderMermaidDiagramsIn(root)).rejects.toThrow('initialize falhou');

    mermaidState.render.mockResolvedValueOnce({
      svg: '<svg>depois</svg>',
      bindFunctions: undefined,
    });
    await renderMermaidDiagramsIn(root);

    expect(root.querySelector('.mermaid').innerHTML).toBe('<svg>depois</svg>');
  });

  it('chamadas concorrentes após uma falha compartilham o mesmo lock novo', async () => {
    mermaidState.initialize.mockImplementationOnce(() => {
      throw new Error('primeira falha');
    });
    const root = mermaidRoot();
    await expect(renderMermaidDiagramsIn(root)).rejects.toThrow('primeira falha');

    mermaidState.render.mockResolvedValue({ svg: '<svg>final</svg>', bindFunctions: undefined });
    await Promise.all([renderMermaidDiagramsIn(root), renderMermaidDiagramsIn(root)]);

    expect(root.querySelector('.mermaid').innerHTML).toBe('<svg>final</svg>');
  });

  it('bindFunctions é aplicado quando o mermaid devolve a função de ligação', async () => {
    const root = mermaidRoot();
    const bindFunctions = vi.fn();
    mermaidState.render.mockResolvedValueOnce({ svg: '<svg>ligado</svg>', bindFunctions });

    await renderMermaidDiagramsIn(root);

    expect(bindFunctions).toHaveBeenCalledTimes(1);
    expect(bindFunctions).toHaveBeenCalledWith(root.querySelector('.mermaid'));
  });
});

describe('D1/D2 — resiliência do import do mermaid', () => {
  afterEach(() => {
    vi.doUnmock('mermaid');
    vi.resetModules();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('D1: falha transitória do chunk libera o guarda e o próximo render tenta de novo', async () => {
    vi.resetModules();
    let attempts = 0;
    vi.doMock('mermaid', () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('chunk falhou');
      }
      return { default: mermaidState };
    });
    const mod = await import('../../src/render/mermaid.js');
    document.body.innerHTML = '<div id="output"><div class="mermaid">graph TD; A</div></div>';

    await expect(mod.renderMermaidDiagramsNow()).rejects.toThrow();
    // sem o catch que limpa o guarda, esta segunda chamada rejeitaria de novo
    await mod.renderMermaidDiagramsNow();
    expect(attempts).toBe(2);
  });

  it('D2: rejeição agendada no timer não vira unhandled rejection', async () => {
    vi.resetModules();
    vi.doMock('mermaid', () => {
      throw new Error('chunk falhou');
    });
    const mod = await import('../../src/render/mermaid.js');
    document.body.innerHTML = '<div id="output"><div class="mermaid">graph TD; A</div></div>';

    mod.scheduleMermaidRender(5);
    await new Promise((r) => setTimeout(r, 40));
    // vitest reprovaria o arquivo em unhandled rejection — não houve.
  });
});

describe('H2 — handoff preview→PDF (dataset.mermaidSource)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renderMermaidDiagramsIn grava o dataset que o captureMermaidSvgs usa como chave', async () => {
    const root = mermaidRoot();
    await renderMermaidDiagramsIn(root);
    const el = root.querySelector('.mermaid');
    expect(el.dataset.mermaidSource).toBe('graph TD; A');
  });
});
