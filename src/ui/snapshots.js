/**
 * Anéis de backup locais (snapshots) — protegem contra perda se last_state
 * for corrompido. Contrato: com.markdownstudio.backup (array, máx. MAX).
 */
import { getItem, setItem, removeItem } from '../storage.js';
import { NAMESPACE } from '../i18n/index.js';

export const BACKUP_KEY = 'backup';
export const MAX_SNAPSHOTS = 5;
/** Intervalo mínimo entre snapshots automáticos (ms). */
export const AUTO_SNAPSHOT_MIN_INTERVAL = 60_000;

/**
 * @typedef {{ id: string, ts: number, label: string, content: string, docId?: string }} Snapshot
 */

function makeId(ts = Date.now()) {
  return `snap-${ts}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normaliza uma entrada crua do storage para Snapshot ou null.
 * @param {unknown} raw
 * @returns {Snapshot|null}
 */
export function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  if (typeof obj.content !== 'string') {
    return null;
  }
  const ts = typeof obj.ts === 'number' && Number.isFinite(obj.ts) ? obj.ts : Date.now();
  const id = typeof obj.id === 'string' && obj.id ? obj.id : makeId(ts);
  const label = typeof obj.label === 'string' ? obj.label : '';
  const docId = typeof obj.docId === 'string' && obj.docId ? obj.docId : undefined;
  return { id, ts, label, content: obj.content, ...(docId ? { docId } : {}) };
}

/**
 * @returns {Snapshot[]}
 */
export function listSnapshots() {
  let raw;
  try {
    raw = getItem(NAMESPACE, BACKUP_KEY);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeSnapshot).filter(Boolean);
}

/**
 * @param {Snapshot[]} list
 */
export function saveSnapshots(list) {
  const cleaned = (list || []).map(normalizeSnapshot).filter(Boolean).slice(0, MAX_SNAPSHOTS);
  setItem(NAMESPACE, BACKUP_KEY, cleaned);
  return cleaned;
}

/**
 * Empurra um snapshot no anel (mais recente primeiro). Dedup se conteúdo
 * idêntico ao topo. Mantém no máximo MAX_SNAPSHOTS.
 * @param {string} content
 * @param {{ label?: string, ts?: number, id?: string, docId?: string }} [opts]
 * @returns {Snapshot|null} o snapshot criado, ou null se deduplicado/vazio
 */
export function pushSnapshot(content, { label = '', ts = Date.now(), id, docId } = {}) {
  const text = String(content ?? '');
  if (!text) {
    return null;
  }
  const current = listSnapshots();
  if (current[0] && current[0].content === text) {
    return null;
  }
  const snap = normalizeSnapshot({ id: id || makeId(ts), ts, label, content: text, docId });
  const next = [snap, ...current.filter((s) => s.id !== snap.id)].slice(0, MAX_SNAPSHOTS);
  saveSnapshots(next);
  return snap;
}

/**
 * @param {string} id
 * @returns {Snapshot|null}
 */
export function getSnapshot(id) {
  return listSnapshots().find((s) => s.id === id) ?? null;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function removeSnapshot(id) {
  const current = listSnapshots();
  const next = current.filter((s) => s.id !== id);
  if (next.length === current.length) {
    return false;
  }
  saveSnapshots(next);
  return true;
}

export function clearSnapshots() {
  removeItem(NAMESPACE, BACKUP_KEY);
}

/**
 * Snapshot automático com throttle: só grava se passou o intervalo desde o
 * último e o conteúdo mudou.
 * @param {string} content
 * @param {{ lastAutoTs?: number, now?: number, minInterval?: number, label?: string, docId?: string }} [state]
 * @returns {{ snap: Snapshot|null, lastAutoTs: number }}
 */
export function maybeAutoSnapshot(
  content,
  {
    lastAutoTs = 0,
    now = Date.now(),
    minInterval = AUTO_SNAPSHOT_MIN_INTERVAL,
    label = '',
    docId,
  } = {},
) {
  if (now - lastAutoTs < minInterval) {
    return { snap: null, lastAutoTs };
  }
  const snap = pushSnapshot(content, { label, ts: now, docId });
  return { snap, lastAutoTs: snap ? now : lastAutoTs };
}
