import type { Exercise, ExerciseTarget, Focus, Muscle, Routine, Settings, Workout, WorkoutSet } from '../types';
import { muscleLoad } from '../data/exercises';
import { t, tn } from '../i18n';
export * from '../core/metrics';
export * from '../core/history';
export * from '../core/records';
export * from '../core/muscles';
export * from '../core/progress/increment';
import { weightIncrement } from '../core/progress/increment';
import { analyzeTrend, slotOf, trendPoints } from '../core/progress/trend';
import { evaluateExercise, targetFor, type Confidence, type ProgressState } from '../core/progress/engine';
import { isWorkingSet } from '../core/metrics';
import type { Session } from '../core/history';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function workoutDurationMs(w: Workout, now = Date.now()): number {
  return (w.finishedAt ?? now) - w.startedAt;
}

/**
 * Fills empty weight, reps, time and distance of new sets from the exercise's last session, set by set
 * (warm-ups with warm-ups, working sets with working sets; extra sets copy the last one). Values already
 * on a set are kept unless `override` is set (a routine's saved numbers give way to what was actually
 * lifted last). The same exercise starts from where you left off in any workout, not just the one it was
 * done in.
 */
export function prefillSets(sets: WorkoutSet[], last: Session | undefined, override = false): WorkoutSet[] {
  if (!last) return sets;
  const seen: Record<string, number> = {};
  return sets.map((s) => {
    const same = last.sets.filter((x) => x.type === s.type);
    const n = (seen[s.type] = (seen[s.type] ?? -1) + 1);
    const src = same[n] ?? same[same.length - 1];
    if (!src || s.done) return s;
    return {
      ...s,
      weight: override ? (src.weight ?? s.weight) : (s.weight ?? src.weight),
      reps: override ? (src.reps ?? s.reps) : (s.reps ?? src.reps),
      durationSec: override ? (src.durationSec ?? s.durationSec) : (s.durationSec ?? src.durationSec),
      distance: override ? (src.distance ?? s.distance) : (s.distance ?? src.distance),
    };
  });
}

/**
 * Minutes left in a workout: the sets still to do times the time a set takes. The pace starts as the median of
 * your last finished workouts (rest included, about 2.5 minutes with no history) and moves towards today's own
 * pace as sets are completed, so a slow or fast day corrects the estimate. Today's pace counts for half after
 * six sets and for more the longer the workout goes.
 */
export function minutesLeft(active: Workout, history: Workout[], now = Date.now()): number | null {
  const all = active.exercises.flatMap((e) => e.sets);
  const left = all.filter((s) => !s.done).length;
  if (!left) return null;
  const per: number[] = [];
  for (const w of history) {
    if (!w.finishedAt) continue;
    const sets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    const sec = (w.finishedAt - w.startedAt) / 1000 / Math.max(1, sets);
    if (sets >= 5 && sec >= 45 && sec <= 420) per.push(sec);
    if (per.length >= 8) break;
  }
  per.sort((a, b) => a - b);
  let sec = per.length ? per[Math.floor(per.length / 2)] : 150;

  const done = all.filter((s) => s.done);
  if (done.length >= 3) {
    // Up to the last tick, so the rest you are in right now does not stretch the average.
    const last = Math.max(0, ...done.map((s) => s.completedAt ?? 0)) || now;
    const today = (last - active.startedAt) / 1000 / done.length;
    if (today >= 20 && today <= 420) {
      const w = done.length / (done.length + 6);
      sec = w * today + (1 - w) * sec;
    }
  }
  return Math.max(1, Math.round((left * sec) / 60));
}

export interface PlateResult {
  perSide: number[];
  achieved: number;
  remainder: number;
}

/** Greedy plate loading for a target total weight (kg). */
export function plateCalc(targetKg: number, barKg: number, plates: number[]): PlateResult {
  const perSide: number[] = [];
  let remaining = (targetKg - barKg) / 2;
  const sorted = [...plates].sort((a, b) => b - a);
  if (remaining <= 0) return { perSide, achieved: barKg, remainder: Math.max(0, targetKg - barKg) };
  for (const p of sorted) {
    while (remaining + 1e-9 >= p) {
      perSide.push(p);
      remaining -= p;
    }
  }
  const achieved = barKg + perSide.reduce((a, b) => a + b, 0) * 2;
  return { perSide, achieved, remainder: Math.max(0, targetKg - achieved) };
}

export interface WarmupSet {
  weight: number;
  reps: number;
}

/** Suggested warm-up ramp towards a working weight (kg). */
export function warmupSets(workingKg: number, barKg = 20, step = 2.5): WarmupSet[] {
  if (workingKg <= barKg) return [];
  const scheme: [number, number][] = [
    [0, 10],
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ];
  const out: WarmupSet[] = [];
  for (const [pct, reps] of scheme) {
    const w = pct === 0 ? barKg : Math.max(barKg, roundTo(workingKg * pct, step));
    if (w >= workingKg) continue;
    if (out.length && out[out.length - 1].weight === w) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

export interface Suggestion {
  kind: 'increase' | 'repeat' | 'deload' | 'start';
  weight?: number;
  reps?: number;
  durationSec?: number;
  /** The weight last time, when the suggestion adds to it. */
  from?: number;
  reason: string;
  /** Rep goal for each working set in order, when the progression engine gave one (e.g. 11 / 10 / 9). */
  setReps?: number[];
  /** After a weight increase: the rep range to aim for at the new weight. */
  nextRange?: [number, number];
  /** Set when the progression engine produced the advice: state, how sure it is, caveats. */
  advice?: { state: ProgressState; confidence: Confidence; warnings: string[]; sessionsUsed: number; intensityHigh?: boolean; fatigue?: boolean };
}

/**
 * "Smart coach": recommends the next target for an exercise using double progression.
 * - all working sets at the top weight kept their reps and RPE was not maxed → add weight
 * - reps dropped off → repeat the weight and try to match reps
 * - three sessions in a row without improvement → deload 10 %
 */
/** Weighted working sets already done on the muscles this exercise trains. */
export interface Fatigue {
  /** In the last 72 hours before this workout. */
  recent: number;
  /** Earlier today, in this same workout. */
  session: number;
  /** How many exercises come before this one in the workout (0 = first). */
  position?: number;
  /** Training focus. Exercise order is only taken into account when strength is a goal. */
  focus?: Focus;
}

const FATIGUE_RECENT = 14;
const FATIGUE_SESSION = 8;
/** From the fourth exercise on, heavy compound lifts stop adding load and build reps instead. */
const LATE_POSITION = 3;

function isCompound(ex: Exercise): boolean {
  return Object.values(muscleLoad(ex)).filter((v) => (v ?? 0) >= 0.5).length >= 2;
}

/** Sets on the exercise's main muscles, each counted by how much of the load that muscle takes. */
export function targetSets(ex: Exercise, workouts: Workout[], exMap: Map<string, Exercise>, from = -Infinity, skipId?: string): number {
  const mine = muscleLoad(ex);
  const targets = (Object.keys(mine) as Muscle[]).filter((m) => (mine[m] ?? 0) >= 0.75);
  if (!targets.length) return 0;
  let total = 0;
  for (const w of workouts) {
    if (w.startedAt < from) continue;
    for (const we of w.exercises) {
      if (we.id === skipId) continue;
      const other = exMap.get(we.exerciseId);
      if (!other) continue;
      const load = muscleLoad(other);
      const share = Math.max(...targets.map((m) => load[m] ?? 0));
      total += we.sets.filter((s) => s.done && isWorkingSet(s)).length * share;
    }
  }
  return total;
}

/**
 * Progression target for the next session. A heavily worked muscle (lots of sets in the last
 * three days or earlier in this workout) holds its weight instead of adding more.
 */
export function suggestNext(ex: Exercise, history: Session[], fatigue?: Fatigue, now = Date.now(), target?: ExerciseTarget): Suggestion | null {
  const tgt = target ?? targetFor(ex.id, undefined, 'both');
  const s = baseSuggestion(ex, history, now, tgt, fatigue?.session);
  if (!s || !fatigue || s.kind !== 'increase') return s;
  // A planned increase is turned into "repeat the weight at the top of the range" when the muscle is already loaded.
  const hold = (reason: string): Suggestion => ({
    ...s,
    kind: 'repeat',
    weight: s.from ?? s.weight,
    reps: tgt.repMax,
    setReps: Array.from({ length: tgt.sets }, () => tgt.repMax),
    nextRange: undefined,
    reason,
  });
  if (fatigue.session >= FATIGUE_SESSION) {
    return hold(t('Already {n} hard sets for this muscle today. Keep the same weight.', { n: Math.round(fatigue.session) }));
  }
  // Order effect: strength gains are larger for lifts done early in the session (Nunes et al. 2020; Avelar 2019),
  // so a compound lift buried late in the workout keeps its load. Hypertrophy is unaffected by order,
  // so with a pure muscle focus the weight is not held back for being late in the workout.
  if (fatigue.focus !== 'hypertrophy' && fatigue.position !== undefined && fatigue.position >= LATE_POSITION && isCompound(ex)) {
    return hold(t('Exercise number {n} of the workout. Keep the weight and repeat the top reps instead of adding load.', { n: fatigue.position + 1 }));
  }
  if (fatigue.recent >= FATIGUE_RECENT) {
    return hold(t('This muscle did {n} hard sets in the last 3 days. Keep the same weight and recover.', { n: Math.round(fatigue.recent) }));
  }
  return s;
}

function baseSuggestion(ex: Exercise, history: Session[], now: number, target: ExerciseTarget, priorSets?: number): Suggestion | null {
  const last = history[0];
  if (!last) {
    // Nothing done yet: use the starting weight you set for this exercise, if any.
    if (ex.type === 'weight_reps' && target.startWeight) {
      return { kind: 'start', weight: target.startWeight, reps: target.repMin, setReps: Array.from({ length: target.sets }, () => target.repMin), reason: t('Your starting weight. Aim for {a}–{b} reps on each set.', { a: target.repMin, b: Math.min(target.repMax, target.repMin + 2) }) };
    }
    return null;
  }
  const working = last.sets.filter(isWorkingSet);
  if (!working.length) return null;

  if (ex.type === 'reps_only') {
    const best = Math.max(...working.map((s) => s.reps ?? 0));
    return { kind: 'increase', reps: best + 1, reason: tn(best, 'Last time you hit {n} rep. Go for one more.', 'Last time you hit {n} reps. Go for one more.') };
  }
  if (ex.type === 'duration') {
    const best = Math.max(...working.map((s) => s.durationSec ?? 0));
    return { kind: 'increase', durationSec: best + 5, reason: t('Add 5 seconds to your best set.') };
  }
  if (ex.type === 'distance_duration') return null;

  const top = Math.max(...working.map((s) => s.weight ?? 0));
  const topSets = working.filter((s) => (s.weight ?? 0) === top);
  const firstReps = topSets[0].reps ?? 0;
  const held = topSets.every((s) => (s.reps ?? 0) >= firstReps);
  const rpes = topSets.map((s) => s.rpe).filter((r): r is number => typeof r === 'number');
  const hardRpe = rpes.length > 0 && Math.max(...rpes) >= 9.5;
  const inc = weightIncrement(ex);
  const easy = rpes.length > 0 && Math.max(...rpes) <= 7;
  const daysOff = (now - last.date) / 86_400_000;

  // Long break: detraining is fast enough that last time's weight is no longer a fair target (heuristic thresholds).
  if (ex.type === 'weight_reps' && daysOff > 28 && top > 0) {
    return { kind: 'deload', weight: roundTo(top * 0.9, 2.5), reps: firstReps, reason: t('{n} weeks since you last did this. Restart 10% lighter.', { n: Math.round(daysOff / 7) }) };
  }
  if (ex.type === 'weight_reps' && daysOff > 14 && held && !hardRpe) {
    return { kind: 'repeat', weight: top, reps: firstReps, reason: t('{n} weeks since you last did this. Repeat the weight before adding more.', { n: Math.round(daysOff / 7) }) };
  }

  if (ex.type === 'assisted_bodyweight') {
    if (held && !hardRpe) {
      return { kind: 'increase', weight: Math.max(0, top - inc), reps: firstReps, reason: t('You nailed every set. Use less assistance.') };
    }
    return { kind: 'repeat', weight: top, reps: firstReps, reason: t('Keep the same assistance and match your reps.') };
  }

  // Stalled or sliding: the shared trend definition decides, so this agrees with the progress panel and the engine.
  const trend = analyzeTrend(trendPoints(history, target.repMin), { slot: slotOf(priorSets) }).state;
  if ((trend === 'stagnation' || trend === 'decline') && !held) {
    return {
      kind: 'deload',
      weight: roundTo(top * 0.9, 2.5),
      reps: firstReps,
      reason: t('No progress over the last sessions. Drop 10% and build back up.'),
    };
  }

  // Weighted lifts follow double progression inside the user's rep range (the progression engine).
  if (ex.type === 'weight_reps') {
    const a = evaluateExercise(ex, history, target, { priorSets });
    if (a.state !== 'insufficient' && a.weight !== undefined) {
      const advice = { state: a.state, confidence: a.confidence, warnings: a.warnings, sessionsUsed: a.sessionsUsed, intensityHigh: a.intensityHigh, fatigue: a.fatigue };
      return {
        kind: a.state === 'ready' ? 'increase' : a.state === 'reduce' ? 'deload' : 'repeat',
        weight: a.weight,
        reps: a.reps,
        setReps: a.setReps,
        nextRange: a.nextRange,
        from: a.state === 'ready' ? top : undefined,
        reason: a.reasons[0] ?? '',
        advice,
      };
    }
  }

  if (held && !hardRpe) {
    // Reported RPE 7 or less means reps were left in the tank: take a double step.
    const step = easy ? inc * 2 : inc;
    return {
      kind: 'increase',
      weight: top + step,
      from: top,
      reps: firstReps,
      reason: easy
        ? t('Last time was easy (RPE 7 or less). Add {inc} kg.', { inc: step })
        : t('Last time {sets}× {reps} reps with no drop-off. Add {inc} kg.', { sets: topSets.length, reps: firstReps, inc }),
    };
  }
  return {
    kind: 'repeat',
    weight: top,
    reps: firstReps,
    reason: hardRpe
      ? t('Last time was a grind (RPE 10). Stay at the same weight.')
      : t('Your reps dropped off. Stay at this weight and match them.'),
  };
}

export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Number of consecutive weeks (ending with the current or previous week) in which the weekly goal was met. */
export function weekStreak(workouts: Workout[], goal: number, now = Date.now()): number {
  const counts = new Map<number, number>();
  for (const w of workouts) {
    const k = startOfWeek(w.startedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let week = startOfWeek(now);
  let streak = 0;
  if ((counts.get(week) ?? 0) >= goal) streak++;
  // The current week is still in progress, so it never breaks the streak.
  week = startOfWeek(week - WEEK_MS / 2);
  while ((counts.get(week) ?? 0) >= goal) {
    streak++;
    week = startOfWeek(week - WEEK_MS / 2);
  }
  return streak;
}

const RECOVERY_HOURS: Partial<Record<Muscle, number>> = {
  quads: 72,
  hamstrings: 72,
  glutes: 72,
  lowerBack: 72,
  chest: 60,
  lats: 60,
  traps: 48,
  upperBack: 48,
  frontDelts: 48,
  sideDelts: 36,
  rearDelts: 36,
  adductors: 60,
  obliques: 36,
  biceps: 48,
  triceps: 48,
  forearms: 36,
  abs: 36,
  calves: 36,
};

/**
 * Recovery estimate 0..1 per muscle based on the last session that loaded it meaningfully
 * (load ≥ 0.5). The fatigue scales with the fractional sets.
 */
export function muscleRecovery(workouts: Workout[], exMap: Map<string, Exercise>, now = Date.now()): Partial<Record<Muscle, number>> {
  const last: Partial<Record<Muscle, { at: number; sets: number }>> = {};
  for (const w of workouts) {
    const at = w.finishedAt ?? w.startedAt;
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      const n = we.sets.filter((s) => s.done && isWorkingSet(s)).length;
      if (!n) continue;
      for (const [m, w] of Object.entries(muscleLoad(ex)) as [Muscle, number][]) {
        if (w < 0.5) continue;
        const prev = last[m];
        if (!prev || prev.at < at) last[m] = { at, sets: n * w };
        else if (prev.at === at) prev.sets += n * w;
      }
    }
  }
  const out: Partial<Record<Muscle, number>> = {};
  for (const [m, info] of Object.entries(last) as [Muscle, { at: number; sets: number }][]) {
    const base = RECOVERY_HOURS[m] ?? 48;
    // Low volume recovers faster.
    const need = base * Math.min(1, 0.5 + info.sets / 12);
    const hours = (now - info.at) / 3_600_000;
    out[m] = Math.max(0, Math.min(1, hours / need));
  }
  return out;
}

export function defaultSettings(): Settings {
  return {
    name: '',
    goal: 'muscle',
    experience: 'beginner',
    onboarded: false,
    equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight', 'band', 'other'],
    unit: 'kg',
    defaultRestSec: 120,
    autoStartRest: true,
    sound: true,
    vibrate: true,
    weeklyGoal: 3,
    barWeightKg: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25],
    theme: 'dark',
    showRpe: false,
    smartCoach: true,
  };
}

/**
 * The routine to suggest next: the one after the most recently trained routine in the same folder
 * (A → B → A …), so programs rotate on their own. Falls back to the first routine.
 */
export function nextRoutine(routines: Routine[], workouts: Workout[]): Routine | undefined {
  if (!routines.length) return undefined;
  const last = workouts.find((w) => w.routineId && routines.some((r) => r.id === w.routineId));
  if (!last) return routines[0];
  const done = routines.find((r) => r.id === last.routineId)!;
  const folder = routines.filter((r) => (r.folder ?? '') === (done.folder ?? ''));
  return folder[(folder.indexOf(done) + 1) % folder.length];
}
