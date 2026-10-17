import { describe, expect, it } from 'vitest';
import { mergeBackup, mergeData, pruneTombstones, stampNow, TOMBSTONE_TTL, tombKey, withoutTombstone, withTombstones, type SyncData } from '../sync';

const base = (): SyncData => ({
  workouts: [],
  routines: [],
  customExercises: [],
  measurements: [],
  settings: {},
  schedule: {},
  exerciseNotes: {},
  deleted: {},
});

describe('mergeData', () => {
  it('keeps records from both sides', () => {
    const a = { ...base(), workouts: [{ id: 'a', updatedAt: 1 }] };
    const b = { ...base(), workouts: [{ id: 'b', updatedAt: 2 }] };
    expect(mergeData(a, b).workouts.map((w) => w.id).sort()).toEqual(['a', 'b']);
  });

  it('takes the newer edit of the same record, whichever side it is on', () => {
    const old = { id: 'x', updatedAt: 1, name: 'old' };
    const neu = { id: 'x', updatedAt: 5, name: 'new' };
    expect(mergeData({ ...base(), routines: [neu] }, { routines: [old] }).routines).toEqual([neu]);
    expect(mergeData({ ...base(), routines: [old] }, { routines: [neu] }).routines).toEqual([neu]);
  });

  it('lets a deletion win over older edits but not newer ones', () => {
    const local = { ...base(), deleted: { [tombKey('workouts', 'x')]: 10 } };
    expect(mergeData(local, { workouts: [{ id: 'x', updatedAt: 9 }] }).workouts).toEqual([]);
    expect(mergeData(local, { workouts: [{ id: 'x', updatedAt: 11 }] }).workouts).toHaveLength(1);
    // A tombstone arriving from the other side removes the local copy too.
    const mine = { ...base(), measurements: [{ id: 'm', updatedAt: 3 }] };
    expect(mergeData(mine, { deleted: { [tombKey('measurements', 'm')]: 4 } }).measurements).toEqual([]);
  });

  it('treats records without timestamps as old and prefers the incoming copy on ties', () => {
    const local = { ...base(), workouts: [{ id: 'w', name: 'local' } as never] };
    const merged = mergeData(local, { workouts: [{ id: 'w', name: 'backup' } as never] });
    expect((merged.workouts[0] as unknown as { name: string }).name).toBe('backup');
  });

  it('takes settings, schedule and notes whole from the newer side', () => {
    const local = { ...base(), settings: { updatedAt: 5, unit: 'kg' }, schedule: { 0: 'r1' }, scheduleUpdatedAt: 5 };
    const merged = mergeData(local, { settings: { updatedAt: 3, unit: 'lb' }, schedule: { 1: 'r2' }, scheduleUpdatedAt: 3 } as never);
    expect((merged.settings as { unit: string }).unit).toBe('kg');
    expect(merged.schedule).toEqual({ 0: 'r1' });
  });

  it('keeps pinned notes from both sides when the backup has no timestamp', () => {
    const local: SyncData = { ...base(), exerciseNotes: { a: '1' } };
    const merged = mergeData(local, { exerciseNotes: { b: '2' } });
    expect(merged.exerciseNotes).toEqual({ a: '1', b: '2' });
  });
});

describe('mergeBackup', () => {
  it('brings back records deleted after the backup was made', () => {
    const local: SyncData = { ...base(), deleted: { [tombKey('workouts', 'w')]: 50 } };
    const merged = mergeBackup(local, { workouts: [{ id: 'w', updatedAt: 10 }] });
    expect(merged.workouts.map((w) => w.id)).toEqual(['w']);
    expect(merged.deleted).toEqual({});
  });
  it('keeps unrelated deletions', () => {
    const local: SyncData = { ...base(), deleted: { [tombKey('workouts', 'gone')]: 50 } };
    expect(Object.keys(mergeBackup(local, { workouts: [] }).deleted ?? {})).toEqual([tombKey('workouts', 'gone')]);
  });
});

describe('tombstones', () => {
  it('are added, removed on restore and pruned when very old', () => {
    let d = withTombstones({}, 'workouts', ['a', 'b'], 100);
    expect(Object.keys(d)).toHaveLength(2);
    d = withoutTombstone(d, 'workouts', 'a');
    expect(d).toEqual({ [tombKey('workouts', 'b')]: 100 });
    expect(pruneTombstones(d, 100 + TOMBSTONE_TTL + 1)).toEqual({});
  });

  it('stamps strictly increase', () => {
    const a = stampNow();
    const b = stampNow();
    expect(b).toBeGreaterThan(a);
  });
});
