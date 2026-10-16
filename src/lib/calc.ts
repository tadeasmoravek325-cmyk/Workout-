import type { Exercise, Muscle, Settings, Workout, WorkoutSet } from '../types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Estimated one-rep max (Epley). Unreliable above ~12 reps, so it is capped. */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 15) / 30);
}

/** Weight that should be liftable for the given number of reps, based on a 1RM. */
export function weightForReps(oneRm: number, reps: number): number {
  if (reps <= 1) return oneRm;
  return oneRm / (1 + reps / 30);
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function isWorkingSet(s: WorkoutSet): boolean {
  return s.type !== 'warmup';
}

export function setVolume(s: WorkoutSet, ex?: Exercise): number {
  if (!s.done) return 0;
  if (ex && (ex.type === 'assisted_bodyweight' || ex.type === 'duration' || ex.type === 'distance_duration')) return 0;
  return (s.weight ?? 0) * (s.reps ?? 0);
}

export function workoutVolume(w: Workout, exMap: Map<string, Exercise>): number {
  let total = 0;
  for (const we of w.exercises) {
    const ex = exMap.get(we.exerciseId);
    for (const s of we.sets) total += setVolume(s, ex);
  }
  return total;
}

export function doneSetCount(w: Workout): number {
  return w.exercises.reduce((n, we) => n + we.sets.filter((s) => s.done).length, 0);
}

export function workoutDurationMs(w: Workout): number {
  return (w.finishedAt ?? Date.now()) - w.startedAt;
}

export interface Session {
  workoutId: string;
  workoutName: string;
  date: number;
  sets: WorkoutSet[];
}

/** All finished sessions of an exercise, newest first. Only completed sets are included. */
export function exerciseHistory(workouts: Workout[], exerciseId: string): Session[] {
  const out: Session[] = [];
  for (const w of workouts) {
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      const sets = we.sets.filter((s) => s.done);
      if (sets.length) out.push({ workoutId: w.id, workoutName: w.name, date: w.startedAt, sets });
    }
  }
  return out.sort((a, b) => b.date - a.date);
}

export interface Records {
  maxWeight: number;
  maxE1rm: number;
  maxReps: number;
  maxSetVolume: number;
  maxSessionVolume: number;
  maxDuration: number;
  maxDistance: number;
  /** Heaviest weight lifted for each rep count 1..12. */
  repMaxes: Record<number, number>;
}

export function emptyRecords(): Records {
  return {
    maxWeight: 0,
    maxE1rm: 0,
    maxReps: 0,
    maxSetVolume: 0,
    maxSessionVolume: 0,
    maxDuration: 0,
    maxDistance: 0,
    repMaxes: {},
  };
}

export function computeRecords(sessions: Session[]): Records {
  const r = emptyRecords();
  for (const session of sessions) {
    let sessionVolume = 0;
    for (const s of session.sets) {
      if (!isWorkingSet(s)) continue;
      const w = s.weight ?? 0;
      const reps = s.reps ?? 0;
      r.maxWeight = Math.max(r.maxWeight, reps > 0 ? w : 0);
      r.maxE1rm = Math.max(r.maxE1rm, e1rm(w, reps));
      r.maxReps = Math.max(r.maxReps, reps);
      r.maxSetVolume = Math.max(r.maxSetVolume, w * reps);
      r.maxDuration = Math.max(r.maxDuration, s.durationSec ?? 0);
      r.maxDistance = Math.max(r.maxDistance, s.distance ?? 0);
      if (reps >= 1 && reps <= 12 && w > 0) r.repMaxes[reps] = Math.max(r.repMaxes[reps] ?? 0, w);
      sessionVolume += w * reps;
    }
    r.maxSessionVolume = Math.max(r.maxSessionVolume, sessionVolume);
  }
  return r;
}

export type PrKind = 'weight' | 'e1rm' | 'reps' | 'volume' | 'duration' | 'distance';

export interface PrHit {
  exerciseId: string;
  kind: PrKind;
  value: number;
  previous: number;
}

/**
 * Personal records reached in `workout` compared with everything in `previous`.
 * Exercises never done before do not produce records (first session is a baseline).
 */
export function detectPRs(workout: Workout, previous: Workout[], exMap: Map<string, Exercise>): PrHit[] {
  const hits: PrHit[] = [];
  const seen = new Set<string>();
  for (const we of workout.exercises) {
    if (seen.has(we.exerciseId)) continue;
    seen.add(we.exerciseId);
    const ex = exMap.get(we.exerciseId);
    const past = exerciseHistory(previous.filter((w) => w.id !== workout.id), we.exerciseId);
    if (!past.length) continue;
    const before = computeRecords(past);
    const sets = workout.exercises.filter((x) => x.exerciseId === we.exerciseId).flatMap((x) => x.sets.filter((s) => s.done));
    const now = computeRecords([{ workoutId: workout.id, workoutName: workout.name, date: workout.startedAt, sets }]);
    const check = (kind: PrKind, a: number, b: number) => {
      if (a > 0 && a > b + 1e-9) hits.push({ exerciseId: we.exerciseId, kind, value: a, previous: b });
    };
    const type = ex?.type ?? 'weight_reps';
    if (type === 'weight_reps' || type === 'weighted_bodyweight') {
      check('weight', now.maxWeight, before.maxWeight);
      check('e1rm', now.maxE1rm, before.maxE1rm);
      check('volume', now.maxSetVolume, before.maxSetVolume);
    } else if (type === 'reps_only') {
      check('reps', now.maxReps, before.maxReps);
    } else if (type === 'duration') {
      check('duration', now.maxDuration, before.maxDuration);
    } else if (type === 'distance_duration') {
      check('distance', now.maxDistance, before.maxDistance);
    }
  }
  return hits;
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
  reason: string;
}

function weightIncrement(ex: Exercise): number {
  if (ex.equipment === 'barbell' && (ex.bodyPart === 'legs' || ex.id.includes('deadlift'))) return 5;
  if (ex.equipment === 'dumbbell') return 2;
  if (ex.equipment === 'kettlebell') return 4;
  return 2.5;
}

/**
 * "Smart coach": recommends the next target for an exercise using double progression.
 * - all working sets at the top weight kept their reps and RPE was not maxed → add weight
 * - reps dropped off → repeat the weight and try to match reps
 * - three sessions in a row without improvement → deload 10 %
 */
export function suggestNext(ex: Exercise, history: Session[]): Suggestion | null {
  const last = history[0];
  if (!last) return null;
  const working = last.sets.filter(isWorkingSet);
  if (!working.length) return null;

  if (ex.type === 'reps_only') {
    const best = Math.max(...working.map((s) => s.reps ?? 0));
    return { kind: 'increase', reps: best + 1, reason: `Minule max ${best} opakování – zkus o jedno víc.` };
  }
  if (ex.type === 'duration') {
    const best = Math.max(...working.map((s) => s.durationSec ?? 0));
    return { kind: 'increase', durationSec: best + 5, reason: 'Přidej 5 sekund k nejlepší sérii.' };
  }
  if (ex.type === 'distance_duration') return null;

  const top = Math.max(...working.map((s) => s.weight ?? 0));
  const topSets = working.filter((s) => (s.weight ?? 0) === top);
  const firstReps = topSets[0].reps ?? 0;
  const held = topSets.every((s) => (s.reps ?? 0) >= firstReps);
  const rpes = topSets.map((s) => s.rpe).filter((r): r is number => typeof r === 'number');
  const hardRpe = rpes.length > 0 && Math.max(...rpes) >= 9.5;
  const inc = weightIncrement(ex);

  if (ex.type === 'assisted_bodyweight') {
    if (held && !hardRpe) {
      return { kind: 'increase', weight: Math.max(0, top - inc), reps: firstReps, reason: 'Zvládl jsi všechny série – uber dopomoc.' };
    }
    return { kind: 'repeat', weight: top, reps: firstReps, reason: 'Zopakuj stejnou dopomoc a dorovnej opakování.' };
  }

  // Stall detection: top-weight e1RM not improving over the last 3 sessions.
  if (history.length >= 3) {
    const best = (s: Session) => Math.max(0, ...s.sets.filter(isWorkingSet).map((x) => e1rm(x.weight ?? 0, x.reps ?? 0)));
    const [a, b, c] = history.slice(0, 3).map(best);
    if (a <= b && b <= c && a > 0 && !held) {
      return {
        kind: 'deload',
        weight: roundTo(top * 0.9, 2.5),
        reps: firstReps,
        reason: 'Tři tréninky bez zlepšení. Uber 10 % a postav se zpět nahoru.',
      };
    }
  }

  if (held && !hardRpe) {
    return {
      kind: 'increase',
      weight: top + inc,
      reps: firstReps,
      reason: `Minule ${topSets.length}× ${firstReps} opak. bez poklesu – přidej ${inc} kg.`,
    };
  }
  return {
    kind: 'repeat',
    weight: top,
    reps: firstReps,
    reason: hardRpe ? 'Minule to bylo na hraně (RPE 10). Zůstaň u stejné váhy.' : 'Opakování klesala – zůstaň u váhy a dorovnej je.',
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

export function workoutsThisWeek(workouts: Workout[], now = Date.now()): number {
  const s = startOfWeek(now);
  return workouts.filter((w) => w.startedAt >= s).length;
}

/** Hard sets per muscle: primary muscle counts 1, secondary 0.5. Warm-ups are ignored. */
export function setsPerMuscle(workouts: Workout[], exMap: Map<string, Exercise>, since: number): Record<Muscle, number> {
  const out = {} as Record<Muscle, number>;
  for (const w of workouts) {
    if (w.startedAt < since) continue;
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      const n = we.sets.filter((s) => s.done && isWorkingSet(s)).length;
      if (!n) continue;
      for (const m of ex.primary) out[m] = (out[m] ?? 0) + n;
      for (const m of ex.secondary) out[m] = (out[m] ?? 0) + n * 0.5;
    }
  }
  return out;
}

const RECOVERY_HOURS: Partial<Record<Muscle, number>> = {
  quads: 72,
  hamstrings: 72,
  glutes: 72,
  lowerBack: 72,
  chest: 60,
  lats: 60,
  traps: 48,
  shoulders: 48,
  rearDelts: 36,
  biceps: 48,
  triceps: 48,
  forearms: 36,
  abs: 36,
  calves: 36,
};

/** Recovery estimate 0..1 per muscle based on the last time it was trained as a primary mover. */
export function muscleRecovery(workouts: Workout[], exMap: Map<string, Exercise>, now = Date.now()): Partial<Record<Muscle, number>> {
  const last: Partial<Record<Muscle, { at: number; sets: number }>> = {};
  for (const w of workouts) {
    const at = w.finishedAt ?? w.startedAt;
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      const n = we.sets.filter((s) => s.done && isWorkingSet(s)).length;
      if (!n) continue;
      for (const m of ex.primary) {
        const prev = last[m];
        if (!prev || prev.at < at) last[m] = { at, sets: n };
        else if (prev.at === at) prev.sets += n;
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
    unit: 'kg',
    defaultRestSec: 120,
    autoStartRest: true,
    sound: true,
    vibrate: true,
    weeklyGoal: 3,
    barWeightKg: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25],
    theme: 'dark',
    showRpe: true,
    smartCoach: true,
  };
}
