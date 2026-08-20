import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  listSnapshots,
  pushSnapshot,
  getSnapshot,
  removeSnapshot,
  clearSnapshots,
  saveSnapshots,
  normalizeSnapshot,
  maybeAutoSnapshot,
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
