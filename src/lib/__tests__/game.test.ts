import { describe, expect, it } from 'vitest';
import {
  computeProgress,
  goalForWeek,
  keepXp,
  leagueInfo,
  levelInfo,
  muscleForms,
  promoteXp,
  streakInfo,
  weeklyQuests,
  xpForLevel,
  XP,
} from '../gamification';
import { logGoalChange } from '../../store/store';
import { ageFactor, standardsFor, strengthRank } from '../strength';
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
    expect(levelInfo(xpForLevel(50)).title).toBe('Gym legend');
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

describe('leagueInfo', () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  const week = (ago: number) => startOfWeek(now) - ago * 7 * DAY;

  it('promotes above the line and demotes below the keep line', () => {
    const goal = 3;
    const xp = new Map([
      [week(3), promoteXp(0, goal)],
      [week(2), promoteXp(1, goal)],
      [week(1), keepXp(2, goal) - 10],
    ]);
    const l = leagueInfo(xp, goal, now);
    expect(l.history.map((h) => h.to)).toEqual([1, 2, 1]);
    expect(l.division).toBe(1);
  });

  it('drops one division per inactive week, never below bronze', () => {
    const xp = new Map([
      [week(6), 5000],
      [week(5), 5000],
    ]);
    expect(leagueInfo(xp, 3, now).division).toBe(0);
    expect(leagueInfo(new Map([[week(2), 5000], [week(1), 5000]]), 3, now).division).toBe(2);
  });

  it('scales the lines with the weekly goal', () => {
    expect(promoteXp(0, 5)).toBeGreaterThan(promoteXp(0, 2));
    expect(keepXp(0, 3)).toBe(0);
  });
});

describe('muscleForms', () => {
  it('levels up with lifetime sets and fades when not trained', () => {
    const now = Date.now();
    const sets = Array.from({ length: 12 }, () => set(100, 5));
    const fresh = muscleForms([wk(now - DAY, 'squat', sets)], exMap, now);
    const old = muscleForms([wk(now - 60 * DAY, 'squat', sets)], exMap, now);
    expect(fresh.quads.level).toBe(2);
    expect(old.quads.level).toBe(2);
    expect(old.quads.form).toBeLessThan(fresh.quads.form / 10);
    expect(fresh.glutes.lifetime).toBe(9);
    expect(fresh.chest.level).toBe(0);
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
  it('names the level and scales with bodyweight below proportional', () => {
    expect(strengthRank('bench-press', 80, 80, 'm')!.level).toBe('Intermediate');
    const light = standardsFor('squat', 60, 'm')![2];
    const heavy = standardsFor('squat', 120, 'm')![2];
    expect(heavy).toBeGreaterThan(light);
    expect(heavy / 120).toBeLessThan(light / 60);
  });
  it('lowers the bar for masters and teens', () => {
    expect(ageFactor(30)).toBe(1);
    expect(ageFactor(60)).toBeCloseTo(0.8);
    expect(ageFactor(17)).toBeLessThan(1);
    expect(standardsFor('deadlift', 80, 'm', 60)![2]).toBeLessThan(standardsFor('deadlift', 80, 'm', 30)![2]);
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
