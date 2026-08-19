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
});
