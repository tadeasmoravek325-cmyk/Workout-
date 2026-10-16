import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  FAMILIES,
  achievementProgressLabel,
  achievementStats,
  familyStatus,
  metalsFor,
  tierDates,
  unlockedIds,
  type AchievementStats,
} from '../achievements';
import { BUILTIN_EXERCISES } from '../../data/exercises';
import type { Workout, WorkoutSet } from '../../types';

const exMap = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
const DAY = 86_400_000;
let n = 0;
const set = (weight: number, reps: number): WorkoutSet => ({ id: String(++n), type: 'normal', weight, reps, done: true });
const wk = (startedAt: number, exerciseId = 'bench-press', sets = [set(60, 8)]): Workout => ({
  id: `w${++n}`,
  name: 'T',
  startedAt,
  finishedAt: startedAt + 3_600_000,
  exercises: [{ id: `e${n}`, exerciseId, sets }],
});

const zero: AchievementStats = {
  workouts: 0,
  totalVolumeKg: 0,
  totalSets: 0,
  totalMinutes: 0,
  bestWeekStreak: 0,
  earlyBird: false,
  nightOwl: false,
  longWorkout: false,
  benchBodyweight: false,
  squat100: false,
  deadlift140: false,
  pullups10: false,
  distinctExercises: 0,
  measurements: 0,
  earlyCount: 0,
  nightCount: 0,
  longCount: 0,
  prCount: 0,
  squatMax: 0,
  deadliftMax: 0,
  benchMax: 0,
  bodyweight: 0,
  benchRatio: 0,
  pullupMaxReps: 0,
};
const stats = (p: Partial<AchievementStats>): AchievementStats => ({ ...zero, ...p });
const family = (id: string) => FAMILIES.find((f) => f.id === id)!;
const badge = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

describe('badge catalogue', () => {
  it('has unique ids and keeps the old badge ids as tiers', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const old of ['first', 'w10', 'w50', 'w100', 'w250', 'v10t', 'v100t', 'v1000t', 's1000', 'h24', 'streak', 'early', 'night', 'long', 'bench-bw', 'squat100', 'dl140', 'pull10', 'variety', 'measure']) {
      expect(ids).toContain(old);
    }
  });

  it('orders tiers by goal and assigns metals cheapest first', () => {
    for (const f of FAMILIES) {
      const goals = f.tiers.map((t) => t.goal);
      expect([...goals].sort((a, b) => a - b)).toEqual(goals);
    }
    expect(metalsFor(4)).toEqual(['bronze', 'silver', 'gold', 'platinum']);
    expect(metalsFor(3)).toEqual(['bronze', 'silver', 'gold']);
    expect(metalsFor(1)).toEqual(['gold']);
    expect(badge('w250').metal).toBe('platinum');
    expect(badge('pr150').metal).toBe('gold');
    expect(badge('variety50').metal).toBe('gold');
  });

  it('titles tiers with Roman numerals', () => {
    expect(badge('w10').title).toBe('Regular I');
    expect(badge('w50').title).toBe('Regular II');
    expect(badge('w250').title).toBe('Regular IV');
    expect(badge('first').title).toBe('First step');
    expect(badge('w50').description).toBe('Finish 50 workouts.');
    expect(badge('early').description).toBe('Start a workout before 7 am.');
    expect(badge('v1000t').description).toBe('Lift 1,000 tonnes in total.');
  });
});

describe('tier progress', () => {
  it('reports the reached tier and progress to the next one', () => {
    const st = familyStatus(family('workouts'), stats({ workouts: 37 }));
    expect(st.reached).toBe(0);
    expect(st.current?.id).toBe('w10');
    expect(st.next?.id).toBe('w50');
    expect(st.progress).toBeCloseTo(37 / 50);
    expect(st.label).toBe('37 / 50 workouts');
  });

  it('starts locked and ends complete', () => {
    const none = familyStatus(family('streak'), stats({ bestWeekStreak: 2 }));
    expect(none.reached).toBe(-1);
    expect(none.current).toBeUndefined();
    expect(none.next?.id).toBe('streak');
    expect(none.progress).toBeCloseTo(0.5);

    const all = familyStatus(family('streak'), stats({ bestWeekStreak: 60 }));
    expect(all.reached).toBe(3);
    expect(all.next).toBeUndefined();
    expect(all.progress).toBe(1);
    expect(all.label).toBe('52 / 52 weeks in a row');
  });

  it('unlocks every tier whose goal is met', () => {
    const ids = unlockedIds(stats({ workouts: 100, totalVolumeKg: 120_000 }));
    expect(ids.has('first')).toBe(true);
    expect(ids.has('w10')).toBe(true);
    expect(ids.has('w100')).toBe(true);
    expect(ids.has('w250')).toBe(false);
    expect(ids.has('v100t')).toBe(true);
    expect(ids.has('v1000t')).toBe(false);
  });

  it('finds badges newly earned by one more workout, like the workout summary does', () => {
    const before = unlockedIds(stats({ workouts: 49 }));
    const after = unlockedIds(stats({ workouts: 50 }));
    const fresh = ACHIEVEMENTS.filter((a) => after.has(a.id) && !before.has(a.id));
    expect(fresh.map((a) => a.title)).toEqual(['Regular II']);
  });

  it('formats progress labels per family', () => {
    const s = stats({ totalVolumeKg: 6_240, benchRatio: 0.826, totalMinutes: 615 });
    expect(achievementProgressLabel(badge('v10t'), s)).toBe('6.2 / 10 t');
    expect(achievementProgressLabel(badge('bench-bw'), { ...s, bodyweight: 80 })).toBe('0.82 / 1× bodyweight');
    expect(achievementProgressLabel(badge('bench-bw'), s)).toBe('Log your bodyweight to track this');
    expect(achievementProgressLabel(badge('h24'), s)).toBe('10 / 24 hours');
  });
});

describe('stats from history', () => {
  const start = new Date(2026, 0, 5, 18).getTime();
  const workouts = Array.from({ length: 12 }, (_, i) => wk(start + i * 3 * DAY, 'bench-press', [set(60 + i * 2.5, 8)]))
    .concat([wk(new Date(2026, 1, 20, 6).getTime(), 'squat', [set(100, 5)])])
    .sort((a, b) => b.startedAt - a.startedAt);

  it('counts early workouts, records and lifts', () => {
    const s = achievementStats(workouts, exMap, []);
    expect(s.workouts).toBe(13);
    expect(s.earlyCount).toBe(1);
    expect(s.earlyBird).toBe(true);
    expect(s.squatMax).toBe(100);
    expect(s.squat100).toBe(true);
    // first bench session is the baseline, the 11 heavier ones are records
    expect(s.prCount).toBe(11);
    expect(unlockedIds(s).has('pr10')).toBe(true);
  });

  it('caches repeated calls with the same arrays', () => {
    const m: never[] = [];
    expect(achievementStats(workouts, exMap, m)).toBe(achievementStats(workouts, exMap, m));
  });

  it('dates each tier by replaying history', () => {
    const dates = tierDates(family('workouts'), workouts, exMap, []);
    const chrono = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
    expect(dates[0]).toBe(chrono[9].startedAt);
    expect(dates[1]).toBeUndefined();
  });
});
