import { describe, expect, it } from 'vitest';
import { runSync, type SyncBackend, type SyncCursor } from '../syncEngine';
import { changedRows, rowsToData, type SyncRow } from '../syncRows';
import { mergeData, tombKey } from '../sync';
import { defaultSettings } from '../calc';
import type { BackupData } from '../../store/store';
import type { Workout } from '../../types';

/** In-memory server that behaves like public.records + sync_push (last writer wins). */
class FakeServer implements SyncBackend {
  rows = new Map<string, SyncRow>();
  seq = 0;
  async push(rows: SyncRow[]) {
    for (const r of rows) {
      const k = `${r.collection}:${r.id}`;
      const cur = this.rows.get(k);
      const ts = Math.max(r.updated_at, r.deleted_at ?? 0);
      if (cur && Math.max(cur.updated_at, cur.deleted_at ?? 0) > ts) continue;
      this.rows.set(k, { ...r, data: r.deleted_at != null ? null : r.data, seq: ++this.seq });
    }
  }
  async pull(after: number, limit: number) {
    return [...this.rows.values()].filter((r) => (r.seq ?? 0) > after).sort((a, b) => a.seq! - b.seq!).slice(0, limit);
  }
}

class Device {
  data: BackupData;
  cursor: SyncCursor = { seq: 0, pushedAt: 0 };
  constructor(data: Partial<BackupData> = {}) {
    this.data = { workouts: [], routines: [], customExercises: [], measurements: [], settings: defaultSettings(), schedule: {}, exerciseNotes: {}, deleted: {}, ...data };
  }
  async sync(server: SyncBackend, now: number) {
    const r = await runSync(server, this.cursor, () => this.data, now);
    if (r.merged) this.data = r.merged;
    this.cursor = r.cursor;
    return r;
  }
}

const w = (id: string, updatedAt?: number, name = id): Workout => ({ id, name, startedAt: 1, exercises: [], updatedAt });

describe('sync rows', () => {
  it('round-trips records, tombstones and documents', () => {
    const data: BackupData = {
      workouts: [w('a', 5)],
      routines: [],
      customExercises: [],
      measurements: [],
      settings: { ...defaultSettings(), updatedAt: 3 },
      schedule: { 0: 'r' },
      scheduleUpdatedAt: 4,
      exerciseNotes: { squat: 'belt' },
      notesUpdatedAt: 6,
      deleted: { [tombKey('routines', 'x')]: 7 },
    };
    const back = rowsToData(changedRows(data, 0));
    expect(back.workouts).toEqual(data.workouts);
    expect(back.deleted).toEqual(data.deleted);
    expect(back.schedule).toEqual({ 0: 'r' });
    expect(back.exerciseNotes).toEqual({ squat: 'belt' });
    expect(back.settings?.updatedAt).toBe(3);
  });

  it('only sends what changed after the cursor, except on the first sync', () => {
    const data = { ...new Device().data, workouts: [w('old'), w('new', 10)] };
    expect(changedRows(data, 0).filter((r) => r.collection === 'workouts')).toHaveLength(2);
    expect(changedRows(data, 5).map((r) => r.id)).toEqual(['new']);
  });
});

describe('runSync', () => {
  it('merges two phones without losing anything', async () => {
    const server = new FakeServer();
    const phone = new Device({ workouts: [w('p1', 10)] });
    const tablet = new Device({ workouts: [w('t1', 20)] });
    await phone.sync(server, 100);
    await tablet.sync(server, 110);
    await phone.sync(server, 120);
    expect(phone.data.workouts.map((x) => x.id).sort()).toEqual(['p1', 't1']);
    expect(tablet.data.workouts.map((x) => x.id).sort()).toEqual(['p1', 't1']);
  });

  it('spreads deletions and newer edits, and an old edit never wins', async () => {
    const server = new FakeServer();
    const a = new Device({ workouts: [w('x', 10, 'first')] });
    const b = new Device();
    await a.sync(server, 100);
    await b.sync(server, 101);
    // b edits later, a deletes even later.
    b.data = { ...b.data, workouts: [w('x', 200, 'edited')] };
    await b.sync(server, 201);
    a.data = { ...a.data, workouts: [], deleted: { [tombKey('workouts', 'x')]: 300 } };
    await a.sync(server, 301);
    await b.sync(server, 302);
    expect(b.data.workouts).toEqual([]);
    // A stale copy pushed later with an old time is ignored by the server.
    await server.push([{ collection: 'workouts', id: 'x', data: w('x', 150, 'stale'), updated_at: 150 }]);
    const fresh = new Device();
    await fresh.sync(server, 400);
    expect(fresh.data.workouts).toEqual([]);
  });

  it('does not upload what it just downloaded', async () => {
    const server = new FakeServer();
    const a = new Device({ workouts: [w('x', 5000)] }); // clock far ahead
    await a.sync(server, 100);
    const b = new Device();
    await b.sync(server, 200);
    const pushes: number[] = [];
    const spy: SyncBackend = { pull: (s, l) => server.pull(s, l), push: async (r) => void pushes.push(r.length) };
    await runSync(spy, b.cursor, () => b.data, 300);
    expect(pushes).toEqual([]);
  });

  it('keeps local-only data on first sign-in to an account that already has data', async () => {
    const server = new FakeServer();
    await new Device({ workouts: [w('cloud', 10)] }).sync(server, 50);
    const offline = new Device({ workouts: [w('local')] }); // made before change times existed
    await offline.sync(server, 60);
    expect(offline.data.workouts.map((x) => x.id).sort()).toEqual(['cloud', 'local']);
    expect(mergeData(offline.data, {}).workouts).toHaveLength(2);
  });
});
