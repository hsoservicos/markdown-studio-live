/**
 * Anéis de backup locais (snapshots) — protegem contra perda se last_state
 * for corrompido. Contrato: com.markdownstudio.backup (array, máx. MAX).
 */
import { getItem, setItem, removeItem } from '../storage.js';
import { NAMESPACE } from '../i18n/index.js';
import { measureStorageUsage, STORAGE_QUOTA_BYTES } from './statusBar.js';

export const BACKUP_KEY = 'backup';
export const MAX_SNAPSHOTS = 5;
/** Intervalo mínimo entre snapshots automáticos (ms). */
export const AUTO_SNAPSHOT_MIN_INTERVAL = 60_000;
/**
 * D4: margem reservada para o rascunho primário (`last_state`/conteúdo do
 * documento). Snapshot é backup — nunca pode comer a última fatia do storage
 * e empurrar a persistência principal para `QuotaExceededError`.
 */
export const SNAPSHOT_QUOTA_MARGIN_BYTES = 256 * 1024;

/**
 * Guarda de quota (D4): projeta se o anel escrito cabe no orçamento restante.
 * Sem evicção silenciosa — quando não cabe, o snapshot é RECUSADO e o rascunho
 * primário continua tendo onde gravar. A contagem é UTF-16 (2 bytes/caractere),
 * a mesma do `measureStorageUsage`.
 *
 * @param {number} projectedBytes tamanho projetado do valor gravado (UTF-16)
 * @param {{ usedBytes?: number, storage?: Storage, quotaBytes?: number, marginBytes?: number }} [opts]
 * @returns {{ ok: boolean, projectedBytes: number, usedBytes: number, quotaBytes: number }}
 */
export function snapshotQuotaCheck(
  projectedBytes,
  {
    usedBytes,
    storage = globalThis.localStorage,
    quotaBytes = STORAGE_QUOTA_BYTES,
    marginBytes = SNAPSHOT_QUOTA_MARGIN_BYTES,
  } = {},
) {
  let used = usedBytes;
  if (typeof used !== 'number') {
    try {
      used = measureStorageUsage(storage).bytes;
    } catch {
      used = 0;
    }
  }
  return {
    ok: projectedBytes + marginBytes <= quotaBytes - used,
    projectedBytes,
    usedBytes: used,
    quotaBytes,
  };
}

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
 * idêntico ao topo. Mantém no máximo MAX_SNAPSHOTS. Recusa quando o anel não
 * cabe no orçamento de quota restante (D4) — nunca escreve para depois
 * estourar, e nunca descarta snapshot do usuário em silêncio para dar lugar.
 *
 * @param {string} content
 * @param {{ label?: string, ts?: number, id?: string, docId?: string, usedBytes?: number, quotaBytes?: number, marginBytes?: number }} [opts]
 * @returns {Snapshot|null} o snapshot criado, ou null se vazio/deduplicado/recusado
 */
export function pushSnapshot(content, opts = {}) {
  return pushSnapshotDetailed(content, opts).snap;
}

/**
 * Mesmo contrato do `pushSnapshot`, mas com o motivo da recusa exposto para
 * quem precisa anunciar (o caminho automático reporta `quota`; `empty`/`dedup`
 * são silenciosos por natureza).
 * @returns {{ snap: Snapshot|null, reason: 'stored'|'empty'|'dedup'|'quota' }}
 */
export function pushSnapshotDetailed(
  content,
  { label = '', ts = Date.now(), id, docId, usedBytes, quotaBytes, marginBytes } = {},
) {
  const text = String(content ?? '');
  if (!text) {
    return { snap: null, reason: 'empty' };
  }
  const current = listSnapshots();
  if (current[0] && current[0].content === text) {
    return { snap: null, reason: 'dedup' };
  }
  const snap = normalizeSnapshot({ id: id || makeId(ts), ts, label, content: text, docId });
  const next = [snap, ...current.filter((s) => s.id !== snap.id)].slice(0, MAX_SNAPSHOTS);
  const projectedBytes = JSON.stringify(next).length * 2;
  const check = snapshotQuotaCheck(projectedBytes, {
    usedBytes,
    quotaBytes,
    marginBytes,
  });
  if (!check.ok) {
    return { snap: null, reason: 'quota' };
  }
  saveSnapshots(next);
  return { snap, reason: 'stored' };
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
 * B6 (AC-P2-10-3): snapshots legados sem origem (pré-P2) ganham o documento
 * ativo como origem na migração — nunca ficam pendurados nem são perdidos.
 * @param {string} activeId
 * @returns {number} quantos foram atribuídos
 */
export function migrateLegacySnapshots(activeId) {
  if (!activeId) {
    return 0;
  }
  const current = listSnapshots();
  let migrated = 0;
  const next = current.map((s) => {
    if (s.docId) {
      return s;
    }
    migrated += 1;
    return { ...s, docId: activeId };
  });
  if (migrated > 0) {
    saveSnapshots(next);
  }
  return migrated;
}

/**
 * B6 (AC-P2-10-3): ao deletar um documento, seus snapshots migram para o novo
 * documento ativo (ou para a raiz "legado" quando não resta nenhum) — sem
 * origem pendurada.
 * @param {string} fromDocId
 * @param {string|null} toDocId
 * @returns {number} quantos foram reatribuídos
 */
export function reassignDocSnapshots(fromDocId, toDocId) {
  if (!fromDocId) {
    return 0;
  }
  const current = listSnapshots();
  let reassigned = 0;
  const next = current.map((s) => {
    if (s.docId !== fromDocId) {
      return s;
    }
    reassigned += 1;
    const copy = { ...s };
    if (toDocId) {
      copy.docId = toDocId;
    } else {
      delete copy.docId;
    }
    return copy;
  });
  if (reassigned > 0) {
    saveSnapshots(next);
  }
  return reassigned;
}

/**
 * Snapshot automático com throttle: só grava se passou o intervalo desde o
 * último e o conteúdo mudou.
 * @param {string} content
 * @param {{ lastAutoTs?: number, now?: number, minInterval?: number, label?: string, docId?: string, usedBytes?: number, quotaBytes?: number, marginBytes?: number }} [state]
 * @returns {{ snap: Snapshot|null, lastAutoTs: number, reason: 'stored'|'empty'|'dedup'|'quota'|'throttled' }}
 */
export function maybeAutoSnapshot(
  content,
  {
    lastAutoTs = 0,
    now = Date.now(),
    minInterval = AUTO_SNAPSHOT_MIN_INTERVAL,
    label = '',
    docId,
    usedBytes,
    quotaBytes,
    marginBytes,
  } = {},
) {
  if (now - lastAutoTs < minInterval) {
    return { snap: null, lastAutoTs, reason: 'throttled' };
  }
  const { snap, reason } = pushSnapshotDetailed(content, {
    label,
    ts: now,
    docId,
    usedBytes,
    quotaBytes,
    marginBytes,
  });
  return { snap, lastAutoTs: snap ? now : lastAutoTs, reason };
}
