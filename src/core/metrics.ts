import type { Exercise, Workout, WorkoutSet } from '../types';

/**
 * Single definitions of the basic training numbers. Everything in the app that counts sets, volume or
 * estimated 1RM goes through here, so the same workout never shows two different totals.
 * Pure functions: no React, no storage, no clock.
 */

/** Epley is only a rough guide beyond this many reps. */
export const E1RM_RELIABLE_MAX_REPS = 12;

/** Estimated one-rep max (Epley). Unreliable above ~12 reps, so it is capped. */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 15) / 30);
}

/** False when the estimate rests on a set with too many reps to be trusted. */
export function e1rmReliable(reps: number): boolean {
  return reps > 0 && reps <= E1RM_RELIABLE_MAX_REPS;
}

/** Weight that should be liftable for the given number of reps, based on a 1RM. */
export function weightForReps(oneRm: number, reps: number): number {
  if (reps <= 1) return oneRm;
  return oneRm / (1 + reps / 30);
}

/** Warm-ups are not working sets. Drop sets and sets to failure are. */
export function isWorkingSet(s: WorkoutSet): boolean {
  return s.type !== 'warmup';
}

/** A finished working set with something actually logged. Empty ticked rows do not count. */
export function isLoggedWorkingSet(s: WorkoutSet): boolean {
  return s.done && isWorkingSet(s) && ((s.reps ?? 0) > 0 || (s.durationSec ?? 0) > 0 || (s.distance ?? 0) > 0);
}

/** Number of finished working sets (warm-ups excluded). */
export function countWorkingSets(sets: WorkoutSet[]): number {
  return sets.filter((s) => s.done && isWorkingSet(s)).length;
}

/** Weight × reps of a finished set, warm-ups included. This is the general "volume" shown across the app. */
export function setVolume(s: WorkoutSet, ex?: Exercise): number {
  if (!s.done) return 0;
  if (ex && (ex.type === 'assisted_bodyweight' || ex.type === 'duration' || ex.type === 'distance_duration')) return 0;
  return (s.weight ?? 0) * (s.reps ?? 0);
}

/** Like `setVolume` but for working sets only. Used wherever progress is measured. */
export function workSetVolume(s: WorkoutSet, ex?: Exercise): number {
  return isWorkingSet(s) ? setVolume(s, ex) : 0;
}

export function workoutVolume(w: Workout, exMap: Map<string, Exercise>): number {
  let total = 0;
  for (const we of w.exercises) {
    const ex = exMap.get(we.exerciseId);
    for (const s of we.sets) total += setVolume(s, ex);
  }
  return total;
}

/** Volume of planned sets (routines): weight × reps, no finished-state check. */
export function plannedVolume(sets: { weight?: number; reps?: number }[]): number {
  return sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0);
}
