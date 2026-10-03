import { NAMESPACE, KEYS } from './i18n/index.js';
import { t, getDefaultTemplate, DEFAULT_TEMPLATE_PT, DEFAULT_TEMPLATE_EN } from './i18n/index.js';
import { setItem, safeGet } from './storage.js';
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
import { guardStorage as guardStorageCall } from './ui/storageFeedback.js';
import { getLocaleCode } from './i18n/index.js';
import {
  getActiveDocument,
  safeGetIndexDetailed,
  createDocument,
  getContentDetailed,
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
    target = null,
  } = event;
  if (!ctrlKey && !metaKey) {
    return null;
  }
  if (altKey || shiftKey || repeat) {
    return null;
  }
  // C1: campos de formulário (diálogos, contenteditable) têm comportamento
  // nativo para Ctrl+B/E etc. — não sequestrar a digitação. O editor Monaco
  // (textarea escondida dentro de `.monaco-editor`) continua de fora da guarda:
  // salvar/exportar DE enquanto se escreve é o caso de uso principal.
  if (target && typeof target.closest === 'function') {
    const inField = target.closest('input, textarea, select, [contenteditable="true"]');
    if (inField && !target.closest('.monaco-editor')) {
      return null;
    }
  }
  if (typeof key !== 'string' || key.length !== 1) {
    return null;
  }
  return SHORTCUT_ACTIONS[key.toLowerCase()] ?? null;
}

// Limpeza da registration ativa. Guardada aqui — e não só devolvida — porque o
// caller pode descartar o retorno: `init()` chamava `setupKeyboardShortcuts()`
// sem guardar nada. Sem este guarda, um segundo `init()` ou um teste que
// esqueça o `dispose` acumulava o listener e a mesma tecla disparava a ação N
// vezes.
let disposeActiveShortcuts = null;

export function setupKeyboardShortcuts() {
  // Uma registration por vez: quem chamar de novo desfaz a anterior.
  disposeActiveShortcuts?.();
  const onKeyDown = (e) => {
    const action = resolveShortcutAction(e);
    if (!action) {
      return;
    }
    e.preventDefault();
    document.querySelector(`[data-sidebar-action="${action}"]`)?.click();
  };
  document.addEventListener('keydown', onKeyDown);
  const dispose = () => {
    document.removeEventListener('keydown', onKeyDown);
    if (disposeActiveShortcuts === dispose) {
      disposeActiveShortcuts = null;
    }
  };
  disposeActiveShortcuts = dispose;
  return dispose;
}

const init = () => {
  let hasEdited = false;
  let scrollBarSync = false;
  let statusBar = null;
  let documentManager = null;

  const defaultInput = getDefaultTemplate();

  // F2: todo ponto de gravação passa por aqui. O autosave roda dentro de um
  // `setTimeout` e as ações da UI correm em handlers de evento — sem isto, uma
  // StorageError (quota cheia) não tem dono e vira erro silencioso no console:
  // o usuário só descobre que perdeu as edições no próximo reload.
  const guardStorage = (fn) =>
    guardStorageCall(fn, {
      onFail: (message) => {
        const status = document.querySelector('#sidebar-status');
        if (status) {
          status.textContent = message;
        }
      },
    });

  // M4: leitura tipada na fronteira do storage — fragmento corrompido não
  // restaura em silêncio; o boot cai no padrão via fallback null. E3: é o
  // `safeGet` do `storage.js` (havia um segundo local com contrato divergente).

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
      // D12: a contagem (palavras/chars/linhas) não precisa recalcular em toda
      // tecla — debounce próprio, sem atrasar o autosave.
      scheduleStatusUpdate();
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

  // M3: roda dentro de um `setTimeout`, então uma exceção aqui subia como
  // uncaught, o preview congelava na última versão boa e o usuário não tinha
  // sinal nenhum de que o documento tinha deixado de renderizar. A falha agora
  // fica visível no status e o HTML válido anterior permanece em pé.
  function convertAndRender(value) {
    const output = document.querySelector('#output');
    if (!output) {
      return;
    }
    try {
      output.innerHTML = convert(value);
    } catch (error) {
      console.error('[render]', error);
      const status = document.querySelector('#sidebar-status');
      if (status) {
        status.textContent = t('renderFailed');
      }
      return;
    }
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

  // D12: contagem de estatísticas com debounce — a contagem completa em toda
  // tecla era trabalho desperdiçado (o resultado só é visível um instante depois).
  let statusTimer = null;
  function scheduleStatusUpdate(delay = 300) {
    if (statusTimer) {
      clearTimeout(statusTimer);
    }
    statusTimer = setTimeout(() => {
      statusTimer = null;
      statusBar?.update();
    }, delay);
  }

  let saveTimer = null;
  const isUntouchedTemplate = (value) =>
    value === DEFAULT_TEMPLATE_PT || value === DEFAULT_TEMPLATE_EN;

  let lastAutoSnapshotTs = 0;
  let snapshotQuotaNotified = false;

  // Última edição ainda não persistida. Vive aqui porque o `pagehide` precisa
  // alcançar o que o debounce de 300ms ainda não conseguiu gravar.
  let pendingSave = null;

  function persistNow(value, docId) {
    // O callback de um setTimeout não tem dono: uma StorageError daqui subia
    // como uncaught e o usuário nunca via que a edição não foi gravada.
    guardStorage(() => {
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
        // D4: recusa por quota é anunciada uma única vez por sessão — o loop
        // automático repetiria a mensagem a cada minuto de edição.
        if (result.reason === 'quota' && !snapshotQuotaNotified) {
          snapshotQuotaNotified = true;
          const status = document.querySelector('#sidebar-status');
          if (status) {
            status.textContent = t('snapshotQuota');
          }
        }
      }
    });
  }

  // Grava de imediato o que estiver pendente e desarma o timer, para o mesmo
  // valor não ser gravado duas vezes.
  function flushSave() {
    if (!pendingSave) {
      return;
    }
    const { value, docId } = pendingSave;
    pendingSave = null;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    persistNow(value, docId);
  }

  function scheduleSave(value, docId = null) {
    pendingSave = { value, docId };
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flushSave();
    }, 300);
  }

  // A4: fechar a aba ou recarregar antes do debounce disparar perdia a última
  // edição — não havia nenhum `pagehide`/`beforeunload` no projeto. O handler
  // roda de forma síncrona, enquanto o storage ainda é gravável.
  window.addEventListener('pagehide', flushSave);

  const scrollTop = () => {
    document.querySelectorAll('.column').forEach((el) => el.scrollTo({ top: 0 }));
  };

  function reset() {
    let ok = false;
    // `resetMarkdownEditor` já limpou o editor antes de remover o `last_state`:
    // se esse removeItem lançar, o utilizador viu a tela limpar mas o reload
    // traria o conteúdo antigo de volta — precisa ouvir sobre a falha.
    const ran = guardStorage(() => {
      ok = resetMarkdownEditor({
        editor,
        defaultInput,
        hasEdited,
        confirm: () => window.confirm(t('resetConfirm')),
        scrollTop,
      });
    });
    if (!ran) {
      return;
    }
    if (ok) {
      hasEdited = false;
      // O documento ativo precisa acompanhar o reset: como o boot lê o
      // documento, sem isto o reload ressuscitava o conteúdo descartado.
      const active = getActiveDocument();
      if (active) {
        guardStorage(() => setContent(active.id, defaultInput));
      }
    }
  }

  // D3: "Novo arquivo" segue o modelo multi-documento — cria uma nova entrada
  // isolada (mesmo fluxo de `#doc-new-btn`) em vez de limpar o documento ativo,
  // que o autosave persistia como conteúdo vazio no mesmo título/índice.
  // Não há confirmação: a criação não descarta nada (o conteúdo atual é salvo
  // pelo `saveCurrentContent` do gerenciador antes de trocar).
  function newFile() {
    documentManager?.create();
    hasEdited = false;
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
      // Todo ponto de gravação passa pelo guard (F2). Sem ele uma quota
      // estourada aqui virava exceção solta dentro do handler, com o checkbox
      // já virado e a preferência perdida no próximo reload, sem nenhum aviso.
      guardStorage(() => setItem(NAMESPACE, KEYS.scrollBar, checked));
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

    import('./ui/workers/monacoSetup.js')
      .then(({ monaco }) => {
        monaco.editor.setTheme(settings ? 'vs-dark' : 'vs');
      })
      // D3: chunk do Monaco indisponível não pode virar unhandled rejection.
      .catch(() => {});

    checkbox.addEventListener('change', (event) => {
      const checked = event.currentTarget.checked;
      setTheme(checked);
      guardStorage(() => setItem(NAMESPACE, KEYS.theme, checked));
      // A chave do anti-FOUC é crua (não passa por `storage.js`). No boot ela
      // já ia em try/catch; aqui não ia, e uma exceção abortava o resto do
      // handler — CSS, Monaco e mermaid ficavam com o tema velho.
      try {
        localStorage.setItem(KEYS.themeBoot, checked ? 'dark' : 'light');
      } catch {
        // storage indisponível — anti-FOUC assume o padrão na próxima carga
      }
      setPreviewCss(checked);
      import('./ui/workers/monacoSetup.js')
        .then(({ monaco }) => {
          monaco.editor.setTheme(checked ? 'vs-dark' : 'vs');
        })
        .catch(() => {});
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
    documentManager = setupDocumentManager({
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
          // D11: a mesma falha de clipboard que `copyHtml` reporta — em
          // silêncio o clique "parecia não ter feito nada".
          report(t('copyError'));
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
            filename: active?.title || getCurrentFileName() || 'document',
            title: active?.title || getCurrentFileName() || t('appTitle'),
            lang: getLocaleCode(),
            // D7: o export acompanha o tema ativo (o CSS é empacotado no build).
            theme:
              document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
          });
          statusReport(t('htmlExported').replace('{name}', name));
        } catch {
          statusReport(t('exportHtmlError'));
        }
      },
      exportPdf: ({ report }) =>
        exportPreviewToPdf(
          {
            onStatus: report,
            getMarkdown: () => editor.getValue(),
            getDocName: () => getActiveDocument()?.title || getCurrentFileName() || '',
          },
          loadPrintSettings(),
        ),
      // D8: diálogos podem não montar (elemento ausente) — sem `?.` o clique
      // virava TypeError e o botão parecia morto.
      printSettings: () => printDialog?.open(),
      toc: () => tocDialog?.open(),
      snapshots: () => snapshotsDialog?.open(),
    };

    sidebarApi = setupSidebar({
      container: document,
      editor,
      getContent: () => editor.getValue(),
      // C2: abrir arquivo com edição não salva pede confirmação (como Reset).
      confirm: (message) => window.confirm(message),
      isDirty: () => hasEdited,
      // M9: o handle de arquivo aberto precisa ser associado a um documento —
      // sem isto o Ctrl+S gravava o documento ativo por cima de outro arquivo.
      getActiveDoc: () => {
        const doc = getActiveDocument();
        return doc ? { id: doc.id, title: doc.title } : null;
      },
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

  setupEditor()
    .then((ed) => {
      editor = ed;

      const lastContent = safeGet(NAMESPACE, KEYS.lastState, { type: 'string' });
      // B5 (AC-P2-10-4): o boot recolhe avisos de restauração — id ativo órfão,
      // índice limpo (dedup) e conteúdo corrompido — e os anuncia uma vez.
      const { index, warnings: indexWarnings } = safeGetIndexDetailed();
      const bootWarnings = [...indexWarnings];

      let bootInput;
      if (index.documents.length > 0) {
        const active = getActiveDocument();
        const { value: activeContent, corrupt } = active
          ? getContentDetailed(active.id)
          : { value: null, corrupt: false };
        if (corrupt) {
          bootWarnings.push('corruptContent');
        }
        bootInput = resolveDocumentBootInput({
          lastContent,
          docContent: activeContent,
          documentCount: index.documents.length,
          defaultInput,
          isUntouchedTemplate,
        });
      } else if (lastContent && !isUntouchedTemplate(lastContent)) {
        // A2: `createDocument` roda `atomicWrite` e lança StorageError com a
        // quota cheia. Sem o guard essa exceção abortava o `.then` inteiro —
        // setValue, tema, status bar e sidebar nunca montavam. O conteúdo segue
        // no `last_state`, então o próximo boot tenta criar o documento de novo.
        guardStorage(() =>
          createDocument({
            title: t('docRestored'),
            initialContent: lastContent,
          }),
        );
        bootInput = lastContent;
      } else {
        bootInput = resolveBootInput({ lastContent, defaultInput, isUntouchedTemplate });
      }

      editor.setValue(bootInput);
      editor.revealPosition({ lineNumber: 1, column: 1 });

      // B5: uma única mensagem com os avisos de restauração do boot.
      if (bootWarnings.length > 0) {
        const messages = {
          activeIdFallback: t('bootWarnActiveId'),
          indexCleaned: t('bootWarnIndexCleaned'),
          indexVersion: t('bootWarnIndexVersion'),
          corruptContent: t('bootWarnCorruptContent'),
        };
        const statusEl = document.querySelector('#sidebar-status');
        if (statusEl) {
          statusEl.textContent = bootWarnings
            .map((w) => messages[w])
            .filter(Boolean)
            .join(' ');
        }
      }

      const scrollSettings = safeGet(NAMESPACE, KEYS.scrollBar, { type: 'boolean' }) === true;
      initScrollBarSync(scrollSettings);

      const dark = safeGet(NAMESPACE, KEYS.theme, { type: 'boolean' }) === true;
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

      // O retorno é a limpeza do listener. `setupKeyboardShortcuts` já desfaz a
      // registration anterior sozinho, então aqui basta chamar — mas se um
      // `init()` rodasse duas vezes, não haveria listener duplicado.
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
    })
    .catch((error) => {
      // A1: `setupEditor` dynamic-importa o Monaco. Se esse chunk falhar (404
      // pós-deploy, cache stale), a cadeia morria em `unhandledrejection` com a
      // tela vazia e nenhum sinal para o usuário.
      console.error('[boot] falha ao iniciar o editor', error);
      const status = document.querySelector('#sidebar-status');
      if (status) {
        status.textContent = t('bootFailed');
      }
    });
};

window.addEventListener('load', () => {
  init();
});
