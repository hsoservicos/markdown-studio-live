import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    // fallback A4 (297mm) quando o jsPDF não expõe getHeight
    expect(pdf.text).toHaveBeenCalledWith('Página 1', 105, 287, { align: 'center' });
  });

  it('D5: rodapé é posicionado pela altura real da página (Letter pisa fora em 287 fixo)', () => {
    const pdf = fakePdf();
    pdf.internal.pageSize.getHeight = () => 279;
    stampPageHeaderFooter(pdf, { footerText: 'F' });
    expect(pdf.text).toHaveBeenCalledWith('F', 105, 269, { align: 'center' });
  });

  it('D6: sem jsPDF avisa em vez de perder o carimbo em silêncio', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stampPageHeaderFooter({}, { headerText: 'Cabeçalho', footerText: '' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('jsPDF indisponível'));
    warn.mockRestore();
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
    // D9: header/footer com {page} são exclusivos do PDF — as regras CSS
    // `.print-page-header/.print-page-footer` eram mortas (nenhum código cria
    // esses elementos) e prometiam o que o browser não entrega.
    expect(css).not.toContain('.print-page-header');
    expect(css).not.toContain('.print-page-footer');
  });
});

describe('contrato @media print do app (style.css real)', () => {
  const styleCss = readFileSync(resolve(process.cwd(), 'public/css/style.css'), 'utf8');
  const printBlock = styleCss.slice(styleCss.indexOf('@media print'));

  it('esconde a chrome do app na impressão e imprime só o documento', () => {
    expect(printBlock).toContain('@media print');
    const hideGroup = printBlock.slice(0, printBlock.indexOf('display: none'));
    // Cada seletor precisa existir como item da lista (linha própria), não como
    // substring — `.manual-dialog` não satisfaz `dialog`.
    const emLinhaPropria = (grupo, sel) =>
      grupo.includes(`\n  ${sel},`) || grupo.includes(`\n  ${sel} {`);
    for (const seletor of [
      'header',
      'footer',
      '#sidebar',
      '.split-divider',
      '.editor-pane',
      '.manual-dialog',
      '.skip-link',
      'dialog',
    ]) {
      expect(
        emLinhaPropria(hideGroup, seletor),
        `seletor ${seletor} ausente no grupo escondido`,
      ).toBe(true);
    }
  });

  it('libera o preview em largura total e força texto legível no papel', () => {
    expect(printBlock).toContain('#preview-wrapper');
    expect(printBlock).toContain('#container');
    expect(printBlock).toContain('width: 100%');
    expect(printBlock).toContain('color: #1f2328');
    expect(printBlock).toContain('background-color: #ffffff');
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
