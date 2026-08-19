import { NAMESPACE, KEYS } from './i18n/index.js';
import { t, getDefaultTemplate, DEFAULT_TEMPLATE_PT, DEFAULT_TEMPLATE_EN } from './i18n/index.js';
import { getItem, setItem } from './storage.js';
import { convert } from './render/convert.js';
import { scheduleMermaidRender, renderMermaidDiagrams } from './render/mermaid.js';
import { setupDivider } from './ui/divider.js';
import { setupSidebar } from './ui/sidebar.js';
import { applyStoredLocale, setupLanguageSelector } from './ui/language.js';
import { applyI18n } from './ui/i18nElements.js';
import { scrollPreviewTo } from './ui/scrollSync.js';
import { exportPreviewToPdf } from './ui/exportPdf.js';
import { resetMarkdownEditor, newMarkdownEditor, resolveBootInput } from './ui/editorActions.js';

applyStoredLocale();

const init = () => {
  let hasEdited = false;
  let scrollBarSync = false;

  const defaultInput = getDefaultTemplate();

  // M4: leitura tipada na fronteira do storage — fragmento corrompido não
  // restaura em silêncio; o boot cai no padrão via fallback null.
  function safeGet(namespace, key, type) {
    try {
      return getItem(namespace, key, { type });
    } catch {
      return null;
    }
  }

  applyI18n();

  async function setupEditor() {
    const { monaco } = await import('./ui/workers/monacoSetup.js');
    const editor = monaco.editor.create(document.querySelector('#editor'), {
      fontSize: 14,
      language: 'markdown',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      scrollbar: { vertical: 'visible', horizontal: 'visible' },
      wordWrap: 'on',
      hover: { enabled: false },
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      folding: false,
    });

    editor.onDidChangeModelContent(() => {
      if (editor.getValue() !== defaultInput) {
        hasEdited = true;
      }
      const value = editor.getValue();
      scheduleConvertAndRender(value);
      scheduleSave(value);
    });

    editor.onDidScrollChange((e) => {
      if (!scrollBarSync) {
        return;
      }
      const previewElement = document.querySelector('#preview');
      scrollPreviewTo(e, editor, previewElement);
    });

    return editor;
  }

  function convertAndRender(value) {
    const output = document.querySelector('#output');
    const sanitized = convert(value);
    output.innerHTML = sanitized;
    scheduleMermaidRender();
  }

  // M2: converte com debounce por tecla para evitar jank em documentos longos.
  let convertTimer = null;
  function scheduleConvertAndRender(value, delay = 80) {
    if (convertTimer) {
      clearTimeout(convertTimer);
    }
    convertTimer = setTimeout(() => {
      convertTimer = null;
      convertAndRender(value);
    }, delay);
  }

  let saveTimer = null;
  const isUntouchedTemplate = (value) =>
    value === DEFAULT_TEMPLATE_PT || value === DEFAULT_TEMPLATE_EN;

  function scheduleSave(value) {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      // Não persiste templates não editados: assim, ao trocar o idioma, o
      // editor volta ao template do idioma corrente em vez do outro.
      if (!isUntouchedTemplate(value)) {
        setItem(NAMESPACE, KEYS.lastState, value);
      }
    }, 300);
  }

  const scrollTop = () => {
    document.querySelectorAll('.column').forEach((el) => el.scrollTo({ top: 0 }));
  };

  function reset() {
    const ok = resetMarkdownEditor({
      editor,
      defaultInput,
      hasEdited,
      confirm: () => window.confirm(t('resetConfirm')),
      scrollTop,
    });
    if (ok) {
      hasEdited = false;
    }
  }

  function newFile() {
    const ok = newMarkdownEditor({
      editor,
      hasEdited,
      confirm: () => window.confirm(t('newFileConfirm')),
      scrollTop,
    });
    if (ok) {
      hasEdited = false;
    }
  }

  function initScrollBarSync(settings) {
    const checkbox = document.querySelector('#sync-scroll-checkbox');
    if (!checkbox) {
      return;
    }
    checkbox.checked = settings;
    scrollBarSync = settings;
    checkbox.addEventListener('change', (event) => {
      const checked = event.currentTarget.checked;
      scrollBarSync = checked;
      setItem(NAMESPACE, KEYS.scrollBar, checked);
    });
  }

  const PREVIEW_CSS_BASE = 'css/github-markdown-';

  function setPreviewCss(useDark) {
    const link = document.getElementById('gh-markdown-link');
    const variant = useDark ? 'dark_dimmed' : 'light';
    const desired = `${PREVIEW_CSS_BASE}${variant}.css?v=1.0.0`;
    if (link && link.getAttribute('href') !== desired) {
      link.setAttribute('href', desired);
    }
  }

  function setTheme(enabled) {
    document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
  }

  function initThemeToggle(settings) {
    const checkbox = document.querySelector('#theme-checkbox');
    if (!checkbox) {
      return;
    }
    checkbox.checked = settings;
    setTheme(settings);
    setPreviewCss(settings);

    // M3: re-sincroniza a chave lida pelo anti-FOUC no boot a partir da
    // fonte de verdade (theme_settings) — storage legado com boot key
    // ausente/divergente deixava de causar double-flip de tema no next load.
    try {
      localStorage.setItem(KEYS.themeBoot, settings ? 'dark' : 'light');
    } catch {
      // storage indisponível — anti-FOUC assume o padrão na próxima carga
    }

    import('./ui/workers/monacoSetup.js').then(({ monaco }) => {
      monaco.editor.setTheme(settings ? 'vs-dark' : 'vs');
    });

    checkbox.addEventListener('change', (event) => {
      const checked = event.currentTarget.checked;
      setTheme(checked);
      setItem(NAMESPACE, KEYS.theme, checked);
      if (checked) {
        localStorage.setItem(KEYS.themeBoot, 'dark');
      } else {
        localStorage.setItem(KEYS.themeBoot, 'light');
      }
      setPreviewCss(checked);
      import('./ui/workers/monacoSetup.js').then(({ monaco }) => {
        monaco.editor.setTheme(checked ? 'vs-dark' : 'vs');
      });
      renderMermaidDiagrams();
    });
  }

  function setupSidebarActions() {
    const status = document.querySelector('#sidebar-status');
    const report = (message) => {
      if (status) {
        status.textContent = message;
      }
    };

    const handlers = {
      reset: () => reset(),
      new: () => newFile(),
      copy: async () => {
        const value = editor.getValue();
        try {
          await navigator.clipboard.writeText(value);
          report(t('copied'));
        } catch {
          // nada a fazer — clipboard negado
        }
      },
      exportPdf: ({ report }) => exportPreviewToPdf({ onStatus: report }),
    };

    setupSidebar({
      container: document,
      editor,
      getContent: () => editor.getValue(),
      onStatus: (message) => {
        if (status) {
          status.textContent = message;
        }
      },
      handlers,
    });

    return report;
  }

  let editor;
  setupEditor().then((ed) => {
    editor = ed;

    const lastContent = safeGet(NAMESPACE, KEYS.lastState, 'string');
    // Se o conteúdo salvo é um template não editado (de qualquer idioma),
    // usa-se o template do idioma corrente no boot.
    const bootInput = resolveBootInput({ lastContent, defaultInput, isUntouchedTemplate });
    editor.setValue(bootInput);
    editor.revealPosition({ lineNumber: 1, column: 1 });

    const scrollSettings = safeGet(NAMESPACE, KEYS.scrollBar, 'boolean') === true;
    initScrollBarSync(scrollSettings);

    const dark = safeGet(NAMESPACE, KEYS.theme, 'boolean') === true;
    initThemeToggle(dark);

    setupDivider();

    setupSidebarActions();

    setupLanguageSelector();
  });
};

window.addEventListener('load', () => {
  init();
});
