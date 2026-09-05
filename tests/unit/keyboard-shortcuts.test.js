import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupKeyboardShortcuts } from '../../src/main.js';

describe('Keyboard Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <button data-sidebar-action="save"></button>
      <button data-sidebar-action="exportPdf"></button>
      <button data-sidebar-action="copyHtml"></button>
      <button data-sidebar-action="exportHtml"></button>
    `;
    setupKeyboardShortcuts();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Ctrl+S clica no botão save', () => {
    const saveBtn = document.querySelector('[data-sidebar-action="save"]');
    const clickSpy = vi.spyOn(saveBtn, 'click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('Ctrl+P clica no botão exportPdf', () => {
    const exportBtn = document.querySelector('[data-sidebar-action="exportPdf"]');
    const clickSpy = vi.spyOn(exportBtn, 'click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('Ctrl+B clica no botão copyHtml', () => {
    const copyBtn = document.querySelector('[data-sidebar-action="copyHtml"]');
    const clickSpy = vi.spyOn(copyBtn, 'click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('Ctrl+E clica no botão exportHtml', () => {
    const exportBtn = document.querySelector('[data-sidebar-action="exportHtml"]');
    const clickSpy = vi.spyOn(exportBtn, 'click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('atalho sem Ctrl não faz nada', () => {
    const saveBtn = document.querySelector('[data-sidebar-action="save"]');
    const clickSpy = vi.spyOn(saveBtn, 'click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('atalho com Meta (Cmd no Mac) funciona', () => {
    const saveBtn = document.querySelector('[data-sidebar-action="save"]');
    const clickSpy = vi.spyOn(saveBtn, 'click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }));
    expect(clickSpy).toHaveBeenCalled();
  });
});
