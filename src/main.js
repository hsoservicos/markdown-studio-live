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
import {
  resetMarkdownEditor,
  newMarkdownEditor,
  resolveBootInput,
  resolveDocumentBootInput,
  persistDraft,
} from './ui/editorActions.js';
import { loadPrintSettings, applyPrintSettingsCss } from './ui/printSettings.js';
import { setupPrintSettingsDialog } from './ui/printSettingsDialog.js';
import { setupStatusBar } from './ui/statusBar.js';
import { setupTocDialog } from './ui/tocDialog.js';
import { copyRichHtml } from './ui/copyRich.js';
import { exportStandaloneHtml } from './ui/exportHtml.js';
import { maybeAutoSnapshot } from './ui/snapshots.js';
import { setupSnapshotsDialog } from './ui/snapshotsDialog.js';
import { setupDocumentManager } from './ui/documents-ui.js';
import { getLocaleCode } from './i18n/index.js';
import {
  getActiveDocument,
  safeGetIndex,
  createDocument,
  getContent,
  setContent,
} from './documents.js';
// P0-5: estilos do KaTeX (bundled via npm, sem CDN).
import 'katex/dist/katex.min.css';

applyStoredLocale();

// Atalhos da aplicação: letra do atalho → atributo `[data-sidebar-action]`.
const SHORTCUT_ACTIONS = {
  s: 'save',
  p: 'exportPdf',
  b: 'copyHtml',
  e: 'exportHtml',
};

/**
 * Decide se um `keydown` corresponde a um atalho nosso (puro, testável).
 *
 * Só a combinação exata, com as demais modificações recusadas:
 *
 * - `altKey` é bloqueado porque no Windows o AltGr reporta `ctrlKey + altKey`
 *   ao mesmo tempo — sem a guarda, digitar AltGr+E (€) dispararia a exportação
 *   de HTML.
 * - `shiftKey` é bloqueado porque Ctrl+Shift+S/P/E são atalhos de outra ordem
 *   ("save as", paleta de comandos), não os nossos.
 * - `repeat` é bloqueado para não reabrir a ação ao segurar a tecla.
 *
 * @param {KeyboardEvent | null} event
 * @returns {string|null} valor do `[data-sidebar-action]` alvo, ou `null`
 */
export function resolveShortcutAction(event) {
  if (!event) {
    return null;
  }
  const {
    key,
    ctrlKey = false,
    metaKey = false,
    altKey = false,
    shiftKey = false,
    repeat = false,
  } = event;
  if (!ctrlKey && !metaKey) {
    return null;
  }
  if (altKey || shiftKey || repeat) {
    return null;
  }
  if (typeof key !== 'string' || key.length !== 1) {
    return null;
  }
  return SHORTCUT_ACTIONS[key.toLowerCase()] ?? null;
}

export function setupKeyboardShortcuts() {
  const onKeyDown = (e) => {
    const action = resolveShortcutAction(e);
    if (!action) {
      return;
    }
    e.preventDefault();
    document.querySelector(`[data-sidebar-action="${action}"]`)?.click();
  };
  document.addEventListener('keydown', onKeyDown);
  // Devolve a limpeza: sem ela, re-registrar em testes acumula listeners e
  // uma mesma tecla dispara a ação N vezes.
  return () => document.removeEventListener('keydown', onKeyDown);
}

const init = () => {
  let hasEdited = false;
  let scrollBarSync = false;
  let statusBar = null;

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
      // O documento é capturado no momento da edição: o timer do debounce pode
      // disparar depois de uma troca de documento e não deve gravar no doc novo.
      scheduleSave(value, getActiveDocument()?.id ?? null);
      statusBar?.update();
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

  let lastAutoSnapshotTs = 0;

  function scheduleSave(value, docId = null) {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      // Persiste no `last_state` (contrato legado) E no conteúdo do documento
      // ativo — é o documento que o boot lê, então sem o segundo as edições
      // eram perdidas no reload (e o `last_state` acabava sobrescrito com o
      // conteúdo congelado do documento).
      const persisted = persistDraft(value, {
        isUntouchedTemplate,
        setDraft: (draft) => setItem(NAMESPACE, KEYS.lastState, draft),
        getActiveDocId: () => docId,
        saveDocContent: (id, draft) => setContent(id, draft),
      });
      if (persisted) {
        // P1-8: anel de backup com throttle — protege se last_state corromper.
        const result = maybeAutoSnapshot(value, {
          lastAutoTs: lastAutoSnapshotTs,
          docId,
        });
        lastAutoSnapshotTs = result.lastAutoTs;
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
      // O documento ativo precisa acompanhar o reset: como o boot lê o
      // documento, sem isto o reload ressuscitava o conteúdo descartado.
      const active = getActiveDocument();
      if (active) {
        setContent(active.id, defaultInput);
      }
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

    const printDialog = setupPrintSettingsDialog({
      onSaved: () => {
        report(t('printSettingsSaved'));
      },
    });
    const tocDialog = setupTocDialog({
      container: document,
      editor,
      getContent: () => editor.getValue(),
      onEmpty: () => report(t('tocEmpty')),
    });
    const snapshotsDialog = setupSnapshotsDialog({
      container: document,
      getLocale: () => getLocaleCode(),
      onStatus: report,
      onRestore: (content) => {
        editor.setValue(content);
        editor.revealPosition({ lineNumber: 1, column: 1 });
        hasEdited = true;
      },
    });
    setupDocumentManager({
      container: document,
      editor,
      getEditorContent: () => editor.getValue(),
      onStatus: report,
      confirm: (message) => window.confirm(message),
    });

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
      copyHtml: async ({ report: statusReport }) => {
        try {
          await copyRichHtml({
            getHtml: () => document.querySelector('#output')?.innerHTML ?? '',
            getPlain: () => editor.getValue(),
          });
          statusReport(t('copiedHtml'));
        } catch {
          statusReport(t('copyError'));
        }
      },
      exportHtml: async ({ report: statusReport }) => {
        try {
          const active = getActiveDocument();
          const name = await exportStandaloneHtml({
            getHtml: () => document.querySelector('#output')?.innerHTML ?? '',
            filename: (active?.title || getCurrentFileName() || 'document') + '.html',
            title: active?.title || getCurrentFileName() || t('appTitle'),
            lang: getLocaleCode(),
          });
          statusReport(t('htmlExported').replace('{name}', name));
        } catch {
          statusReport(t('exportHtmlError'));
        }
      },
      exportPdf: ({ report }) =>
        exportPreviewToPdf(
          { onStatus: report, getMarkdown: () => editor.getValue() },
          loadPrintSettings(),
        ),
      printSettings: () => printDialog.open(),
      toc: () => tocDialog.open(),
      snapshots: () => snapshotsDialog?.open(),
    };

    sidebarApi = setupSidebar({
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
  let sidebarApi = null;
  const getCurrentFileName = () => sidebarApi?.getCurrentName?.() ?? null;

  setupEditor().then((ed) => {
    editor = ed;

    const lastContent = safeGet(NAMESPACE, KEYS.lastState, 'string');
    const index = safeGetIndex();

    let bootInput;
    if (index.documents.length > 0) {
      const active = getActiveDocument();
      bootInput = resolveDocumentBootInput({
        lastContent,
        docContent: active ? getContent(active.id) : null,
        documentCount: index.documents.length,
        defaultInput,
        isUntouchedTemplate,
      });
    } else if (lastContent && !isUntouchedTemplate(lastContent)) {
      createDocument({
        title: t('docRestored'),
        initialContent: lastContent,
      });
      bootInput = lastContent;
    } else {
      bootInput = resolveBootInput({ lastContent, defaultInput, isUntouchedTemplate });
    }

    editor.setValue(bootInput);
    editor.revealPosition({ lineNumber: 1, column: 1 });

    const scrollSettings = safeGet(NAMESPACE, KEYS.scrollBar, 'boolean') === true;
    initScrollBarSync(scrollSettings);

    const dark = safeGet(NAMESPACE, KEYS.theme, 'boolean') === true;
    initThemeToggle(dark);

    applyPrintSettingsCss(loadPrintSettings());

    statusBar = setupStatusBar({
      container: document,
      getContent: () => editor.getValue(),
      tFn: t,
      getFileName: () => getCurrentFileName(),
    });
    statusBar?.update();

    setupDivider();

    setupSidebarActions();

    setupLanguageSelector();

    setupKeyboardShortcuts();

    if (statusBar) {
      const quota = statusBar.checkQuota();
      if (!quota.ok) {
        const msg = t('storageQuotaWarning').replace('{percent}', String(quota.percentUsed));
        console.warn(msg);
        const statusEl = document.querySelector('#sidebar-status');
        if (statusEl) {
          statusEl.textContent = msg;
        }
      }
    }
  });
};

window.addEventListener('load', () => {
  init();
});
