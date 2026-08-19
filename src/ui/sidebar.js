import { t } from '../i18n/index.js';
import { convert } from '../render/convert.js';
import { renderMermaidDiagramsIn } from '../render/mermaid.js';
import { getLocaleCode } from '../i18n/index.js';
import {
  MARKDOWN_ACCEPT,
  toMarkdownName,
  readFileAsText,
  supportsOpenPicker,
  supportsWriteOn,
} from './files.js';

export const SIDEBAR_STORAGE_KEY = 'com.markdownstudio.sidebar_collapsed';

const MANUAL_PT = 'manual/markdown-manual.md';
const MANUAL_EN = 'manual/markdown-manual-en.md';

export function getManualUrl(code = getLocaleCode()) {
  return code === 'en' ? MANUAL_EN : MANUAL_PT;
}

export function isSidebarCollapsed(storage = globalThis.localStorage) {
  try {
    return storage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed, storage = globalThis.localStorage) {
  try {
    storage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // storage indisponível
  }
}

let manualCache = new Map();

export async function loadManual(mdUrl = getManualUrl()) {
  if (manualCache.has(mdUrl)) {
    return manualCache.get(mdUrl);
  }
  const response = await fetch(mdUrl);
  if (!response.ok) {
    throw new Error(`manual fetch failed: ${response.status}`);
  }
  const content = await response.text();
  manualCache.set(mdUrl, content);
  return content;
}

export function clearManualCache(mdUrl) {
  if (mdUrl) {
    manualCache.delete(mdUrl);
  } else {
    manualCache = new Map();
  }
}

export async function renderManual(base = document, mdUrl = getManualUrl()) {
  if (!base) {
    return null;
  }
  const content = await loadManual(mdUrl);
  const target = base.querySelector('#manual-content');
  if (!target) {
    return null;
  }
  const sanitized = convert(content);
  target.innerHTML = sanitized;
  renderMermaidDiagramsIn(target).catch(() => {
    // diagramas opcionais — falha silenciosa
  });
  return target;
}

function downloadBlob(name, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileInputPicker(accept, onChange) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (file) {
      onChange(file);
    }
  });
  document.body.appendChild(input);
  input.click();
  input.remove();
}

export function openFileDialog(opts, { onContent, onError, onStatus } = {}) {
  const { openPicker = () => supportsOpenPicker(), legacyAccept = '.md,.markdown,.mdown,.txt' } =
    opts || {};

  if (openPicker()) {
    return window
      .showOpenFilePicker({ types: [MARKDOWN_ACCEPT], multiple: false })
      .then(([handle]) => {
        if (!handle) {
          return null;
        }
        return handle
          .getFile()
          .then((file) => readFileAsText(file).then((text) => ({ text, handle })));
      })
      .then((result) => {
        if (result) {
          opts.onHandle?.(result.handle);
          onContent?.(result.text);
          if (onStatus) {
            onStatus(t('fileOpened').replace('{name}', result.handle.name));
          }
        }
      })
      .catch(onError);
  }

  if (onStatus) {
    onStatus(t('filePickerFallback'));
  }
  fileInputPicker(legacyAccept, (file) => {
    readFileAsText(file).then((text) => {
      onContent?.(text);
      if (onStatus) {
        onStatus(t('fileOpened').replace('{name}', file.name));
      }
    }, onError);
  });
  return Promise.resolve();
}

export async function saveFileDialog(content, opts, { onSaved, onError, onStatus } = {}) {
  const {
    currentHandle = null,
    suggestedName = 'documento.md',
    canWrite = supportsWriteOn,
    openSavePicker = () => supportsOpenPicker(),
  } = opts || {};

  if (currentHandle && canWrite(currentHandle)) {
    try {
      const writable = await currentHandle.createWritable();
      await writable.write(content);
      await writable.close();
      onSaved?.(currentHandle.name);
      return;
    } catch (error) {
      if (error && (error.name === 'AbortError' || error.name === 'SecurityError')) {
        onStatus?.(t('fileSaveDenied'));
        return;
      }
    }
  }

  if (openSavePicker()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: toMarkdownName(suggestedName),
        types: [MARKDOWN_ACCEPT],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      onSaved?.(handle.name);
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') {
        onStatus?.(t('fileSaveDenied'));
        return;
      }
      onError?.(error);
      return;
    }
  }

  const name = toMarkdownName(suggestedName);
  downloadBlob(name, content);
  onSaved?.(name);
}

export function printDocument({ onError, onStatus } = {}) {
  try {
    if (typeof window.print === 'function') {
      window.print();
    }
  } catch (error) {
    onStatus?.(t('printError'));
    onError?.(error);
  }
}

export function setupSidebar({
  container = document,
  getContent,
  editor,
  onStatus,
  handlers = {},
} = {}) {
  if (!container) {
    return null;
  }
  const sidebar = container.querySelector('#sidebar');
  if (!sidebar) {
    return null;
  }

  const toggle = container.querySelector('#sidebar-toggle');
  const extraToggles = Array.from(container.querySelectorAll('[data-sidebar-toggle]'));
  const toggles = [toggle, ...extraToggles].filter(Boolean);

  let collapsed;
  try {
    const raw = globalThis.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    const compact =
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(max-width: 720px)').matches;
    collapsed = raw === null ? compact : raw === '1';
  } catch {
    collapsed = false;
  }
  let currentHandle = null;
  let currentName = 'documento.md';

  function applyState(open) {
    sidebar.classList.toggle('is-collapsed', !open);
    sidebar.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggles.forEach((el) => {
      el.setAttribute('aria-expanded', open ? 'true' : 'false');
      el.setAttribute('aria-label', open ? t('sidebarClose') : t('sidebarOpen'));
      el.title = open ? t('sidebarClose') : t('sidebarOpen');
    });
  }
  applyState(!collapsed);

  function toggleCollapsed() {
    const open = sidebar.classList.contains('is-collapsed');
    applyState(open);
    setSidebarCollapsed(!open);
  }

  toggles.forEach((el) => el.addEventListener('click', toggleCollapsed));

  const report = (message) => {
    if (onStatus) {
      onStatus(message);
    }
  };

  const closeButton = container.querySelector('#manual-close');
  const manualDialog = container.querySelector('#manual-dialog');

  function openManualDialog() {
    renderManual().catch(() => report(t('fileError')));
    if (manualDialog) {
      if (typeof manualDialog.showModal === 'function') {
        if (!manualDialog.open) {
          manualDialog.showModal();
        }
      } else {
        manualDialog.setAttribute('open', '');
      }
    }
  }

  if (closeButton && manualDialog) {
    closeButton.addEventListener('click', () => {
      if (typeof manualDialog.close === 'function') {
        manualDialog.close();
      } else {
        manualDialog.removeAttribute('open');
      }
    });
  }

  container.querySelectorAll('[data-sidebar-action]').forEach((button) => {
    const action = button.getAttribute('data-sidebar-action');
    if (!action) {
      return;
    }
    button.addEventListener('click', () => {
      if (action === 'manual') {
        openManualDialog();
      } else if (action === 'open') {
        openFileDialog(
          {
            onHandle: (handle) => {
              currentHandle = handle;
              currentName = handle.name;
            },
          },
          {
            onContent: (text) => {
              editor.setValue(text);
              editor.revealPosition({ lineNumber: 1, column: 1 });
              getContent?.();
            },
            onError: () => report(t('fileError')),
            onStatus: report,
          },
        );
      } else if (action === 'save') {
        saveFileDialog(
          String(getContent?.() ?? editor.getValue()),
          { currentHandle, suggestedName: currentName },
          {
            onSaved: (name) => {
              currentName = name;
              report(t('fileSaved').replace('{name}', name));
            },
            onError: () => report(t('saveError')),
            onStatus: report,
          },
        );
      } else if (action === 'print') {
        printDocument({ onError: () => report(t('printError')), onStatus: report });
      } else if (typeof handlers[action] === 'function') {
        handlers[action]({ report, editor, getContent });
      }
    });
  });

  return {
    getState: () => ({ collapsed: sidebar.classList.contains('is-collapsed') }),
    openManual: () => openManualDialog(),
    getCurrentName: () => currentName,
  };
}
