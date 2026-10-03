import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  listSnapshots,
  pushSnapshot,
  pushSnapshotDetailed,
  snapshotQuotaCheck,
  SNAPSHOT_QUOTA_MARGIN_BYTES,
  getSnapshot,
  removeSnapshot,
  clearSnapshots,
  saveSnapshots,
  normalizeSnapshot,
  maybeAutoSnapshot,
  migrateLegacySnapshots,
  reassignDocSnapshots,
  MAX_SNAPSHOTS,
  AUTO_SNAPSHOT_MIN_INTERVAL,
  BACKUP_KEY,
} from '../../src/ui/snapshots.js';
import { NAMESPACE } from '../../src/i18n/index.js';

describe('snapshots', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('normalizeSnapshot rejeita entradas inválidas', () => {
    expect(normalizeSnapshot(null)).toBeNull();
    expect(normalizeSnapshot({ ts: 1 })).toBeNull();
    expect(normalizeSnapshot({ content: 1 })).toBeNull();
  });

  it('normalizeSnapshot preenche id/ts/label', () => {
    const snap = normalizeSnapshot({ content: 'x' });
    expect(snap.content).toBe('x');
    expect(snap.id).toMatch(/^snap-/);
    expect(typeof snap.ts).toBe('number');
    expect(snap.label).toBe('');
  });

  it('pushSnapshot cria anel e deduplica topo idêntico', () => {
    const a = pushSnapshot('# um', { label: 'a', ts: 1000 });
    expect(a).not.toBeNull();
    expect(listSnapshots()).toHaveLength(1);

    expect(pushSnapshot('# um', { ts: 2000 })).toBeNull();
    expect(listSnapshots()).toHaveLength(1);

    const b = pushSnapshot('# dois', { ts: 3000 });
    expect(b).not.toBeNull();
    const list = listSnapshots();
    expect(list).toHaveLength(2);
    expect(list[0].content).toBe('# dois');
    expect(list[1].content).toBe('# um');
  });

  it(`mantém no máximo ${MAX_SNAPSHOTS} entradas`, () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i += 1) {
      pushSnapshot(`doc ${i}`, { ts: 1000 + i });
    }
    expect(listSnapshots()).toHaveLength(MAX_SNAPSHOTS);
    expect(listSnapshots()[0].content).toBe(`doc ${MAX_SNAPSHOTS + 2}`);
  });

  it('getSnapshot / removeSnapshot / clearSnapshots', () => {
    const snap = pushSnapshot('alvo', { ts: 1 });
    pushSnapshot('outro', { ts: 2 });
    expect(getSnapshot(snap.id)?.content).toBe('alvo');
    expect(removeSnapshot(snap.id)).toBe(true);
    expect(getSnapshot(snap.id)).toBeNull();
    expect(removeSnapshot('inexistente')).toBe(false);
    clearSnapshots();
    expect(listSnapshots()).toHaveLength(0);
  });

  it('saveSnapshots descarta lixo e trunca', () => {
    const cleaned = saveSnapshots([
      { content: 'ok', ts: 1, id: 'a' },
      { foo: 1 },
      null,
      ...Array.from({ length: 10 }, (_, i) => ({ content: `n${i}`, ts: i + 2, id: `i${i}` })),
    ]);
    expect(cleaned.every((s) => s && typeof s.content === 'string')).toBe(true);
    expect(cleaned.length).toBeLessThanOrEqual(MAX_SNAPSHOTS);
  });

  it('maybeAutoSnapshot respeita throttle', () => {
    const t0 = 1_000_000;
    const first = maybeAutoSnapshot('v1', { lastAutoTs: 0, now: t0 });
    expect(first.snap).not.toBeNull();
    expect(first.lastAutoTs).toBe(t0);

    const blocked = maybeAutoSnapshot('v2', {
      lastAutoTs: first.lastAutoTs,
      now: t0 + AUTO_SNAPSHOT_MIN_INTERVAL - 1,
    });
    expect(blocked.snap).toBeNull();
    expect(blocked.lastAutoTs).toBe(t0);

    const allowed = maybeAutoSnapshot('v2', {
      lastAutoTs: first.lastAutoTs,
      now: t0 + AUTO_SNAPSHOT_MIN_INTERVAL,
    });
    expect(allowed.snap).not.toBeNull();
    expect(allowed.lastAutoTs).toBe(t0 + AUTO_SNAPSHOT_MIN_INTERVAL);
  });

  it('listSnapshots tolera storage corrompido', () => {
    localStorage.setItem(
      `${NAMESPACE}.${BACKUP_KEY}`,
      JSON.stringify({ value: 'nao-array', expiresAt: Date.now() + 1e12 }),
    );
    expect(listSnapshots()).toEqual([]);
  });
});

describe('guarda de quota dos snapshots (D4)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('snapshotQuotaCheck aprova quando o anel cabe no orçamento menos a margem', () => {
    const check = snapshotQuotaCheck(1000, {
      usedBytes: 4_000_000,
      quotaBytes: 5_000_000,
      marginBytes: 256 * 1024,
    });
    expect(check.ok).toBe(true);
  });

  it('snapshotQuotaCheck recusa quando sobra menos que a margem', () => {
    const check = snapshotQuotaCheck(1000, {
      usedBytes: 5_000_000 - 100_000,
      quotaBytes: 5_000_000,
      marginBytes: 256 * 1024,
    });
    expect(check.ok).toBe(false);
  });

  it('pushSnapshot recusa sem escrever e sem derrubar o anel existente (sem evicção silenciosa)', () => {
    const primeiro = pushSnapshot('# original', { ts: 1, usedBytes: 0 });
    expect(primeiro).not.toBeNull();

    const recusado = pushSnapshot('# gigante', {
      ts: 2,
      usedBytes: 5_000_000 - 10_000,
      quotaBytes: 5_000_000,
    });
    expect(recusado).toBeNull();

    const list = listSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe('# original');
  });

  it('pushSnapshotDetailed expõe o motivo da recusa', () => {
    expect(pushSnapshotDetailed('').reason).toBe('empty');
    pushSnapshot('# topo', { ts: 1, usedBytes: 0 });
    expect(pushSnapshotDetailed('# topo', { ts: 2 }).reason).toBe('dedup');
    expect(pushSnapshotDetailed('# novo', { ts: 3, usedBytes: 0 }).reason).toBe('stored');
    expect(
      pushSnapshotDetailed('# sem espaço', {
        ts: 4,
        usedBytes: 5_000_000 - 10_000,
        quotaBytes: 5_000_000,
      }).reason,
    ).toBe('quota');
  });

  it('maybeAutoSnapshot repassa o motivo para o chamador anunciar', () => {
    const t0 = 1_000_000;
    expect(maybeAutoSnapshot('v1', { lastAutoTs: 0, now: t0, usedBytes: 0 }).reason).toBe('stored');
    expect(maybeAutoSnapshot('v1', { lastAutoTs: t0, now: t0 + 1 }).reason).toBe('throttled');
    // quota cheia: v2 é recusado e o topo continua v1
    expect(
      maybeAutoSnapshot('v2', {
        lastAutoTs: t0,
        now: t0 + AUTO_SNAPSHOT_MIN_INTERVAL,
        usedBytes: 5_000_000 - 10_000,
        quotaBytes: 5_000_000,
      }).reason,
    ).toBe('quota');
    // dedup: v1 continua no topo
    expect(
      maybeAutoSnapshot('v1', { lastAutoTs: t0, now: t0 + AUTO_SNAPSHOT_MIN_INTERVAL * 2 }).reason,
    ).toBe('dedup');
    expect(
      maybeAutoSnapshot('', { lastAutoTs: 0, now: t0 + AUTO_SNAPSHOT_MIN_INTERVAL * 3 }).reason,
    ).toBe('empty');
  });

  it('a margem protege o rascunho primário (snapshot nunca come a última fatia)', () => {
    expect(SNAPSHOT_QUOTA_MARGIN_BYTES).toBeGreaterThan(0);
    // Cabe o snapshot sozinho, mas não com a margem reservada.
    const semMargem = snapshotQuotaCheck(300_000, {
      usedBytes: 5_000_000 - 350_000,
      quotaBytes: 5_000_000,
      marginBytes: 0,
    });
    const comMargem = snapshotQuotaCheck(300_000, {
      usedBytes: 5_000_000 - 350_000,
      quotaBytes: 5_000_000,
    });
    expect(semMargem.ok).toBe(true);
    expect(comMargem.ok).toBe(false);
  });
});

describe('B6 — snapshots sem origem pendurada (AC-P2-10-3)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('migrateLegacySnapshots atribui os órfãos ao documento ativo', () => {
    pushSnapshot('# legado 1', { ts: 1 });
    pushSnapshot('# com origem', { ts: 2, docId: 'doc-x' });

    expect(migrateLegacySnapshots('doc-ativo')).toBe(1);
    const list = listSnapshots();
    expect(list.find((s) => s.content === '# legado 1').docId).toBe('doc-ativo');
    expect(list.find((s) => s.content === '# com origem').docId).toBe('doc-x');
  });

  it('reassignDocSnapshots migra os do documento fechado para o ativo seguinte', () => {
    pushSnapshot('# do doc fechado', { ts: 1, docId: 'doc-fechado' });
    pushSnapshot('# de outro', { ts: 2, docId: 'doc-outro' });

    expect(reassignDocSnapshots('doc-fechado', 'doc-novo')).toBe(1);
    const list = listSnapshots();
    expect(list.find((s) => s.content === '# do doc fechado').docId).toBe('doc-novo');
    expect(list.find((s) => s.content === '# de outro').docId).toBe('doc-outro');
  });

  it('sem documento ativo seguinte, os snapshots vão para a raiz legado (docId removido)', () => {
    pushSnapshot('# órfão', { ts: 1, docId: 'doc-fechado' });
    expect(reassignDocSnapshots('doc-fechado', null)).toBe(1);
    expect(listSnapshots()[0].docId).toBeUndefined();
  });
});
