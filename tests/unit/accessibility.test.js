import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { applyI18n } from '../../src/ui/i18nElements.js';
import { setLocale, t } from '../../src/i18n/index.js';

/**
 * Valida o `index.html` REAL (não um fixture paralelo). O documento é lido do
 * disco e injetado no head/body do jsdom, de modo que qualquer elemento/atributo
 * novo quebra o teste se não respeitar os contratos de acessibilidade e i18n.
 *
 * Antes esta suíte montava um fixture próprio e passava a validar um documento
 * que não era o entregue ao usuário — o `data-i18n-close` inerte e os botões de
 * fechar sem tradução escapavam justamente por isso.
 */
const INDEX_HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

// Atributos i18n entendidos por `src/ui/i18nElements.js`.
const SUPPORTED_I18N_ATTRS = [
  'data-i18n',
  'data-i18n-aria-label',
  'data-i18n-title',
  'data-i18n-alt',
  'data-i18n-content',
  'data-i18n-placeholder',
];

const CLOSE_BUTTON_IDS = ['manual-close', 'toc-close', 'snapshots-close', 'print-settings-close'];

function loadRealIndexHtml() {
  const parsed = new JSDOM(INDEX_HTML);
  const root = parsed.window.document.documentElement;
  document.documentElement.setAttribute('lang', root.getAttribute('lang') ?? '');
  document.head.innerHTML = parsed.window.document.head.innerHTML;
  document.body.innerHTML = parsed.window.document.body.innerHTML;
}

beforeEach(() => {
  setLocale('pt-BR');
  loadRealIndexHtml();
});

afterEach(() => {
  setLocale('pt-BR');
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('Accessibility — index.html real', () => {
  describe('i18n', () => {
    it('não usa atributos data-i18n desconhecidos (ex.: data-i18n-close inerte)', () => {
      const used = new Set();
      document.querySelectorAll('*').forEach((el) => {
        el.getAttributeNames().forEach((name) => {
          if (name.startsWith('data-i18n')) {
            used.add(name);
          }
        });
      });
      expect([...used].filter((name) => !SUPPORTED_I18N_ATTRS.includes(name))).toEqual([]);
    });

    it.each(['pt-BR', 'en'])('todas as chaves de tradução existem em %s', (locale) => {
      setLocale(locale);
      const missing = [];
      document
        .querySelectorAll(SUPPORTED_I18N_ATTRS.map((a) => `[${a}]`).join(','))
        .forEach((el) => {
          SUPPORTED_I18N_ATTRS.forEach((attr) => {
            const key = el.getAttribute(attr);
            if (key && t(key) === key) {
              missing.push(
                `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} → ${attr}="${key}"`,
              );
            }
          });
        });
      expect(missing).toEqual([]);
    });

    it('o lang do documento permanece pt-BR (pt-BR first)', () => {
      expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
    });
  });

  describe('botões de fechar diálogo', () => {
    it.each(CLOSE_BUTTON_IDS)('%s tem chave de tradução e aria-label no markup', (id) => {
      const button = document.getElementById(id);
      expect(button, `#${id} ausente`).toBeTruthy();
      expect(button.getAttribute('data-i18n-aria-label')).toBe('closeDialog');
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });

    it('traduzem o aria-label ao trocar de idioma', () => {
      setLocale('en');
      applyI18n({ container: document });
      CLOSE_BUTTON_IDS.forEach((id) => {
        expect(document.getElementById(id).getAttribute('aria-label')).toBe('Close');
      });

      setLocale('pt-BR');
      applyI18n({ container: document });
      CLOSE_BUTTON_IDS.forEach((id) => {
        expect(document.getElementById(id).getAttribute('aria-label')).toBe('Fechar');
      });
    });

    it('o botão de fechar do print-settings é acionável por click', () => {
      const closeBtn = document.getElementById('print-settings-close');
      const clickSpy = vi.fn();
      closeBtn.addEventListener('click', clickSpy);
      closeBtn.click();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('o botão cancelar do print-settings traduz (não vira "Fechar")', () => {
      const cancelBtn = document.getElementById('print-settings-cancel');
      expect(cancelBtn.getAttribute('data-i18n')).toBe('cancel');

      setLocale('pt-BR');
      applyI18n({ container: document });
      expect(cancelBtn.textContent.trim()).toBe('Cancelar');

      setLocale('en');
      applyI18n({ container: document });
      expect(cancelBtn.textContent.trim()).toBe('Cancel');
    });
  });

  describe('ARIA e nomes acessíveis', () => {
    it('todo dialog tem aria-labelledby apontando para um elemento existente', () => {
      const dialogs = [...document.querySelectorAll('dialog')];
      expect(dialogs.length).toBeGreaterThan(0);
      dialogs.forEach((dialog) => {
        const labelId = dialog.getAttribute('aria-labelledby');
        expect(labelId, `dialog#${dialog.id} sem aria-labelledby`).toBeTruthy();
        expect(document.getElementById(labelId), `#${labelId} não existe`).toBeTruthy();
      });
    });

    it('todo botão tem nome acessível (texto, aria-label ou title)', () => {
      document.querySelectorAll('button').forEach((btn) => {
        const name =
          btn.textContent.trim() ||
          btn.getAttribute('aria-label') ||
          btn.getAttribute('title') ||
          '';
        expect(name, `button#${btn.id || '(sem id)'} sem nome acessível`).not.toBe('');
      });
    });

    it('toda imagem tem alt', () => {
      document.querySelectorAll('img').forEach((img) => {
        expect(img.hasAttribute('alt'), `img src=${img.getAttribute('src')} sem alt`).toBe(true);
      });
    });

    it('a lista de documentos expõe role de grupo com rótulo', () => {
      const list = document.getElementById('document-list');
      expect(list).toBeTruthy();
      expect(list.getAttribute('role')).toBe('group');
      expect(list.getAttribute('aria-label')).toBeTruthy();
    });

    it('o divisor de painéis tem semântica de separator', () => {
      const divider = document.getElementById('split-divider');
      expect(divider.getAttribute('role')).toBe('separator');
      expect(divider.getAttribute('aria-orientation')).toBe('vertical');
    });
  });

  describe('navegação por teclado', () => {
    it('todos os botões e controles de formulário são focusable', () => {
      document.querySelectorAll('button, input, select, [tabindex]').forEach((el) => {
        expect(el.tabIndex, `${el.tagName}#${el.id}`).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('formulários', () => {
    it('todo label[for] aponta para um controle existente', () => {
      const labels = [...document.querySelectorAll('label[for]')];
      expect(labels.length).toBeGreaterThan(0);
      labels.forEach((label) => {
        expect(
          document.getElementById(label.getAttribute('for')),
          `label[for=${label.getAttribute('for')}] órfão`,
        ).toBeTruthy();
      });
    });

    it('todo controle de formulário tem rótulo (label[for] ou aria-label)', () => {
      document.querySelectorAll('input, select').forEach((control) => {
        const hasLabel =
          document.querySelector(`label[for="${control.id}"]`) ||
          control.closest('label') ||
          control.getAttribute('aria-label');
        expect(hasLabel, `#${control.id} sem rótulo`).toBeTruthy();
      });
    });
  });

  describe('HTML semântico', () => {
    it('usa header, aside, nav e footer como landmarks', () => {
      expect(document.querySelector('header')).toBeTruthy();
      expect(document.querySelector('aside#sidebar')).toBeTruthy();
      expect(document.querySelector('nav#sidebar-nav')).toBeTruthy();
      expect(document.querySelector('footer')).toBeTruthy();
    });

    it('usa hierarquia de headings começando em h2 nos diálogos', () => {
      const headings = [...document.querySelectorAll('h1, h2')];
      expect(headings.length).toBeGreaterThan(0);
      headings.forEach((heading) => {
        expect(heading.textContent.trim()).not.toBe('');
      });
    });

    it('declara a meta description traduzível', () => {
      const meta = document.querySelector('meta[name="description"]');
      expect(meta).toBeTruthy();
      expect(meta.getAttribute('data-i18n-content')).toBe('metaDescription');
      expect(meta.getAttribute('content')).toBeTruthy();
    });
  });
});
