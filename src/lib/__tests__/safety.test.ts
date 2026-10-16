import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = new Map<string, unknown>();
let failNextWrite: Error | null = null;
vi.mock('idb-keyval', () => ({
  get: async (k: string) => db.get(k),
  set: async (k: string, v: unknown) => {
    if (failNextWrite) {
      const e = failNextWrite;
      failNextWrite = null;
      throw e;
    }
    db.set(k, v);
  },
  del: async (k: string) => void db.delete(k),
}));

const { safeStorage, finishLoad, useSafety, createSnapshot, listSnapshots, parseBackup, makeBackupFile, STORE_KEY } = await import('../safety');
const { backupDue } = await import('../backup');

beforeEach(() => {
  db.clear();
  useSafety.setState({ writesAllowed: false, loadError: null, saveError: null });
});

describe('guarded storage', () => {
  it('does not write anything before a successful load', async () => {
    await safeStorage.setItem(STORE_KEY, '{"state":{}}');
    expect(db.has(STORE_KEY)).toBe(false);
    finishLoad();
    await safeStorage.setItem(STORE_KEY, '{"state":{}}');
    expect(db.get(STORE_KEY)).toBe('{"state":{}}');
  });

  it('quarantines corrupted data and keeps writes blocked', async () => {
    db.set(STORE_KEY, '{"state": {broken');
    await expect(safeStorage.getItem(STORE_KEY)).rejects.toThrow(/damaged/);
    expect([...db.keys()].some((k) => k.startsWith('gym-quarantine:'))).toBe(true);
    finishLoad(new Error('x'));
    await safeStorage.setItem(STORE_KEY, '{"state":{"workouts":[]}}');
    expect(db.get(STORE_KEY)).toBe('{"state": {broken');
    expect(useSafety.getState().loadError).toBe('x');
  });

  it('reports a full device instead of throwing, and clears the error after the next good save', async () => {
    finishLoad();
    failNextWrite = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    await expect(safeStorage.setItem(STORE_KEY, '{}')).resolves.toBeUndefined();
    expect(useSafety.getState().saveError).toMatch(/out of space/);
    await safeStorage.setItem(STORE_KEY, '{}');
    expect(useSafety.getState().saveError).toBeNull();
  });
});

describe('snapshots', () => {
  it('keeps at most 7 daily snapshots, newest first', async () => {
    for (let i = 0; i < 9; i++) await createSnapshot('daily', { workouts: new Array(i) });
    const list = await listSnapshots();
    expect(list).toHaveLength(7);
    expect(list[0].workouts).toBe(8);
    expect([...db.keys()].filter((k) => k.startsWith('gym-snapshot:'))).toHaveLength(7);
  });

  it('keeps pre-operation snapshots separately from daily ones', async () => {
    for (let i = 0; i < 8; i++) await createSnapshot('daily', { workouts: [] });
    await createSnapshot('before-reset', { workouts: [1, 2, 3] });
    const list = await listSnapshots();
    expect(list.some((s) => s.reason === 'before-reset' && s.workouts === 3)).toBe(true);
  });
});

describe('parseBackup', () => {
  const w = { id: 'a', name: 'T', startedAt: 1, exercises: [{ id: 'e', exerciseId: 'squat', sets: [] }] };

  it('accepts the wrapped format', () => {
    const r = parseBackup(makeBackupFile({ workouts: [w], routines: [] }));
    expect(r.ok).toBe(true);
  });

  it('accepts the older bare format', () => {
    expect(parseBackup(JSON.stringify({ workouts: [w] })).ok).toBe(true);
  });

  it('rejects invalid JSON, foreign files and damaged workouts', () => {
    expect(parseBackup('nope').ok).toBe(false);
    expect(parseBackup('{"foo":1}').ok).toBe(false);
    const bad = parseBackup(JSON.stringify({ workouts: [{ id: 'a', exercises: 'x' }] }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/Nothing was changed/);
  });

  it('rejects backups from a newer schema', () => {
    const r = parseBackup(JSON.stringify({ app: 'gym-tracker', schema: 99, data: { workouts: [] } }));
    expect(r.ok).toBe(false);
  });
});

describe('backupDue', () => {
  const DAY = 86_400_000;
  const now = 1_800_000_000_000;
  it('waits until there is something to lose', () => expect(backupDue(2, undefined, undefined, now)).toBe(false));
  it('asks when there was never a backup', () => expect(backupDue(5, undefined, undefined, now)).toBe(true));
  it('asks again after 14 days', () => {
    expect(backupDue(5, now - 10 * DAY, undefined, now)).toBe(false);
    expect(backupDue(5, now - 15 * DAY, undefined, now)).toBe(true);
  });
  it('respects snoozing', () => expect(backupDue(5, undefined, now + DAY, now)).toBe(false));
});
