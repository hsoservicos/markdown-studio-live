import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setLocale } from '../../src/i18n/index.js';
import { setupPrintSettingsDialog } from '../../src/ui/printSettingsDialog.js';
import { PRINT_SETTINGS_KEY, savePrintSettings } from '../../src/ui/printSettings.js';

function buildDialog() {
  const element = document.createElement('div');
  element.innerHTML = `
    <form id="print-settings-form">
      <input id="print-margin" type="number" />
      <select id="print-paper"><option value="a4">A4</option><option value="letter">Letter</option></select>
      <select id="print-orientation">
        <option value="portrait">Retrato</option>
        <option value="landscape">Paisagem</option>
      </select>
      <input id="print-header" type="text" />
      <input id="print-footer" type="text" />
      <button type="submit">Salvar</button>
    </form>
    <button id="print-settings-close">Fechar</button>
    <dialog id="print-settings-dialog"></dialog>
  `;
  const dialog = element.querySelector('#print-settings-dialog');
  dialog.showModal = vi.fn(() => {
    dialog.open = true;
  });
  dialog.close = vi.fn(() => {
    dialog.open = false;
  });
  dialog.removeAttribute = vi.fn();
  dialog.setAttribute = vi.fn();
  return element;
}

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

describe('setupPrintSettingsDialog', () => {
  let container;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: fakeStorage(),
      writable: true,
      configurable: true,
    });
    setLocale('pt-BR');
    container = buildDialog();
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('abre o diálogo e popula os campos com as preferências salvas', () => {
    savePrintSettings({ margin: 12, paperSize: 'letter', orientation: 'landscape' }, localStorage);
    const api = setupPrintSettingsDialog({ container });
    api.open();
    const dialog = container.querySelector('#print-settings-dialog');
    expect(dialog.showModal).toHaveBeenCalled();
    expect(container.querySelector('#print-margin').value).toBe('12');
    expect(container.querySelector('#print-paper').value).toBe('letter');
    expect(container.querySelector('#print-orientation').value).toBe('landscape');
  });

  it('submete, salva e fecha', () => {
    const onSaved = vi.fn();
    const api = setupPrintSettingsDialog({ container, onSaved });
    api.open();
    const dialog = container.querySelector('#print-settings-dialog');
    const form = container.querySelector('#print-settings-form');
    container.querySelector('#print-margin').value = '25';
    container.querySelector('#print-paper').value = 'letter';
    container.querySelector('#print-orientation').value = 'landscape';
    container.querySelector('#print-header').value = 'Relatório';
    container.querySelector('#print-footer').value = '{page}';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(dialog.close).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(PRINT_SETTINGS_KEY))).toMatchObject({
      margin: 25,
      paperSize: 'letter',
      orientation: 'landscape',
      headerText: 'Relatório',
      footerText: '{page}',
    });
  });

  it('botão fechar fecha o diálogo', () => {
    const api = setupPrintSettingsDialog({ container });
    api.open();
    container.querySelector('#print-settings-close').click();
    expect(container.querySelector('#print-settings-dialog').close).toHaveBeenCalled();
  });

  it('retorna null sem diálogo no container', () => {
    expect(setupPrintSettingsDialog({ container: document.createElement('div') })).toBeNull();
  });
});
