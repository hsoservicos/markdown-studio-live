import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupSnapshotsDialog } from '../../src/ui/snapshotsDialog.js';
import { pushSnapshot, listSnapshots } from '../../src/ui/snapshots.js';
import { setLocale } from '../../src/i18n/index.js';

function buildDom() {
  const root = document.createElement('div');
  root.innerHTML = `
    <dialog id="snapshots-dialog">
      <button type="button" id="snapshots-close">Fechar</button>
      <p id="snapshots-empty" hidden></p>
      <div id="snapshots-list"></div>
    </dialog>
  `;
  document.body.appendChild(root);
  return root;
}

describe('setupSnapshotsDialog', () => {
  let root;

  beforeEach(() => {
    localStorage.clear();
    setLocale('pt-BR');
    root = buildDom();
  });

  afterEach(() => {
    root?.remove();
    localStorage.clear();
  });

  it('retorna null sem diálogo', () => {
    expect(setupSnapshotsDialog({ container: document.createElement('div') })).toBeNull();
  });

  it('lista vazia mostra empty state', () => {
    const api = setupSnapshotsDialog({ container: document });
    api.open();
    const empty = document.querySelector('#snapshots-empty');
    expect(empty.hidden).toBe(false);
    expect(document.querySelectorAll('.snapshots-row')).toHaveLength(0);
    api.close();
  });

  it('renderiza snapshots e restaura ao clicar', () => {
    pushSnapshot('# Título A\ncorpo', { ts: 1000, label: '' });
    pushSnapshot('# Título B', { ts: 2000, label: 'manual' });
    const onRestore = vi.fn();
    const onStatus = vi.fn();
    const api = setupSnapshotsDialog({ container: document, onRestore, onStatus });
    api.open();
    const rows = document.querySelectorAll('.snapshots-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.snapshots-title').textContent).toBe('manual');
    expect(rows[1].querySelector('.snapshots-title').textContent).toContain('Título A');

    rows[0].querySelector('[data-action="restore"]').click();
    expect(onRestore).toHaveBeenCalledWith(
      '# Título B',
      expect.objectContaining({ content: '# Título B' }),
    );
    expect(onStatus).toHaveBeenCalled();
  });

  it('remove snapshot da lista', () => {
    const snap = pushSnapshot('x', { ts: 1 });
    const onStatus = vi.fn();
    const api = setupSnapshotsDialog({ container: document, onStatus });
    api.open();
    document.querySelector('[data-action="remove"]').click();
    expect(listSnapshots().find((s) => s.id === snap.id)).toBeUndefined();
    expect(document.querySelectorAll('.snapshots-row')).toHaveLength(0);
    expect(onStatus).toHaveBeenCalled();
  });
});
