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
