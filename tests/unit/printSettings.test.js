import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DEFAULT_PRINT_SETTINGS,
  PRINT_SETTINGS_KEY,
  normalizePrintSettings,
  loadPrintSettings,
  savePrintSettings,
  stampPageHeaderFooter,
  getPrintStylesheetCss,
  applyPrintSettingsCss,
  PRINT_STYLE_ID,
  hasHeadersOrFooter,
} from '../../src/ui/printSettings.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    clear: () => map.clear(),
  };
}

afterEach(() => {
  document.querySelectorAll(`#${PRINT_STYLE_ID}`).forEach((el) => el.remove());
  vi.restoreAllMocks();
});

describe('normalizePrintSettings', () => {
  it('aplica defaults para valores ausentes/inválidos', () => {
    expect(normalizePrintSettings({ margin: -5 })).toMatchObject({
      margin: 0,
      paperSize: 'a4',
      orientation: 'portrait',
      headerText: '',
      footerText: '',
    });
    expect(normalizePrintSettings({ paperSize: 'tabloid' })).toMatchObject({
      paperSize: 'a4',
      orientation: 'portrait',
    });
    expect(normalizePrintSettings({ margin: 99 })).toMatchObject({ margin: 40 });
  });

  it('limita texto a 200 caracteres', () => {
    const settings = normalizePrintSettings({ headerText: 'x'.repeat(300) });
    expect(settings.headerText).toHaveLength(200);
  });

  it('persiste margem/orientação válidas', () => {
    expect(
      normalizePrintSettings({ margin: 12, orientation: 'landscape', paperSize: 'letter' }),
    ).toMatchObject({ margin: 12, orientation: 'landscape', paperSize: 'letter' });
  });
});

describe('load/save', () => {
  it('retorna defaults sem storage', () => {
    expect(loadPrintSettings(fakeStorage())).toEqual(DEFAULT_PRINT_SETTINGS);
  });

  it('load tolera JSON corrompido', () => {
    const storage = fakeStorage({ [PRINT_SETTINGS_KEY]: '{não-json' });
    expect(loadPrintSettings(storage)).toEqual(DEFAULT_PRINT_SETTINGS);
  });

  it('carrega parcial e normaliza', () => {
    const storage = fakeStorage({
      [PRINT_SETTINGS_KEY]: JSON.stringify({ orientation: 'landscape', margin: 'abc' }),
    });
    expect(loadPrintSettings(storage)).toEqual({
      margin: 10,
      paperSize: 'a4',
      orientation: 'landscape',
      headerText: '',
      footerText: '',
    });
  });

  it('save persiste normalizado', () => {
    const storage = fakeStorage();
    const saved = savePrintSettings({ margin: 25, paperSize: 'letter' }, storage);
    expect(saved.margin).toBe(25);
    expect(JSON.parse(storage.getItem(PRINT_SETTINGS_KEY))).toMatchObject({
      margin: 25,
      paperSize: 'letter',
      orientation: 'portrait',
    });
  });

  it('save não lança com storage indisponível', () => {
    const broken = {
      getItem: () => null,
      setItem: () => () => {
        throw new Error('denied');
      },
    };
    expect(savePrintSettings({ margin: 8 }, broken)).toMatchObject({ margin: 8 });
  });
});

describe('stampPageHeaderFooter', () => {
  function fakePdf() {
    const subscribes = [];
    let page = 1;
    return {
      internal: {
        pageSize: { getWidth: () => 210 },
        events: { subscribe: (name, cb) => subscribes.push({ name, cb }) },
      },
      currentPage: page,
      setFontSize: vi.fn(),
      text: vi.fn(),
      getCurrentPageInfo: () => ({ pageNumber: page }),
      _bumpPage: () => {
        page += 1;
        subscribes.forEach((s) => s.name === 'addPage' && s.cb());
      },
    };
  }

  it('não faz nada sem pdf válido', () => {
    expect(() => stampPageHeaderFooter(null)).not.toThrow();
    expect(() => stampPageHeaderFooter({}, { headerText: 'x' })).not.toThrow();
  });

  it('não escreve quando não há cabeçalho/rodapé', () => {
    const pdf = fakePdf();
    stampPageHeaderFooter(pdf, { headerText: '', footerText: '' });
    expect(pdf.text).not.toHaveBeenCalled();
  });

  it('estampa cabeçalho/rodapé e resolve {page}', () => {
    const pdf = fakePdf();
    stampPageHeaderFooter(pdf, { headerText: 'Relatório', footerText: 'Página {page}' });
    expect(pdf.text).toHaveBeenCalledWith('Relatório', 105, 5, { align: 'center' });
    expect(pdf.text).toHaveBeenCalledWith('Página 1', 105, 287, { align: 'center' });
  });

  it('repete em páginas novas via addPage', () => {
    const pdf = fakePdf();
    stampPageHeaderFooter(pdf, { footerText: '{page}' });
    pdf._bumpPage();
    expect(pdf.text).toHaveBeenLastCalledWith('2', 105, 287, { align: 'center' });
  });
});

describe('getPrintStylesheetCss', () => {
  it('gera @page com papel/orientação/margem', () => {
    const css = getPrintStylesheetCss({ paperSize: 'letter', orientation: 'landscape', margin: 5 });
    expect(css).toContain('@page { size: letter landscape; margin: 5mm; }');
  });

  it('inclui quebras conscientes e o marcador .page-break', () => {
    const css = getPrintStylesheetCss();
    expect(css).toContain('.page-break { break-after: page; page-break-after: always; }');
    expect(css).toContain('break-inside: avoid');
    expect(css).toContain('.markdown-body table');
    expect(css).toContain('.print-page-header');
  });
});

describe('applyPrintSettingsCss', () => {
  it('injeta <style id="print-settings-style"> com o CSS', () => {
    const style = applyPrintSettingsCss({ margin: 3 });
    expect(style.id).toBe(PRINT_STYLE_ID);
    expect(document.getElementById(PRINT_STYLE_ID)).toBe(style);
    expect(style.textContent).toContain('@page');
  });

  it('atualiza style existente em vez de duplicar', () => {
    const first = applyPrintSettingsCss({ margin: 3 });
    const second = applyPrintSettingsCss({ margin: 30 });
    expect(document.querySelectorAll(`#${PRINT_STYLE_ID}`)).toHaveLength(1);
    expect(first).toBe(second);
    expect(second.textContent).toContain('margin: 30mm');
  });
});

describe('hasHeadersOrFooter', () => {
  it('detecta presença de cabeçalho/rodapé', () => {
    expect(hasHeadersOrFooter({ headerText: 'x', footerText: '' })).toBe(true);
    expect(hasHeadersOrFooter({ footerText: '{page}' })).toBe(true);
    expect(hasHeadersOrFooter({})).toBe(false);
  });
});
