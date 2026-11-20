import { describe, expect, it } from 'vitest';
// @ts-expect-error Node built-in; the project has no Node type definitions and none are added for this local-only check.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { computeReference } from './referenceSnapshot';
import { parseBackup } from '../safety';
import type { Workout } from '../../types';

declare const process: { env: Record<string, string | undefined> };

const BACKUP = 'private/backup.json';
const BEFORE = 'private/reference-before.json';

const set = (type: string, weight: number, reps: number) => ({ id: Math.random().toString(), type, weight, reps, done: true });
const fake: Workout = {
  id: 'w1', name: 'x', startedAt: 1, finishedAt: 2,
  exercises: [{ id: 'e1', exerciseId: 'bench-press', sets: [set('warmup', 40, 10), set('normal', 80, 8), set('normal', 80, 8)] }],
} as unknown as Workout;

describe('reference snapshot', () => {
  it('separates volume with and without warm-ups', () => {
    const r = computeReference({ workouts: [fake] });
    expect(r.volumeKgNow).toBe(400 + 1280);
    expect(r.volumeKgWithoutWarmups).toBe(1280);
    expect(r.warmupSets).toBe(1);
  });

  // Runs only on your machine, with your real backup in private/ (ignored by git).
  // REF_WRITE=1 npx vitest run reference  -> writes private/reference-before.json
  // npx vitest run reference               -> compares against it
  it.skipIf(!existsSync(BACKUP))('matches the saved reference of the real data', () => {
    const parsed = parseBackup(readFileSync(BACKUP, 'utf8'));
    if (!parsed.ok) throw new Error(parsed.error);
    const now = computeReference(parsed.data as never);
    if (process.env.REF_WRITE || !existsSync(BEFORE)) {
      writeFileSync(BEFORE, JSON.stringify(now, null, 2));
      return;
    }
    expect(now).toEqual(JSON.parse(readFileSync(BEFORE, 'utf8')));
  });
});
