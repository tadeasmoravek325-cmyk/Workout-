import type { Exercise, Workout, WorkoutSet } from '../types';
import { e1rm, isWorkingSet, startOfWeek } from './calc';

/* ------------------------------------------------------------------ */
/* Weekly goal history                                                 */
/* ------------------------------------------------------------------ */

/**
 * The weekly goal can change over time. `log` holds [weekStart, goal] pairs in ascending order,
 * so changing the goal today never rewrites XP, streaks or leagues of earlier weeks.
 */
export interface GoalPlan {
  current: number;
  log?: [number, number][];
}
export type GoalInput = number | GoalPlan;

export function goalForWeek(g: GoalInput, week: number): number {
  if (typeof g === 'number') return g;
  let goal: number | undefined;
  for (const [w, v] of g.log ?? []) {
    if (w <= week) goal = v;
    else break;
  }
  return goal ?? g.current;
}

function goalKey(g: GoalInput): string {
  return typeof g === 'number' ? String(g) : `${g.current}|${JSON.stringify(g.log ?? [])}`;
}

/* ------------------------------------------------------------------ */
/* XP and personal records in a single chronological pass              */
/* ------------------------------------------------------------------ */

export const XP = {
  workout: 50,
  set: 3,
  /** Sets beyond this in one workout earn nothing, so junk volume isn't rewarded. */
  setCap: 30,
  pr: 25,
  prCap: 3,
  /** Only the first workouts of a day earn XP. */
  workoutsPerDay: 2,
  goalWeek: 100,
  /** Bonus per week of an unbroken goal run, up to streakCap weeks. */
  streakWeek: 10,
  streakCap: 10,
} as const;

export interface XpBreakdown {
  workout: number;
  sets: number;
  prs: number;
}

export interface WorkoutProgress {
  xp: number;
  breakdown: XpBreakdown;
  /** Exercise ids that reached a new record in this workout. */
  prExercises: string[];
}

export interface Progress {
  totalXp: number;
  totalPrs: number;
  perWorkout: Map<string, WorkoutProgress>;
  /** XP earned per week (start timestamp), quests not included. */
  weekXp: Map<number, number>;
  /** Weeks where the weekly goal was met. */
  goalWeeks: Set<number>;
}

interface Best {
  w: number;
  e: number;
  r: number;
  d: number;
  km: number;
}

/** A finished working set with something actually logged. Empty ticked rows earn nothing. */
export function countsForXp(s: WorkoutSet): boolean {
  return s.done && isWorkingSet(s) && ((s.reps ?? 0) > 0 || (s.durationSec ?? 0) > 0 || (s.distance ?? 0) > 0);
}

/** A workout that counts towards the weekly goal and streak: at least one real working set. */
export function isGoalWorkout(w: Workout): boolean {
  return w.exercises.some((e) => e.sets.some(countsForXp));
}

// A few entries: the game hook and badge stats ask with different goals for the same history.
const progressCache: { key: Workout[]; ex: Map<string, Exercise>; goal: string; now: number; value: Progress }[] = [];

/**
 * XP for every workout plus weekly bonuses, computed from history alone so it never drifts.
 * A record only counts once an exercise has a baseline session.
 */
export function computeProgress(
  workouts: Workout[],
  exMap: Map<string, Exercise>,
  goal: GoalInput,
  now = Date.now(),
  cache = true,
): Progress {
  const gk = goalKey(goal);
  const nowWeek = startOfWeek(now);
  const hit = cache && progressCache.find((c) => c.key === workouts && c.ex === exMap && c.goal === gk && c.now === nowWeek);
  if (hit) return hit.value;
  const best = new Map<string, Best>();
  const perWorkout = new Map<string, WorkoutProgress>();
  const weekXp = new Map<number, number>();
  const weekCount = new Map<number, number>();
  const dayCount = new Map<string, number>();
  let totalXp = 0;
  let totalPrs = 0;
  const ordered = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  for (const w of ordered) {
    const sessionBest = new Map<string, Best>();
    let sets = 0;
    for (const we of w.exercises) {
      const b = sessionBest.get(we.exerciseId) ?? { w: 0, e: 0, r: 0, d: 0, km: 0 };
      for (const s of we.sets) {
        if (!countsForXp(s)) continue;
        sets++;
        const reps = s.reps ?? 0;
        b.w = Math.max(b.w, reps > 0 ? (s.weight ?? 0) : 0);
        b.e = Math.max(b.e, e1rm(s.weight ?? 0, reps));
        b.r = Math.max(b.r, reps);
        b.d = Math.max(b.d, s.durationSec ?? 0);
        b.km = Math.max(b.km, s.distance ?? 0);
      }
      if (b.w || b.e || b.r || b.d || b.km) sessionBest.set(we.exerciseId, b);
    }
    const prExercises: string[] = [];
    for (const [id, cur] of sessionBest) {
      const prev = best.get(id);
      const ex = exMap.get(id);
      if (prev) {
        const type = ex?.type ?? 'weight_reps';
        const better =
          type === 'weight_reps' || type === 'weighted_bodyweight'
            ? cur.w > prev.w + 1e-9 || cur.e > prev.e + 1e-9
            : type === 'reps_only' || type === 'assisted_bodyweight'
              ? cur.r > prev.r
              : type === 'duration'
                ? cur.d > prev.d
                : cur.km > prev.km + 1e-9;
        if (better) prExercises.push(id);
        best.set(id, {
          w: Math.max(prev.w, cur.w),
          e: Math.max(prev.e, cur.e),
          r: Math.max(prev.r, cur.r),
          d: Math.max(prev.d, cur.d),
          km: Math.max(prev.km, cur.km),
        });
      } else best.set(id, cur);
    }
    const day = new Date(w.startedAt).toDateString();
    const nth = dayCount.get(day) ?? 0;
    const eligible = sets > 0 && nth < XP.workoutsPerDay;
    if (sets > 0) dayCount.set(day, nth + 1);
    const breakdown: XpBreakdown = eligible
      ? { workout: XP.workout, sets: Math.min(sets, XP.setCap) * XP.set, prs: Math.min(prExercises.length, XP.prCap) * XP.pr }
      : { workout: 0, sets: 0, prs: 0 };
    const xp = breakdown.workout + breakdown.sets + breakdown.prs;
    totalXp += xp;
    totalPrs += prExercises.length;
    perWorkout.set(w.id, { xp, breakdown, prExercises });
    const wk = startOfWeek(w.startedAt);
    weekXp.set(wk, (weekXp.get(wk) ?? 0) + xp);
    if (sets > 0) weekCount.set(wk, (weekCount.get(wk) ?? 0) + 1);
  }

  // Weekly goal bonus plus a growing bonus for an unbroken run of goal weeks.
  const goalWeeks = new Set<number>();
  if (ordered.length) {
    let run = 0;
    for (let week = startOfWeek(ordered[0].startedAt); week <= nowWeek; week = nextWeek(week)) {
      const met = (weekCount.get(week) ?? 0) >= goalForWeek(goal, week);
      if (met) {
        run++;
        goalWeeks.add(week);
        const bonus = XP.goalWeek + XP.streakWeek * Math.min(run, XP.streakCap);
        totalXp += bonus;
        weekXp.set(week, (weekXp.get(week) ?? 0) + bonus);
      } else if (week !== nowWeek) run = 0;
    }
  }

  const value = { totalXp, totalPrs, perWorkout, weekXp, goalWeeks };
  if (cache) {
    progressCache.unshift({ key: workouts, ex: exMap, goal: gk, now: nowWeek, value });
    progressCache.length = Math.min(progressCache.length, 4);
  }
  return value;
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
export function streakInfo(workouts: Workout[], goal: GoalInput, now = Date.now()): StreakInfo {
  if (!workouts.length) return { streak: 0, freezes: 0, frozenWeeks: [], best: 0 };
  const counts = new Map<number, number>();
  let first = Infinity;
  for (const w of workouts) {
    if (!isGoalWorkout(w)) continue;
    const k = startOfWeek(w.startedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    first = Math.min(first, k);
  }
  if (!counts.size) return { streak: 0, freezes: 0, frozenWeeks: [], best: 0 };
  const current = startOfWeek(now);
  let streak = 0;
  let best = 0;
  let freezes = 0;
  let earnedIn = 0;
  const frozenWeeks: number[] = [];
  for (let week = first; week <= current; week = nextWeek(week)) {
    const met = (counts.get(week) ?? 0) >= goalForWeek(goal, week);
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
