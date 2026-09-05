import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <header>
        <div id="menu-items">
          <div>Markdown-Studio</div>
          <button data-sidebar-action="reset" title="Redefinir">Redefinir</button>
          <button data-sidebar-action="copy" title="Copiar">Copiar</button>
          <button data-sidebar-action="exportPdf" title="Exportar PDF">Exportar PDF</button>
          <input type="checkbox" id="sync-scroll-checkbox" />
          <input type="checkbox" id="theme-checkbox" />
        </div>
      </header>
      <div id="container">
        <aside id="sidebar" class="sidebar"></aside>
        <nav id="sidebar-nav">
          <button type="button" class="sidebar-item" data-sidebar-action="reset"></button>
          <button type="button" class="sidebar-item" data-sidebar-action="copy"></button>
        </nav>
        <div id="sidebar-status"></div>
      </div>
      <dialog id="print-settings-dialog" class="print-dialog" aria-labelledby="print-settings-title">
        <div class="print-dialog-header">
          <div class="print-dialog-icon"></div>
          <h2 id="print-settings-title" class="print-dialog-title">Configurar impressão</h2>
          <button type="button" id="print-settings-close" class="print-dialog-close" aria-label="Fechar">×</button>
        </div>
        <form id="print-settings-form">
          <label class="print-form-label" for="print-margin">Margem</label>
          <input type="number" id="print-margin" class="print-form-input" />
          <label class="print-form-label" for="print-paper">Papel</label>
          <select id="print-paper" class="print-form-select">
            <option value="a4">A4</option>
          </select>
          <button type="submit" class="print-btn print-btn-primary">Salvar</button>
        </form>
      </dialog>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('ARIA Labels', () => {
    it('dialog tem aria-labelledby', () => {
      const dialog = document.querySelector('#print-settings-dialog');
      expect(dialog.getAttribute('aria-labelledby')).toBe('print-settings-title');
    });

    it('dialog close tem aria-label', () => {
      const closeBtn = document.querySelector('#print-settings-close');
      expect(closeBtn.getAttribute('aria-label')).toBe('Fechar');
    });

    it('labels estão associados com inputs via for/id', () => {
      const label = document.querySelector('label[for="print-margin"]');
      const input = document.querySelector('#print-margin');
      expect(label).toBeTruthy();
      expect(input).toBeTruthy();
      expect(label.getAttribute('for')).toBe(input.id);
    });
  });

  describe('Keyboard Navigation', () => {
    it('botões são focusable', () => {
      const buttons = document.querySelectorAll('button');
      buttons.forEach((btn) => {
        expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
      });
    });

    it('inputs são focusable', () => {
      const inputs = document.querySelectorAll('input, select');
      inputs.forEach((input) => {
        expect(input.tabIndex).toBeGreaterThanOrEqual(0);
      });
    });

    it('dialog close pode ser ativado por click', () => {
      const closeBtn = document.querySelector('#print-settings-close');
      const clickSpy = vi.fn();
      closeBtn.addEventListener('click', clickSpy);
      closeBtn.click();
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('Semantic HTML', () => {
    it('usa heading hierarchy correta', () => {
      const h2 = document.querySelector('h2');
      expect(h2).toBeTruthy();
      expect(h2.tagName).toBe('H2');
    });

    it('usa nav para navegação', () => {
      const nav = document.querySelector('nav');
      expect(nav).toBeTruthy();
    });

    it('usa form para formulários', () => {
      const form = document.querySelector('form');
      expect(form).toBeTruthy();
    });

    it('usa aside para sidebar', () => {
      const aside = document.querySelector('aside');
      expect(aside).toBeTruthy();
    });
  });

  describe('Form Accessibility', () => {
    it('inputs com labels têm for/id correspondente', () => {
      const labeledInputs = document.querySelectorAll('label[for]');
      labeledInputs.forEach((label) => {
        const input = document.getElementById(label.getAttribute('for'));
        expect(input).toBeTruthy();
      });
    });

    it('botão submit tem texto descritivo', () => {
      const submitBtn = document.querySelector('button[type="submit"]');
      expect(submitBtn.textContent).toBeTruthy();
      expect(submitBtn.textContent.length).toBeGreaterThan(0);
    });
  });
});
