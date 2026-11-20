import type { Exercise, ExerciseType, Workout, WorkoutSet } from '../types';
import { e1rm, isWorkingSet } from './metrics';
import { exerciseHistory, type Session } from './history';

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

/** A set heavier than any earlier working set. */
export function isWeightRecord(before: Records, set: WorkoutSet): boolean {
  return (set.weight ?? 0) > before.maxWeight;
}

export type LiveRecord = 'weight' | 'e1rm' | null;

/**
 * Is `set`, just completed, a new record? `before` are the records from earlier sessions, `doneHere` the other
 * finished working sets of the same exercise in the current workout. A heavier weight wins over a better 1RM estimate.
 */
export function liveRecord(before: Records, doneHere: WorkoutSet[], set: WorkoutSet): LiveRecord {
  const bestW = Math.max(before.maxWeight, ...doneHere.map((y) => y.weight ?? 0));
  const best1 = Math.max(before.maxE1rm, ...doneHere.map((y) => e1rm(y.weight ?? 0, y.reps ?? 0)));
  const w = set.weight ?? 0;
  if (w > bestW && w > 0) return 'weight';
  if (e1rm(w, set.reps ?? 0) > best1 + 0.01) return 'e1rm';
  return null;
}

/**
 * One comparable number per set, higher is better, used to mark a set better or worse than the same set last time.
 * Weighted lifts use the 1RM estimate (reps if no weight), assisted lifts reward reps and less assistance,
 * the rest use reps, distance or time.
 */
export function setScore(type: ExerciseType, s: Partial<WorkoutSet>): number {
  const weighted = type === 'weight_reps' || type === 'weighted_bodyweight';
  if (weighted) return e1rm(s.weight ?? 0, s.reps ?? 0) || (s.reps ?? 0);
  if (type === 'assisted_bodyweight') return (s.reps ?? 0) * 100 - (s.weight ?? 0);
  if (type === 'distance_duration') return s.distance ?? 0;
  if (type === 'duration') return s.durationSec ?? 0;
  return s.reps ?? 0;
}
