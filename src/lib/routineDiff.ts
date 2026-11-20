import type { Routine, Workout } from '../types';

export interface RoutineChanges {
  addedExercises: number;
  removedExercises: number;
  addedSets: number;
  removedSets: number;
  rest: boolean;
  weights: boolean;
}

/** What a finished workout changed compared with the routine it was started from. */
export function routineChanges(r: Routine, w: Workout): RoutineChanges {
  const c: RoutineChanges = { addedExercises: 0, removedExercises: 0, addedSets: 0, removedSets: 0, rest: false, weights: false };
  const left = [...r.exercises];
  for (const we of w.exercises) {
    const i = left.findIndex((x) => x.exerciseId === we.exerciseId);
    if (i < 0) {
      c.addedExercises++;
      c.addedSets += we.sets.length;
      continue;
    }
    const [re] = left.splice(i, 1);
    const d = we.sets.length - re.sets.length;
    if (d > 0) c.addedSets += d;
    else c.removedSets -= d;
    if ((we.restSec ?? 0) !== (re.restSec ?? 0)) c.rest = true;
    if (we.sets.some((s, k) => re.sets[k] && ((s.weight ?? 0) !== (re.sets[k].weight ?? 0) || (s.reps ?? 0) !== (re.sets[k].reps ?? 0)))) c.weights = true;
  }
  for (const re of left) {
    c.removedExercises++;
    c.removedSets += re.sets.length;
  }
  return c;
}

export const hasChanges = (c: RoutineChanges) => c.addedExercises + c.removedExercises + c.addedSets + c.removedSets > 0 || c.rest;
// Weights and reps are left out on purpose: they change every time you progress and the app prefills them from your last session anyway.
