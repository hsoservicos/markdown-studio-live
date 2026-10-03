import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isMarkdownPath,
  toMarkdownName,
  sanitizeDownloadName,
  readFileAsText,
  supportsOpenPicker,
  supportsWriteOn,
  downloadBlob,
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

  describe('sanitizeDownloadName (AC-P2-10-3)', () => {
    it('remove extensão antiga e acrescenta a extensão pedida', () => {
      expect(sanitizeDownloadName('notas.md', '.pdf')).toBe('notas.pdf');
      expect(sanitizeDownloadName('relatorio.html', '.html')).toBe('relatorio.html');
      expect(sanitizeDownloadName('sem extensao', '.pdf')).toBe('sem extensao.pdf');
    });

    it('remove caracteres inválidos de arquivo e colapsa espaços', () => {
      expect(sanitizeDownloadName('a/b\\c:d*e?f"g<h>i|j', '.pdf')).toBe('a b c d e f g h i j.pdf');
      expect(sanitizeDownloadName('  nome   com\tquebras  ', '.pdf')).toBe('nome com quebras.pdf');
    });

    it('remove caracteres de controle', () => {
      expect(sanitizeDownloadName('no\u0000me\u001fok', '.pdf')).toBe('nomeok.pdf');
    });

    it('corta em 80 caracteres e não termina em ponto/espaço', () => {
      const longo = 'x'.repeat(200);
      expect(sanitizeDownloadName(longo, '.pdf')).toBe('x'.repeat(80) + '.pdf');
      expect(sanitizeDownloadName('nome...', '.pdf')).toBe('nome.pdf');
    });

    it('cai no fallback quando o nome fica vazio', () => {
      expect(sanitizeDownloadName('', '.pdf')).toBe('markdown-preview.pdf');
      expect(sanitizeDownloadName('   ', '.pdf')).toBe('markdown-preview.pdf');
      expect(sanitizeDownloadName(undefined, '.pdf')).toBe('markdown-preview.pdf');
      expect(sanitizeDownloadName('...', '.html', 'document')).toBe('document.html');
    });

    it('cai no fallback para nomes reservados do Windows (case-insensitive)', () => {
      expect(sanitizeDownloadName('CON', '.pdf')).toBe('markdown-preview.pdf');
      expect(sanitizeDownloadName('nul.md', '.pdf')).toBe('markdown-preview.pdf');
      expect(sanitizeDownloadName('com1.txt', '.html', 'document')).toBe('document.html');
      expect(sanitizeDownloadName('console.md', '.pdf')).toBe('console.pdf');
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

  describe('downloadBlob', () => {
    it('cria anchor com download e revoga o object URL', () => {
      vi.useFakeTimers();
      const click = vi.fn();
      const remove = vi.fn();
      const appendChild = vi.fn();
      const createObjectURL = vi.fn(() => 'blob:x');
      const revokeObjectURL = vi.fn();
      const originalURL = globalThis.URL;
      const originalCreate = document.createElement.bind(document);
      globalThis.URL = { createObjectURL, revokeObjectURL };
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return { href: '', download: '', click, remove };
        }
        return originalCreate(tag);
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation(appendChild);

      downloadBlob('nota.html', '<p>x</p>', 'text/html;charset=utf-8');
      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(remove).toHaveBeenCalled();
      expect(appendChild).toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');

      document.createElement.mockRestore();
      document.body.appendChild.mockRestore();
      globalThis.URL = originalURL;
      vi.useRealTimers();
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
