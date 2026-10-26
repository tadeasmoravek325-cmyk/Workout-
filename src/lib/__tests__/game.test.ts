import { describe, expect, it } from 'vitest';
import { computeProgress, goalForWeek, streakInfo, XP } from '../gamification';
import { logGoalChange } from '../../store/store';
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

describe('computeProgress', () => {
  it('awards XP per workout and set, and a PR bonus after a baseline', () => {
    const t = Date.now() - 20 * DAY;
    const a = wk(t, 'bench-press', [set(80, 8), set(80, 8)]);
    const b = wk(t + 3 * DAY, 'bench-press', [set(85, 8)]);
    const p = computeProgress([b, a], exMap, 99);
    expect(p.perWorkout.get(a.id)!.prExercises).toEqual([]);
    expect(p.perWorkout.get(b.id)!.prExercises).toEqual(['bench-press']);
    expect(p.perWorkout.get(a.id)!.xp).toBe(50 + 2 * 3);
    expect(p.perWorkout.get(b.id)!.xp).toBe(50 + 3 + 25);
    expect(p.perWorkout.get(b.id)!.breakdown).toEqual({ workout: 50, sets: 3, prs: 25 });
    expect(p.totalPrs).toBe(1);
  });

  it('caps sets per workout and workouts per day, and ignores empty sets', () => {
    const t = Date.now() - 20 * DAY;
    const many = wk(t, 'bench-press', Array.from({ length: 50 }, () => set(60, 10)));
    expect(computeProgress([many], exMap, 99).perWorkout.get(many.id)!.breakdown.sets).toBe(XP.setCap * XP.set);
    const noon = new Date(2026, 5, 10, 9).getTime();
    const day = [1, 2, 3].map((h) => wk(noon + h * 3_600_000));
    const p = computeProgress(day, exMap, 99);
    expect(day.map((w) => p.perWorkout.get(w.id)!.breakdown.workout)).toEqual([50, 50, 0]);
    const empty = wk(t, 'bench-press', [{ id: 'x', type: 'normal', done: true }]);
    expect(computeProgress([empty], exMap, 99).perWorkout.get(empty.id)!.xp).toBe(0);
  });

  it('adds the weekly goal bonus and a growing streak bonus', () => {
    const now = new Date(2026, 9, 15, 12).getTime();
    const w1 = wk(startOfWeek(now) - 7 * DAY + DAY);
    const w2 = wk(startOfWeek(now) + DAY);
    const p = computeProgress([w1, w2], exMap, 1, now);
    expect(p.weekXp.get(startOfWeek(w1.startedAt))).toBe(p.perWorkout.get(w1.id)!.xp + 100 + 10);
    expect(p.weekXp.get(startOfWeek(w2.startedAt))).toBe(p.perWorkout.get(w2.id)!.xp + 100 + 20);
    expect(p.goalWeeks.size).toBe(2);
  });
});

describe('weekly goal history', () => {
  it('judges past weeks by the goal they had', () => {
    const now = new Date(2026, 9, 15, 12).getTime();
    const log = logGoalChange(undefined, 2, 4, now);
    expect(goalForWeek({ current: 4, log }, startOfWeek(now) - 7 * DAY)).toBe(2);
    expect(goalForWeek({ current: 4, log }, startOfWeek(now))).toBe(4);
    // Changing twice in one week keeps a single entry for it.
    const again = logGoalChange(log, 4, 5, now);
    expect(again).toHaveLength(2);
    expect(goalForWeek({ current: 5, log: again }, startOfWeek(now))).toBe(5);
  });

  it('does not take back last week’s bonus when the goal is raised', () => {
    const now = new Date(2026, 9, 15, 12).getTime();
    const last = wk(startOfWeek(now) - 5 * DAY);
    const before = computeProgress([last], exMap, 1, now).totalXp;
    const after = computeProgress([last], exMap, { current: 5, log: logGoalChange(undefined, 1, 5, now) }, now).totalXp;
    expect(after).toBe(before);
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

  it('ignores workouts without a real working set', () => {
    const empty = wk(week(1), 'bench-press', [{ id: 'e', type: 'warmup', weight: 40, reps: 10, done: true }]);
    expect(streakInfo([empty], 1, now).streak).toBe(0);
    expect(streakInfo([empty, wk(week(1))], 2, now).streak).toBe(0);
  });

  it('breaks without a freeze', () => {
    const ws = [5, 4, 2, 1].map((a) => wk(week(a)));
    expect(streakInfo(ws, 1, now).streak).toBe(2);
  });
});
