import { describe, it, expect, vi } from 'vitest';
import {
  escapeHtmlAttr,
  buildStandaloneHtml,
  loadCssText,
  exportStandaloneHtml,
} from '../../src/ui/exportHtml.js';

describe('exportHtml', () => {
  describe('escapeHtmlAttr', () => {
    it('escapa caracteres perigosos', () => {
      expect(escapeHtmlAttr('a&b"c<d>e')).toBe('a&amp;b&quot;c&lt;d&gt;e');
    });
  });

  describe('buildStandaloneHtml', () => {
    it('embute body, título e CSS', () => {
      const html = buildStandaloneHtml('<h1>Oi</h1>', {
        title: 'Nota',
        cssText: '.x{color:red}',
        lang: 'en',
      });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('lang="en"');
      expect(html).toContain('<title>Nota</title>');
      expect(html).toContain('.x{color:red}');
      expect(html).toContain('<article class="markdown-body">');
      expect(html).toContain('<h1>Oi</h1>');
    });

    it('escapa título malicioso', () => {
      const html = buildStandaloneHtml('', { title: '"><script>x</script>' });
      expect(html).toContain('&quot;&gt;&lt;script&gt;x&lt;/script&gt;');
      expect(html).not.toContain('<script>x</script>');
    });
  });

  describe('loadCssText', () => {
    it('concatena respostas ok e ignora falhas', async () => {
      const fetchImpl = vi.fn(async (url) => {
        if (url.includes('ok')) {
          return { ok: true, text: async () => 'A' };
        }
        if (url.includes('fail')) {
          throw new Error('network');
        }
        return { ok: false, text: async () => 'B' };
      });
      const css = await loadCssText(['/ok.css', '/fail.css', '/nope.css'], fetchImpl);
      expect(css).toBe('A');
    });

    it('retorna vazio sem fetch', async () => {
      expect(await loadCssText(['/x.css'], undefined)).toBe('');
    });
  });

  describe('exportStandaloneHtml', () => {
    it('baixa .html com mime text/html', async () => {
      const download = vi.fn();
      const onStatus = vi.fn();
      const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => 'body{}' }));
      const name = await exportStandaloneHtml({
        getHtml: () => '<p>doc</p>',
        filename: 'relatorio.md',
        title: 'Relatório',
        lang: 'pt-BR',
        cssUrls: ['/css/x.css'],
        fetchImpl,
        download,
        onStatus,
      });
      expect(name).toMatch(/\.html$/i);
      expect(download).toHaveBeenCalledTimes(1);
      const [fileName, content, mime] = download.mock.calls[0];
      expect(fileName).toMatch(/\.html$/i);
      expect(content).toContain('<p>doc</p>');
      expect(content).toContain('body{}');
      expect(mime).toBe('text/html;charset=utf-8');
      expect(onStatus).toHaveBeenCalledWith(fileName);
    });
  });
});
