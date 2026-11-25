import type { Exercise, WorkoutSet, Workout } from '../types';
import { priorTargetSets } from './muscles';

export interface Session {
  workoutId: string;
  workoutName: string;
  date: number;
  sets: WorkoutSet[];
  /** Working sets done earlier in that workout on the same main muscles. Only known when the catalogue is passed. */
  priorSets?: number;
}

/**
 * All finished sessions of an exercise, newest first. Only completed sets are included.
 * With the exercise catalogue each session also records how much work for the same muscle came before it
 * in that workout, so sessions done first and sessions done after the bench press can be told apart.
 */
export function exerciseHistory(workouts: Workout[], exerciseId: string, exMap?: Map<string, Exercise>): Session[] {
  const out: Session[] = [];
  const ex = exMap?.get(exerciseId);
  for (const w of workouts) {
    w.exercises.forEach((we, index) => {
      if (we.exerciseId !== exerciseId) return;
      const sets = we.sets.filter((s) => s.done);
      if (!sets.length) return;
      const session: Session = { workoutId: w.id, workoutName: w.name, date: w.startedAt, sets };
      if (ex && exMap) session.priorSets = priorTargetSets(ex, w, index, exMap);
      out.push(session);
    });
  }
  return out.sort((a, b) => b.date - a.date);
}
