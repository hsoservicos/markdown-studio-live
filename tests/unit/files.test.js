import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isMarkdownPath,
  toMarkdownName,
  readFileAsText,
  supportsOpenPicker,
  supportsWriteOn,
  MARKDOWN_ACCEPT,
} from '../../src/ui/files.js';

describe('files helpers', () => {
  describe('isMarkdownPath', () => {
    it('aceita extensões de markdown', () => {
      expect(isMarkdownPath('a.md')).toBe(true);
      expect(isMarkdownPath('a.markdown')).toBe(true);
      expect(isMarkdownPath('a.mdown')).toBe(true);
      expect(isMarkdownPath('a.mkd')).toBe(true);
      expect(isMarkdownPath('a.txt')).toBe(true);
    });

    it('rejeita nomes sem extensão markdown', () => {
      expect(isMarkdownPath('a.doc')).toBe(false);
      expect(isMarkdownPath('a')).toBe(false);
      expect(isMarkdownPath('')).toBe(false);
    });

    it('não considera diretório em path de extensão', () => {
      expect(isMarkdownPath('pasta/com.ext/a')).toBe(false);
    });
  });

  describe('toMarkdownName', () => {
    it('mantém nome já markdown', () => {
      expect(toMarkdownName('nota.md')).toBe('nota.md');
      expect(toMarkdownName('Nota.MARKDOWN')).toBe('Nota.MARKDOWN');
    });

    it('mantém extensão de texto aceita (txt)', () => {
      expect(toMarkdownName('nota.txt')).toBe('nota.txt');
    });

    it('acrescenta .md quando não há extensão', () => {
      expect(toMarkdownName('nota')).toBe('nota.md');
      expect(toMarkdownName('')).toBe('untitled.md');
      expect(toMarkdownName()).toBe('untitled.md');
    });
  });

  describe('readFileAsText', () => {
    it('usa file.text quando disponível', async () => {
      const file = { text: async () => 'conteúdo' };
      await expect(readFileAsText(file)).resolves.toBe('conteúdo');
    });

    it('cai para FileReader quando file.text ausente', async () => {
      const file = { name: 'a.md' };
      const reader = {
        onload: null,
        onerror: null,
        result: 'via reader',
        readAsText: (f) => {
          expect(f).toBe(file);
          queueMicrotask(() => reader.onload({}));
        },
      };
      class FakeFileReader {
        constructor() {
          return reader;
        }
      }
      const original = globalThis.FileReader;
      globalThis.FileReader = FakeFileReader;
      try {
        await expect(readFileAsText(file)).resolves.toBe('via reader');
      } finally {
        globalThis.FileReader = original;
      }
    });

    it('rejeita quando FileReader falha', async () => {
      const file = { name: 'a.md' };
      const reader = {
        onload: null,
        onerror: null,
        error: new Error('leitura-falhou'),
        readAsText: () => queueMicrotask(() => reader.onerror({})),
      };
      class FakeFileReader {
        constructor() {
          return reader;
        }
      }
      const original = globalThis.FileReader;
      globalThis.FileReader = FakeFileReader;
      try {
        await expect(readFileAsText(file)).rejects.toThrow('leitura-falhou');
      } finally {
        globalThis.FileReader = original;
      }
    });
  });

  describe('MARKDOWN_ACCEPT', () => {
    it('aceita tipos text/markdown', () => {
      expect(MARKDOWN_ACCEPT.accept['text/markdown']).toContain('.md');
    });
  });

  describe('supportsOpenPicker / supportsWriteOn (fallbacks FF/Safari)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      delete globalThis.window;
    });

    it('reconhece suporte ao picker nativo', () => {
      globalThis.window = {
        isSecureContext: true,
        showOpenFilePicker: vi.fn(),
      };
      expect(supportsOpenPicker()).toBe(true);
    });

    it('não usa picker fora de contexto seguro', () => {
      globalThis.window = { isSecureContext: false };
      expect(supportsOpenPicker()).toBe(false);
      globalThis.window = { showOpenFilePicker: vi.fn() };
      expect(supportsOpenPicker()).toBe(false);
    });

    it('sem window, não há picker', () => {
      expect(supportsOpenPicker()).toBe(false);
    });

    it('detecta handle gravável por createWritable', () => {
      expect(supportsWriteOn({ createWritable: vi.fn() })).toBe(true);
      expect(supportsWriteOn({})).toBe(false);
      expect(supportsWriteOn(null)).toBe(false);
      expect(supportsWriteOn()).toBe(false);
    });
  });
});
