import type { WorkoutSet, Workout } from '../types';

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
