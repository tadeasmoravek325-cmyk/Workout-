import type { Exercise, Measurement, Muscle, Workout } from '../types';
import type { IconName } from '../components/Icon';
import { e1rm, isWorkingSet, startOfWeek } from './calc';
import { t, tn } from '../i18n';

/* ------------------------------------------------------------------ */
/* XP and personal records in a single chronological pass              */
/* ------------------------------------------------------------------ */

export const XP = {
  workout: 50,
  set: 4,
  pr: 25,
  goalWeek: 100,
} as const;

export interface WorkoutProgress {
  xp: number;
  /** Exercise ids that reached a new record in this workout. */
  prExercises: string[];
}

export interface Progress {
  totalXp: number;
  totalPrs: number;
  perWorkout: Map<string, WorkoutProgress>;
}

interface Best {
  w: number;
  e: number;
  r: number;
  d: number;
  km: number;
}

let progressCache: { key: Workout[]; goal: number; value: Progress } | null = null;

/**
 * XP for every workout plus weekly bonuses, computed from history alone so it never drifts.
 * A record only counts once an exercise has a baseline session.
 */
export function computeProgress(workouts: Workout[], exMap: Map<string, Exercise>, weeklyGoal: number): Progress {
  if (progressCache && progressCache.key === workouts && progressCache.goal === weeklyGoal) return progressCache.value;
  const best = new Map<string, Best>();
  const perWorkout = new Map<string, WorkoutProgress>();
  let totalXp = 0;
  let totalPrs = 0;
  const ordered = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  for (const w of ordered) {
    const sessionBest = new Map<string, Best>();
    let sets = 0;
    for (const we of w.exercises) {
      const b = sessionBest.get(we.exerciseId) ?? { w: 0, e: 0, r: 0, d: 0, km: 0 };
      for (const s of we.sets) {
        if (!s.done) continue;
        sets++;
        if (!isWorkingSet(s)) continue;
        const reps = s.reps ?? 0;
        b.w = Math.max(b.w, reps > 0 ? (s.weight ?? 0) : 0);
        b.e = Math.max(b.e, e1rm(s.weight ?? 0, reps));
        b.r = Math.max(b.r, reps);
        b.d = Math.max(b.d, s.durationSec ?? 0);
        b.km = Math.max(b.km, s.distance ?? 0);
      }
      sessionBest.set(we.exerciseId, b);
    }
    const prExercises: string[] = [];
    for (const [id, now] of sessionBest) {
      const prev = best.get(id);
      const ex = exMap.get(id);
      if (prev) {
        const type = ex?.type ?? 'weight_reps';
        const better =
          type === 'weight_reps' || type === 'weighted_bodyweight'
            ? now.w > prev.w + 1e-9 || now.e > prev.e + 1e-9
            : type === 'reps_only' || type === 'assisted_bodyweight'
              ? now.r > prev.r
              : type === 'duration'
                ? now.d > prev.d
                : now.km > prev.km + 1e-9;
        if (better) prExercises.push(id);
        best.set(id, {
          w: Math.max(prev.w, now.w),
          e: Math.max(prev.e, now.e),
          r: Math.max(prev.r, now.r),
          d: Math.max(prev.d, now.d),
          km: Math.max(prev.km, now.km),
        });
      } else best.set(id, now);
    }
    const xp = XP.workout + sets * XP.set + prExercises.length * XP.pr;
    totalXp += xp;
    totalPrs += prExercises.length;
    perWorkout.set(w.id, { xp, prExercises });
  }
  // Weekly goal bonus for every finished week where the goal was met.
  const counts = new Map<number, number>();
  for (const w of workouts) {
    const k = startOfWeek(w.startedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const c of counts.values()) if (c >= weeklyGoal) totalXp += XP.goalWeek;

  const value = { totalXp, totalPrs, perWorkout };
  progressCache = { key: workouts, goal: weeklyGoal, value };
  return value;
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */

/** Cumulative XP needed to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(150 * Math.pow(level - 1, 1.6));
}

export interface LevelInfo {
  level: number;
  title: string;
  icon: IconName;
  /** XP inside the current level. */
  current: number;
  /** XP the current level spans. */
  needed: number;
  progress: number;
}

const TITLES: [number, string, IconName][] = [
  [1, 'Fresh meat', 'sprout'],
  [5, 'Gym rookie', 'graduation-cap'],
  [10, 'Regular', 'calendar-check'],
  [15, 'Iron warrior', 'swords'],
  [20, 'Strongman', 'biceps'],
  [30, 'Titan', 'mountain'],
  [40, 'Beast mode', 'flame'],
  [50, 'Gym legend', 'crown'],
];

export function levelInfo(totalXp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const [, title, icon] = [...TITLES].reverse().find(([l]) => level >= l)!;
  return {
    level,
    title: t(title),
    icon,
    current: totalXp - base,
    needed: next - base,
    progress: (totalXp - base) / (next - base),
  };
}

/* ------------------------------------------------------------------ */
/* Weekly streak with freezes                                          */
/* ------------------------------------------------------------------ */

export interface StreakInfo {
  streak: number;
  freezes: number;
  /** Week start timestamps that were saved by a freeze. */
  frozenWeeks: number[];
  best: number;
}

const DAY = 86_400_000;

function prevWeek(week: number) {
  return startOfWeek(week - 3 * DAY);
}
function nextWeek(week: number) {
  return startOfWeek(week + 10 * DAY);
}

/**
 * Weeks in a row meeting the weekly goal. Every 4 successful weeks earn a freeze (max 2)
 * that automatically saves a missed week. The current week never breaks the streak.
 */
export function streakInfo(workouts: Workout[], goal: number, now = Date.now()): StreakInfo {
  if (!workouts.length) return { streak: 0, freezes: 0, frozenWeeks: [], best: 0 };
  const counts = new Map<number, number>();
  let first = Infinity;
  for (const w of workouts) {
    const k = startOfWeek(w.startedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    first = Math.min(first, k);
  }
  const current = startOfWeek(now);
  let streak = 0;
  let best = 0;
  let freezes = 0;
  let earnedIn = 0;
  const frozenWeeks: number[] = [];
  for (let week = first; week <= current; week = nextWeek(week)) {
    const met = (counts.get(week) ?? 0) >= goal;
    if (week === current) {
      if (met) streak++;
      break;
    }
    if (met) {
      streak++;
      earnedIn++;
      if (earnedIn >= 4) {
        earnedIn = 0;
        freezes = Math.min(2, freezes + 1);
      }
    } else if (streak > 0 && freezes > 0) {
      freezes--;
      frozenWeeks.push(week);
    } else {
      streak = 0;
      earnedIn = 0;
    }
    best = Math.max(best, streak);
  }
  best = Math.max(best, streak);
  return { streak, freezes, frozenWeeks, best };
}

export { prevWeek };

/* ------------------------------------------------------------------ */
/* Weekly quests                                                       */
/* ------------------------------------------------------------------ */

export interface Quest {
  id: string;
  icon: IconName;
  title: string;
  target: number;
  value: number;
  xp: number;
  done: boolean;
}

interface QuestCtx {
  week: Workout[];
  all: Workout[];
  exMap: Map<string, Exercise>;
  goal: number;
  measurements: Measurement[];
  weekStart: number;
  prsThisWeek: number;
}

type QuestTemplate = (c: QuestCtx) => Omit<Quest, 'done'>;

const muscleSessions = (c: QuestCtx, muscles: Muscle[]) =>
  c.week.filter((w) =>
    w.exercises.some((e) => e.sets.some((s) => s.done) && c.exMap.get(e.exerciseId)?.primary.some((m) => muscles.includes(m))),
  ).length;

const doneSets = (ws: Workout[]) => ws.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter((s) => s.done && isWorkingSet(s)).length, 0), 0);

const QUESTS: QuestTemplate[] = [
  (c) => ({ id: 'sets', icon: 'repeat', title: t('Do {n} working sets', { n: 40 }), target: 40, value: doneSets(c.week), xp: 80 }),
  (c) => ({ id: 'legs', icon: 'footprints', title: t('Train legs {n}× this week', { n: 2 }), target: 2, value: muscleSessions(c, ['quads', 'hamstrings', 'glutes']), xp: 70 }),
  (c) => ({ id: 'pr', icon: 'trophy', title: t('Hit a new PR'), target: 1, value: c.prsThisWeek, xp: 90 }),
  (c) => {
    const before = new Set(c.all.filter((w) => w.startedAt < c.weekStart).flatMap((w) => w.exercises.map((e) => e.exerciseId)));
    const fresh = new Set(c.week.flatMap((w) => w.exercises.filter((e) => !before.has(e.exerciseId)).map((e) => e.exerciseId)));
    return { id: 'new', icon: 'flask', title: t('Try a new exercise'), target: 1, value: fresh.size, xp: 60 };
  },
  (c) => ({
    id: 'early',
    icon: 'sunrise',
    title: t('Early bird workout (start before 9:00)'),
    target: 1,
    value: c.week.filter((w) => new Date(w.startedAt).getHours() < 9).length,
    xp: 60,
  }),
  (c) => ({
    id: 'weigh',
    icon: 'scale',
    title: t('Log your bodyweight'),
    target: 1,
    value: c.measurements.filter((m) => m.type === 'bodyweight' && m.date >= c.weekStart).length,
    xp: 40,
  }),
  (c) => ({ id: 'back', icon: 'shield', title: t('Give your back {n} sets', { n: 12 }), target: 12, value: setsFor(c, ['lats', 'traps']), xp: 70 }),
  (c) => ({ id: 'core', icon: 'bricks', title: t('Hit your core with {n} sets', { n: 6 }), target: 6, value: setsFor(c, ['abs']), xp: 50 }),
  (c) => ({
    id: 'long',
    icon: 'hourglass',
    title: t('Train for over {n} minutes', { n: 45 }),
    target: 1,
    value: c.week.filter((w) => (w.finishedAt ?? w.startedAt) - w.startedAt >= 45 * 60_000).length,
    xp: 50,
  }),
];

function setsFor(c: QuestCtx, muscles: Muscle[]) {
  let n = 0;
  for (const w of c.week)
    for (const e of w.exercises) {
      const ex = c.exMap.get(e.exerciseId);
      if (ex?.primary.some((m) => muscles.includes(m))) n += e.sets.filter((s) => s.done && isWorkingSet(s)).length;
    }
  return n;
}

function seededPick<T>(items: T[], seed: number, count: number): T[] {
  const arr = [...items];
  let x = seed % 2147483647 || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    x = (x * 48271) % 2147483647;
    const j = x % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

/** Three quests for the week containing `now`, plus the always-on weekly goal quest. */
export function weeklyQuests(
  workouts: Workout[],
  exMap: Map<string, Exercise>,
  goal: number,
  measurements: Measurement[],
  now = Date.now(),
): Quest[] {
  const weekStart = startOfWeek(now);
  const weekEnd = nextWeek(weekStart);
  const week = workouts.filter((w) => w.startedAt >= weekStart && w.startedAt < weekEnd);
  const progress = computeProgress(workouts, exMap, goal);
  const prsThisWeek = week.reduce((a, w) => a + (progress.perWorkout.get(w.id)?.prExercises.length ?? 0), 0);
  const ctx: QuestCtx = { week, all: workouts, exMap, goal, measurements, weekStart, prsThisWeek };
  const seed = Math.floor(weekStart / (7 * DAY)) + 7919;
  const main: Omit<Quest, 'done'> = {
    id: 'goal',
    icon: 'target',
    title: tn(goal, 'Hit your weekly goal ({n} workout)', 'Hit your weekly goal ({n} workouts)'),
    target: goal,
    value: week.length,
    xp: XP.goalWeek,
  };
  return [main, ...seededPick(QUESTS, seed, 3).map((tpl) => tpl(ctx))].map((q) => ({
    ...q,
    value: Math.min(q.value, q.target),
    done: q.value >= q.target,
  }));
}

let questCache: { w: Workout[]; m: Measurement[]; goal: number; value: number } | null = null;

/** XP from completed side quests (the weekly-goal quest is already part of computeProgress). */
export function questXp(workouts: Workout[], exMap: Map<string, Exercise>, goal: number, measurements: Measurement[]): number {
  if (questCache && questCache.w === workouts && questCache.m === measurements && questCache.goal === goal) return questCache.value;
  const weeks = new Set(workouts.map((w) => startOfWeek(w.startedAt)));
  let xp = 0;
  for (const week of weeks) {
    for (const q of weeklyQuests(workouts, exMap, goal, measurements, week + 2 * DAY)) {
      if (q.id !== 'goal' && q.done) xp += q.xp;
    }
  }
  questCache = { w: workouts, m: measurements, goal, value: xp };
  return xp;
}
