import { describe, it, expect } from 'vitest';
import {
  ALLOWED_URI_REGEXP,
  ALLOWED_IMAGE_URI_REGEXP,
  isSafeLinkHref,
  isSafeImageSrc,
} from '../../src/render/urlPolicy.js';

describe('urlPolicy', () => {
  describe('links', () => {
    it.each([
      'https://example.com/',
      'http://example.com/a?b=c',
      'mailto:contato@example.com',
      '/image/Markdown-mark.svg',
      './relativo.md',
      '../acima.md',
      '#ancora',
      '//cdn.example.com/x.js',
      'docs/x.md',
    ])('permite %s', (href) => {
      expect(isSafeLinkHref(href)).toBe(true);
    });

    it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'tel:5511999', 'data:text/html,x'])(
      'bloqueia %s',
      (href) => {
        expect(isSafeLinkHref(href)).toBe(false);
      },
    );

    it('ignora espaços ao redor', () => {
      expect(isSafeLinkHref('  https://example.com  ')).toBe(true);
      expect(isSafeLinkHref('  javascript:alert(1)  ')).toBe(false);
    });

    it('rejeita valores não-string e vazios', () => {
      expect(isSafeLinkHref(undefined)).toBe(false);
      expect(isSafeLinkHref(null)).toBe(false);
      expect(isSafeLinkHref('')).toBe(false);
      expect(isSafeLinkHref('   ')).toBe(false);
    });
  });

  describe('imagens', () => {
    it.each([
      'data:image/png;base64,iVBORw0KGgo=',
      'data:image/jpeg;base64,/9j/4A==',
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      'https://example.com/x.png',
      '/image/Markdown-mark.svg',
      './foto.webp',
    ])('permite %s', (src) => {
      expect(isSafeImageSrc(src)).toBe(true);
    });

    it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'tel:5511999', 'mailto:a@b.c'])(
      'bloqueia %s',
      (src) => {
        expect(isSafeImageSrc(src)).toBe(false);
      },
    );

    it('rejeita valores não-string e vazios', () => {
      expect(isSafeImageSrc(undefined)).toBe(false);
      expect(isSafeImageSrc('')).toBe(false);
    });
  });

  it('as regex exportadas são as mesmas usadas pelo DOMPurify', () => {
    expect(ALLOWED_URI_REGEXP.test('https://example.com')).toBe(true);
    expect(ALLOWED_IMAGE_URI_REGEXP.test('data:image/png;base64,AA==')).toBe(true);
  });
});
