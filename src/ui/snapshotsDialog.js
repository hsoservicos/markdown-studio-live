/**
 * Diálogo de snapshots locais: lista, restaura e remove entradas do anel.
 */
import { listSnapshots, removeSnapshot, getSnapshot } from './snapshots.js';
import { t } from '../i18n/index.js';

function formatTs(ts, locale = 'pt-BR') {
  try {
    return new Date(ts).toLocaleString(locale);
  } catch {
    return String(ts);
  }
}

function previewLabel(snap) {
  if (snap.label) {
    return snap.label;
  }
  const first = String(snap.content || '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!first) {
    return t('snapshotUntitled');
  }
  return first.replace(/^#+\s*/, '').slice(0, 48);
}

/**
 * @param {{ container?: ParentNode, onRestore?: (content: string, snap: object) => void, onStatus?: (msg: string) => void, getLocale?: () => string }} opts
 */
export function setupSnapshotsDialog({
  container = document,
  onRestore,
  onStatus,
  getLocale = () => 'pt-BR',
} = {}) {
  const dialog = container.querySelector('#snapshots-dialog');
  if (!dialog) {
    return null;
  }

  const listEl = container.querySelector('#snapshots-list');
  const closeButton = container.querySelector('#snapshots-close');
  const emptyEl = container.querySelector('#snapshots-empty');

  function render() {
    const snaps = listSnapshots();
    if (listEl) {
      listEl.innerHTML = '';
    }
    if (emptyEl) {
      emptyEl.hidden = snaps.length > 0;
    }
    if (!listEl) {
      return;
    }
    const locale = getLocale();
    for (const snap of snaps) {
      const row = document.createElement('div');
      row.className = 'snapshots-row';
      row.dataset.snapshotId = snap.id;

      const meta = document.createElement('div');
      meta.className = 'snapshots-meta';
      const title = document.createElement('div');
      title.className = 'snapshots-title';
      title.textContent = previewLabel(snap);
      const when = document.createElement('div');
      when.className = 'snapshots-when';
      when.textContent = formatTs(snap.ts, locale);
      meta.append(title, when);

      const actions = document.createElement('div');
      actions.className = 'snapshots-actions';

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'link-button';
      restoreBtn.dataset.action = 'restore';
      restoreBtn.textContent = t('snapshotRestore');

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'link-button';
      removeBtn.dataset.action = 'remove';
      removeBtn.textContent = t('snapshotRemove');

      actions.append(restoreBtn, removeBtn);
      row.append(meta, actions);
      listEl.append(row);
    }
  }

  function open() {
    render();
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function close() {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  listEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof globalThis.Element)) {
      return;
    }
    const button = target.closest('button[data-action]');
    const row = target.closest('[data-snapshot-id]');
    if (!button || !row) {
      return;
    }
    const id = row.getAttribute('data-snapshot-id');
    const action = button.getAttribute('data-action');
    if (action === 'restore') {
      const snap = getSnapshot(id);
      if (snap) {
        onRestore?.(snap.content, snap);
        onStatus?.(t('snapshotRestored'));
        close();
      }
    } else if (action === 'remove') {
      if (removeSnapshot(id)) {
        onStatus?.(t('snapshotRemoved'));
        render();
      }
    }
  });

  closeButton?.addEventListener('click', close);

  return { open, close, render };
}
