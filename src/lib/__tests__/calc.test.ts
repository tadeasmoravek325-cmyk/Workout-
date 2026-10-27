import { describe, expect, it } from 'vitest';
import {
  computeRecords,
  detectPRs,
  e1rm,
  nextRoutine,
  exerciseHistory,
  muscleRecovery,
  plateCalc,
  setsPerMuscle,
  startOfWeek,
  suggestNext,
  warmupSets,
  weekStreak,
} from '../calc';
import { BUILTIN_EXERCISES, youtubeSearchUrl } from '../../data/exercises';
import type { Workout, WorkoutSet } from '../../types';

const exMap = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
const bench = exMap.get('bench-press')!;
const DAY = 86_400_000;

let n = 0;
function set(weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: String(++n), type: 'normal', weight, reps, done: true, ...extra };
}
function workout(daysAgo: number, exerciseId: string, sets: WorkoutSet[], now = Date.now()): Workout {
  const startedAt = now - daysAgo * DAY;
  return { id: `w${++n}`, name: 'T', startedAt, finishedAt: startedAt + 3_600_000, exercises: [{ id: `e${n}`, exerciseId, sets }] };
}

describe('e1rm', () => {
  it('returns the weight for a single', () => expect(e1rm(100, 1)).toBe(100));
  it('uses Epley above one rep', () => expect(e1rm(100, 5)).toBeCloseTo(116.67, 1));
  it('is zero without reps', () => expect(e1rm(100, 0)).toBe(0));
});

describe('plateCalc', () => {
  it('loads 100 kg on a 20 kg bar as 25+15 per side', () => {
    const r = plateCalc(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(r.perSide).toEqual([25, 15]);
    expect(r.remainder).toBe(0);
  });
  it('reports the remainder when the weight is not reachable', () => {
    const r = plateCalc(101, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(r.achieved).toBe(100);
    expect(r.remainder).toBeCloseTo(1);
  });
  it('returns just the bar for light targets', () => {
    expect(plateCalc(15, 20, [25]).perSide).toEqual([]);
  });
});

describe('warmupSets', () => {
  it('ramps towards the working weight', () => {
    const w = warmupSets(100, 20);
    expect(w.map((s) => s.weight)).toEqual([20, 40, 60, 80]);
    expect(w.every((s) => s.weight < 100)).toBe(true);
  });
  it('is empty when the working weight is the bar', () => expect(warmupSets(20, 20)).toEqual([]));
});

describe('records and PRs', () => {
  it('computes rep maxes and ignores warm-ups', () => {
    const w = workout(1, 'bench-press', [set(140, 1, { type: 'warmup' }), set(100, 5), set(110, 1)]);
    const r = computeRecords(exerciseHistory([w], 'bench-press'));
    expect(r.maxWeight).toBe(110);
    expect(r.repMaxes[5]).toBe(100);
    expect(r.repMaxes[1]).toBe(110);
  });

  it('detects a weight PR against earlier workouts only', () => {
    const old = workout(7, 'bench-press', [set(100, 5)]);
    const now = workout(0, 'bench-press', [set(105, 5)]);
    const prs = detectPRs(now, [old], exMap);
    expect(prs.map((p) => p.kind)).toEqual(expect.arrayContaining(['weight', 'e1rm', 'volume']));
  });

  it('treats the first session as a baseline', () => {
    const now = workout(0, 'bench-press', [set(105, 5)]);
    expect(detectPRs(now, [], exMap)).toEqual([]);
  });
});

describe('suggestNext (smart coach)', () => {
  it('adds weight when all sets held their reps', () => {
    const s = suggestNext(bench, exerciseHistory([workout(2, 'bench-press', [set(80, 8), set(80, 8), set(80, 8)])], 'bench-press'));
    expect(s?.kind).toBe('increase');
    expect(s?.weight).toBe(82.5);
    expect(s?.reps).toBe(8);
  });

  it('adds 5 kg on lower-body barbell lifts', () => {
    const squat = exMap.get('squat')!;
    const s = suggestNext(squat, exerciseHistory([workout(2, 'squat', [set(100, 5), set(100, 5)])], 'squat'));
    expect(s?.weight).toBe(105);
  });

  it('repeats the weight when reps dropped off', () => {
    const s = suggestNext(bench, exerciseHistory([workout(2, 'bench-press', [set(80, 8), set(80, 6), set(80, 5)])], 'bench-press'));
    expect(s?.kind).toBe('repeat');
    expect(s?.weight).toBe(80);
  });

  it('holds the weight when the muscle already did many hard sets', () => {
    const hist = exerciseHistory([workout(2, 'bench-press', [set(80, 8), set(80, 8), set(80, 8)])], 'bench-press');
    expect(suggestNext(bench, hist, { recent: 3, session: 2 })?.kind).toBe('increase');
    const today = suggestNext(bench, hist, { recent: 3, session: 9 });
    expect(today?.kind).toBe('repeat');
    expect(today?.weight).toBe(80);
    expect(suggestNext(bench, hist, { recent: 15, session: 0 })?.weight).toBe(80);
  });

  it('does not add weight after an RPE 10 set', () => {
    const s = suggestNext(bench, exerciseHistory([workout(2, 'bench-press', [set(80, 8, { rpe: 10 }), set(80, 8)])], 'bench-press'));
    expect(s?.kind).toBe('repeat');
  });

  it('suggests a deload after three sessions without progress', () => {
    const hist = exerciseHistory(
      [
        workout(2, 'bench-press', [set(80, 8), set(80, 5)]),
        workout(5, 'bench-press', [set(80, 8), set(80, 6)]),
        workout(8, 'bench-press', [set(80, 8), set(80, 7)]),
      ],
      'bench-press',
    );
    const s = suggestNext(bench, hist);
    expect(s?.kind).toBe('deload');
    expect(s?.weight).toBe(72.5);
  });

  it('adds a rep for reps-only exercises', () => {
    const pushUp = exMap.get('push-up')!;
    const s = suggestNext(pushUp, exerciseHistory([workout(1, 'push-up', [{ id: 'x', type: 'normal', reps: 20, done: true }])], 'push-up'));
    expect(s?.reps).toBe(21);
  });

  it('returns null without history', () => expect(suggestNext(bench, [])).toBeNull());
});

describe('weekStreak', () => {
  const now = new Date(2026, 9, 15, 12).getTime(); // Thursday
  const wk = (weeksAgo: number, dayOffset = 0) => startOfWeek(now) - weeksAgo * 7 * DAY + dayOffset * DAY + 10 * 3_600_000;
  const at = (ts: number): Workout => ({ id: String(ts), name: 'x', startedAt: ts, exercises: [] });

  it('counts consecutive weeks meeting the goal and ignores an unfinished current week', () => {
    const ws = [at(wk(1)), at(wk(1, 2)), at(wk(2)), at(wk(2, 3)), at(wk(4)), at(wk(4, 1))];
    expect(weekStreak(ws, 2, now)).toBe(2);
  });

  it('includes the current week once the goal is met', () => {
    const ws = [at(wk(0)), at(wk(1))];
    expect(weekStreak(ws, 1, now)).toBe(2);
  });
});

describe('muscle stats', () => {
  it('counts every muscle a set trains by its share of the work', () => {
    const w = workout(1, 'bench-press', [set(80, 8), set(80, 8)]);
    const m = setsPerMuscle([w], exMap, 0);
    expect(m.chest).toBe(2);
    expect(m.triceps).toBe(1);
    expect(m.frontDelts).toBe(1);
    const sq = setsPerMuscle([workout(1, 'squat', [set(100, 5), set(100, 5), set(100, 5), set(100, 5)])], exMap, 0);
    expect(sq.quads).toBe(4);
    expect(sq.glutes).toBe(3);
    expect(sq.adductors).toBe(2);
    expect(sq.lowerBack).toBe(1);
    expect(sq.chest).toBeUndefined();
  });

  it('ignores warm-up sets', () => {
    const m = setsPerMuscle([workout(1, 'bench-press', [set(40, 10, { type: 'warmup' }), set(80, 8)])], exMap, 0);
    expect(m.chest).toBe(1);
  });

  it('maps legacy shoulder muscles of custom exercises to front and side delts', () => {
    const custom = { ...bench, id: 'c1', load: undefined, primary: ['shoulders' as never], secondary: ['triceps' as const] };
    const map = new Map(exMap).set('c1', custom);
    const m = setsPerMuscle([workout(1, 'c1', [set(30, 10)])], map, 0);
    expect(m.frontDelts).toBe(1);
    expect(m.sideDelts).toBe(1);
    expect(m.triceps).toBe(0.5);
  });

  it('marks freshly trained muscles as not recovered', () => {
    const now = Date.now();
    const w = workout(0, 'squat', [set(100, 5), set(100, 5), set(100, 5)], now);
    const r = muscleRecovery([w], exMap, w.finishedAt! + 3_600_000);
    expect(r.quads).toBeLessThan(0.1);
    expect(muscleRecovery([w], exMap, w.finishedAt! + 5 * DAY).quads).toBe(1);
  });
});

describe('nextRoutine', () => {
  const r = (id: string, folder?: string) => ({ id, name: id, folder, exercises: [], createdAt: 0 });
  const w = (routineId: string, startedAt: number) => ({ id: routineId + startedAt, name: '', startedAt, exercises: [], routineId });
  it('rotates within the folder of the last trained routine', () => {
    const routines = [r('a', 'P'), r('b', 'P'), r('x', 'Q')];
    expect(nextRoutine(routines, [w('a', 2)])?.id).toBe('b');
    expect(nextRoutine(routines, [w('b', 2), w('a', 1)])?.id).toBe('a');
    expect(nextRoutine(routines, [w('x', 2)])?.id).toBe('x');
  });
  it('falls back to the first routine', () => {
    expect(nextRoutine([r('a'), r('b')], [])?.id).toBe('a');
    expect(nextRoutine([], [])).toBeUndefined();
  });
});

describe('youtubeSearchUrl', () => {
  it('puts the equipment first and asks for form videos', () => {
    const q = (name: string) => decodeURIComponent(youtubeSearchUrl({ name }).split('search_query=')[1]);
    expect(q('Bench Press (Barbell)')).toBe('barbell bench press proper form');
    expect(q('Bench Press - Close Grip (Barbell)')).toBe('barbell bench press close grip proper form');
    expect(q('Pull Up')).toBe('pull up proper form');
  });
});
