import { describe, expect, it } from 'vitest';
import { computeProgress, levelInfo, streakInfo, weeklyQuests, xpForLevel } from '../gamification';
import { strengthRank } from '../strength';
import { generateWorkout } from '../generator';
import { startOfWeek } from '../calc';
import { BUILTIN_EXERCISES } from '../../data/exercises';
import type { Workout, WorkoutSet } from '../../types';

const exMap = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
const DAY = 86_400_000;
let n = 0;
const set = (weight: number, reps: number): WorkoutSet => ({ id: String(++n), type: 'normal', weight, reps, done: true });
const wk = (startedAt: number, exerciseId = 'bench-press', sets = [set(80, 8)]): Workout => ({
  id: `w${++n}`,
  name: 'T',
  startedAt,
  finishedAt: startedAt + 3_600_000,
  exercises: [{ id: `e${n}`, exerciseId, sets }],
});

describe('levels', () => {
  it('starts at level 1 and grows with XP', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(xpForLevel(5)).level).toBe(5);
    expect(levelInfo(xpForLevel(5) - 1).level).toBe(4);
    expect(levelInfo(xpForLevel(50)).title).toBe('Legenda');
  });
  it('reports progress inside the level', () => {
    const l = levelInfo(xpForLevel(3) + 10);
    expect(l.current).toBe(10);
    expect(l.progress).toBeGreaterThan(0);
    expect(l.progress).toBeLessThan(1);
  });
});

describe('computeProgress', () => {
  it('awards XP per workout and set, and a PR bonus after a baseline', () => {
    const t = Date.now() - 20 * DAY;
    const a = wk(t, 'bench-press', [set(80, 8), set(80, 8)]);
    const b = wk(t + 3 * DAY, 'bench-press', [set(85, 8)]);
    const p = computeProgress([b, a], exMap, 99);
    expect(p.perWorkout.get(a.id)!.prExercises).toEqual([]);
    expect(p.perWorkout.get(b.id)!.prExercises).toEqual(['bench-press']);
    expect(p.perWorkout.get(a.id)!.xp).toBe(50 + 2 * 4);
    expect(p.perWorkout.get(b.id)!.xp).toBe(50 + 4 + 25);
    expect(p.totalPrs).toBe(1);
  });
});

describe('streakInfo', () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  const week = (ago: number) => startOfWeek(now) - ago * 7 * DAY + DAY;

  it('counts consecutive weeks', () => {
    const ws = [1, 2, 3].map((a) => wk(week(a)));
    expect(streakInfo(ws, 1, now).streak).toBe(3);
  });

  it('uses an earned freeze to bridge a missed week', () => {
    // Weeks 7..4 ago met (earns a freeze), 3 ago missed, 2 and 1 met.
    const ws = [7, 6, 5, 4, 2, 1].map((a) => wk(week(a)));
    const s = streakInfo(ws, 1, now);
    expect(s.streak).toBe(6);
    expect(s.frozenWeeks).toHaveLength(1);
    expect(s.freezes).toBe(0);
  });

  it('breaks without a freeze', () => {
    const ws = [5, 4, 2, 1].map((a) => wk(week(a)));
    expect(streakInfo(ws, 1, now).streak).toBe(2);
  });
});

describe('weeklyQuests', () => {
  it('is deterministic for a week and always includes the weekly goal', () => {
    const now = new Date(2026, 9, 15, 12).getTime();
    const a = weeklyQuests([], exMap, 3, [], now);
    const b = weeklyQuests([], exMap, 3, [], now + DAY);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(a[0].id).toBe('goal');
    expect(a).toHaveLength(4);
  });
  it('tracks progress of the goal quest', () => {
    const now = new Date(2026, 9, 15, 12).getTime();
    const ws = [wk(startOfWeek(now) + DAY), wk(startOfWeek(now) + 2 * DAY)];
    const q = weeklyQuests(ws, exMap, 2, [], now)[0];
    expect(q.value).toBe(2);
    expect(q.done).toBe(true);
  });
});

describe('strengthRank', () => {
  it('ranks a 1.0× bodyweight bench as gold for men', () => {
    expect(strengthRank('bench-press', 80, 80, 'm')!.tier.id).toBe('gold');
  });
  it('uses lower thresholds for women', () => {
    expect(strengthRank('bench-press', 50, 60, 'f')!.tier.id).toBe('gold');
  });
  it('ranks pull-ups by reps', () => {
    expect(strengthRank('pull-up', 12, 80, 'm')!.tier.id).toBe('gold');
  });
});

describe('generateWorkout', () => {
  it('respects focus, duration and equipment', () => {
    const g = generateWorkout(
      { focus: 'push', minutes: 45, equipment: ['dumbbell', 'bodyweight'], goal: 'muscle', seed: 42 },
      BUILTIN_EXERCISES,
      [],
      exMap,
    );
    expect(g.routine.exercises.length).toBeGreaterThanOrEqual(3);
    const exs = g.routine.exercises.map((e) => exMap.get(e.exerciseId)!);
    expect(exs.every((e) => ['dumbbell', 'bodyweight'].includes(e.equipment))).toBe(true);
    expect(new Set(exs.map((e) => e.id)).size).toBe(exs.length);
    expect(exs.some((e) => e.primary.includes('chest'))).toBe(true);
  });

  it('auto focus avoids freshly trained muscles', () => {
    const now = Date.now();
    const legDay = wk(now - 3_600_000, 'squat', [set(100, 5), set(100, 5), set(100, 5), set(100, 5)]);
    const g = generateWorkout(
      { focus: 'auto', minutes: 60, equipment: BUILTIN_EXERCISES.map((e) => e.equipment), goal: 'strength', seed: 1 },
      BUILTIN_EXERCISES,
      [legDay],
      exMap,
    );
    expect(g.focus).not.toBe('legs');
  });
});
