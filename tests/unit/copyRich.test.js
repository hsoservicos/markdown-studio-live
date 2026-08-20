import { describe, it, expect, vi } from 'vitest';
import { supportsRichClipboard, copyRichHtml } from '../../src/ui/copyRich.js';

describe('copyRichHtml', () => {
  it('detecta suporte a ClipboardItem + write', () => {
    expect(supportsRichClipboard(undefined)).toBe(false);
    expect(supportsRichClipboard({ writeText: vi.fn() })).toBe(false);
    globalThis.ClipboardItem = function ClipboardItem() {};
    expect(supportsRichClipboard({ write: vi.fn(), writeText: vi.fn() })).toBe(true);
    delete globalThis.ClipboardItem;
  });

  it('copia HTML rico via ClipboardItem quando disponível', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    globalThis.ClipboardItem = function ClipboardItem(items) {
      this.items = items;
    };
    globalThis.Blob = class Blob {
      constructor(parts, opts) {
        this.parts = parts;
        this.type = opts?.type;
      }
    };
    const channel = await copyRichHtml({
      getHtml: () => '<p><strong>oi</strong></p>',
      getPlain: () => 'oi',
      clipboard: { write, writeText: vi.fn() },
    });
    expect(channel).toBe('rich');
    expect(write).toHaveBeenCalledTimes(1);
    const [items] = write.mock.calls[0];
    expect(items).toHaveLength(1);
    expect(items[0].items['text/html'].type).toBe('text/html');
    expect(items[0].items['text/plain'].type).toBe('text/plain');
    delete globalThis.ClipboardItem;
  });

  it('cai para writeText plain quando ClipboardItem indisponível', async () => {
    delete globalThis.ClipboardItem;
    const writeText = vi.fn().mockResolvedValue(undefined);
    const channel = await copyRichHtml({
      getHtml: () => '<em>x</em>',
      getPlain: () => 'x',
      clipboard: { writeText },
    });
    expect(channel).toBe('plain');
    expect(writeText).toHaveBeenCalledWith('x');
  });

  it('deriva plain do html quando getPlain omitido', async () => {
    delete globalThis.ClipboardItem;
    const writeText = vi.fn().mockResolvedValue(undefined);
    await copyRichHtml({
      getHtml: () => '<p>Hello <b>world</b></p>',
      clipboard: { writeText },
    });
    expect(writeText).toHaveBeenCalledWith('Hello world');
  });

  it('lança quando clipboard indisponível', async () => {
    delete globalThis.ClipboardItem;
    await expect(copyRichHtml({ getHtml: () => '<p>a</p>', clipboard: {} })).rejects.toThrow(
      'clipboard-unavailable',
    );
  });
});
