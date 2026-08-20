import { describe, it, expect, afterEach, vi } from 'vitest';
import { setupDivider } from '../../src/ui/divider.js';

function pointerEvent(type, { clientX = 0, clientY = 0, pointerId = 1 } = {}) {
  const event = new window.MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

function buildLayout({ width = 800, height = 600, dividerSize = 10, stacked = false } = {}) {
  document.body.innerHTML = `
    <div id="container">
      <div id="edit"></div>
      <div id="split-divider"></div>
      <div id="preview"></div>
    </div>
  `;
  const container = document.getElementById('container');
  const leftPane = document.getElementById('edit');
  const rightPane = document.getElementById('preview');
  const divider = document.getElementById('split-divider');

  Object.defineProperty(container, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ width, height, left: 0, top: 0 }),
  });
  Object.defineProperty(divider, 'offsetWidth', { configurable: true, value: dividerSize });
  Object.defineProperty(divider, 'offsetHeight', { configurable: true, value: dividerSize });
  divider.setPointerCapture = vi.fn();
  divider.releasePointerCapture = vi.fn();

  globalThis.matchMedia = (query) => ({ matches: stacked, media: query });
  return { container, leftPane, rightPane, divider };
}

describe('setupDivider', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    globalThis.matchMedia = undefined;
    vi.restoreAllMocks();
  });

  it('não faz nada quando os elementos não existem', () => {
    document.body.innerHTML = '<div id="container"></div>';
    expect(() => setupDivider()).not.toThrow();
  });

  it('arrasta redimensionando os painéis (desktop, col-resize)', () => {
    const { leftPane, rightPane, divider } = buildLayout({ width: 800, dividerSize: 10 });
    setupDivider();

    divider.dispatchEvent(pointerEvent('pointerdown'));
    divider.dispatchEvent(pointerEvent('pointermove', { clientX: 300 }));

    expect(leftPane.style.width).toBe('300px');
    expect(rightPane.style.width).toBe('490px');
    expect(document.body.style.cursor).toBe('col-resize');
  });

  it('ignora pointermove sem arrasto ativo', () => {
    const { leftPane, rightPane, divider } = buildLayout({ width: 800, dividerSize: 10 });
    setupDivider();

    divider.dispatchEvent(pointerEvent('pointermove', { clientX: 300 }));

    expect(leftPane.style.width).toBe('');
    expect(rightPane.style.width).toBe('');
  });

  it('arrasta na vertical quando empilhado (mobile, row-resize)', () => {
    const { leftPane, rightPane, divider } = buildLayout({
      height: 600,
      dividerSize: 5,
      stacked: true,
    });
    setupDivider();

    divider.dispatchEvent(pointerEvent('pointerdown'));
    divider.dispatchEvent(pointerEvent('pointermove', { clientY: 200 }));

    expect(leftPane.style.height).toBe('200px');
    expect(rightPane.style.height).toBe('395px');
    expect(document.body.style.cursor).toBe('row-resize');
  });

  it('solta o ponteiro ao finalizar o arrasto', () => {
    const { divider } = buildLayout({ width: 800 });
    setupDivider();

    divider.dispatchEvent(pointerEvent('pointerdown'));
    divider.dispatchEvent(pointerEvent('pointerup'));
    expect(divider.releasePointerCapture).toHaveBeenCalled();
    expect(document.body.style.cursor).toBe('default');
  });

  it('dblclick divide os painéis ao meio', () => {
    const { leftPane, rightPane, divider } = buildLayout({ width: 800, dividerSize: 10 });
    setupDivider();

    divider.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));

    expect(leftPane.style.width).toBe('395px');
    expect(rightPane.style.width).toBe('395px');
  });

  it('resize reaplica a última proporção por painel', () => {
    const { container, leftPane, rightPane, divider } = buildLayout({
      width: 800,
      dividerSize: 10,
    });
    setupDivider();

    divider.dispatchEvent(pointerEvent('pointerdown'));
    divider.dispatchEvent(pointerEvent('pointermove', { clientX: 300 }));
    divider.dispatchEvent(pointerEvent('pointerup'));

    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 1000, height: 600, left: 0, top: 0 }),
    });
    window.dispatchEvent(new window.Event('resize'));

    // lastLeftRatio = 300/(800-10) ≈ 0.3797 → novo width ≈ 1000*0.3797... ajustado
    const left = parseFloat(leftPane.style.width);
    const right = parseFloat(rightPane.style.width);
    expect(left).toBeCloseTo(375.95, 1);
    expect(right).toBeCloseTo(614.05, 1);
  });

  describe('B1 — acessibilidade por teclado', () => {
    const keydown = (key) =>
      new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

    it('setas ajustam em passos de 2% e atualizam aria-valuenow', () => {
      const { leftPane, divider } = buildLayout({ width: 800, dividerSize: 10 });
      setupDivider();

      const event = keydown('ArrowRight');
      divider.dispatchEvent(event);

      // 0.5 + 0.02 = 0.52 de 790px disponíveis = 410.8px
      expect(parseFloat(leftPane.style.width)).toBeCloseTo(410.8, 1);
      expect(divider.getAttribute('aria-valuenow')).toBe('52');
      expect(event.defaultPrevented).toBe(true);
    });

    it('ArrowLeft diminui e Home/End vão aos limites (clamp 100px)', () => {
      const { leftPane, divider } = buildLayout({ width: 800, dividerSize: 10 });
      setupDivider();

      divider.dispatchEvent(keydown('ArrowLeft'));
      expect(divider.getAttribute('aria-valuenow')).toBe('48');

      divider.dispatchEvent(keydown('Home'));
      expect(leftPane.style.width).toBe('100px'); // mínimo
      expect(divider.getAttribute('aria-valuenow')).toBe('13');

      divider.dispatchEvent(keydown('End'));
      expect(leftPane.style.width).toBe('700px'); // máximo (800-100)
      expect(divider.getAttribute('aria-valuenow')).toBe('89');
    });

    it('teclas sem ação não alteram nada', () => {
      const { leftPane, divider } = buildLayout({ width: 800, dividerSize: 10 });
      setupDivider();

      const event = keydown('Enter');
      divider.dispatchEvent(event);

      expect(leftPane.style.width).toBe('');
      expect(event.defaultPrevented).toBe(false);
    });

    it('aria-orientation acompanha o layout (vertical/horizontal)', () => {
      const { divider } = buildLayout({ width: 800, stacked: false });
      setupDivider();
      expect(divider.getAttribute('aria-orientation')).toBe('vertical');

      document.body.innerHTML = '';
      const stacked = buildLayout({ height: 600, stacked: true });
      setupDivider();
      expect(stacked.divider.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('teclado também funciona empilhado (altura)', () => {
      const { leftPane, divider } = buildLayout({ height: 600, dividerSize: 10, stacked: true });
      setupDivider();

      divider.dispatchEvent(keydown('ArrowDown'));

      // 0.52 de 590px disponíveis = 306.8px
      expect(parseFloat(leftPane.style.height)).toBeCloseTo(306.8, 1);
      expect(divider.getAttribute('aria-valuenow')).toBe('52');
    });
  });
});
