import type { Exercise, Muscle, Workout } from '../types';
import { muscleLoad } from '../data/exercises';
import { countWorkingSets } from './metrics';

/**
 * Fractional hard sets per muscle: every working set adds the exercise's load for each muscle
 * (prime mover 1, synergists 0.25–0.75). Warm-ups are ignored.
 */
export function setsPerMuscle(workouts: Workout[], exMap: Map<string, Exercise>, since: number): Record<Muscle, number> {
  const out = {} as Record<Muscle, number>;
  for (const w of workouts) {
    if (w.startedAt < since) continue;
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      const n = countWorkingSets(we.sets);
      if (!n) continue;
      for (const [m, w] of Object.entries(muscleLoad(ex)) as [Muscle, number][]) out[m] = (out[m] ?? 0) + n * w;
    }
  }
  return out;
}

/**
 * Fractional working sets done earlier in the same workout on the main muscles (load 0.75 or more) of the exercise
 * at position `index`. Tells whether the lift was done fresh or after other work for the same muscle, for example
 * incline press first versus after the bench press.
 */
export function priorTargetSets(ex: Exercise, w: Workout, index: number, exMap: Map<string, Exercise>): number {
  const mine = muscleLoad(ex);
  const targets = (Object.keys(mine) as Muscle[]).filter((m) => (mine[m] ?? 0) >= 0.75);
  if (!targets.length) return 0;
  let total = 0;
  for (let i = 0; i < index; i++) {
    const other = exMap.get(w.exercises[i].exerciseId);
    if (!other) continue;
    const load = muscleLoad(other);
    const share = Math.max(...targets.map((m) => load[m] ?? 0));
    total += countWorkingSets(w.exercises[i].sets) * share;
  }
  return total;
}
