import { computeRecords, exerciseHistory, isWorkingSet, setsPerMuscle, suggestNext, workoutVolume } from '../calc';
import { BUILTIN_EXERCISES } from '../../data/exercises';
import { evaluateExercise, targetFor } from '../../core/progress/engine';
import { overloadOverview } from '../overload';
import type { Exercise, Workout } from '../../types';

/** Numbers describing a dataset, used before and after a refactor to prove nothing moved by accident. */
export function computeReference(data: { workouts?: Workout[]; customExercises?: Exercise[] }) {
  const workouts = data.workouts ?? [];
  const exMap = new Map([...BUILTIN_EXERCISES, ...(data.customExercises ?? [])].map((e) => [e.id, e]));
  const done = workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets.filter((s) => s.done)));
  const warm = done.filter((s) => !isWorkingSet(s));
  let volumeNow = 0;
  let volumeNoWarmup = 0;
  for (const w of workouts) {
    volumeNow += workoutVolume(w, exMap);
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (ex && (ex.type === 'assisted_bodyweight' || ex.type === 'duration' || ex.type === 'distance_duration')) continue;
      for (const s of we.sets) if (s.done && isWorkingSet(s)) volumeNoWarmup += (s.weight ?? 0) * (s.reps ?? 0);
    }
  }
  const ids = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))].sort();
  const perExercise = Object.fromEntries(
    ids.map((id) => {
      const sessions = exerciseHistory(workouts, id);
      const r = computeRecords(sessions);
      const ex = exMap.get(id);
      const advice = ex ? evaluateExercise(ex, sessions, targetFor(id, undefined, 'both')).state : 'unknown';
      return [id, { sessions: sessions.length, maxWeight: r.maxWeight, maxE1rm: Math.round(r.maxE1rm * 100) / 100, maxReps: r.maxReps, engine: advice }];
    }),
  );
  const sets = setsPerMuscle(workouts, exMap, 0);
  // Fixed clock (the day after the last workout) so the numbers do not drift with today's date.
  const now = Math.max(0, ...workouts.map((w) => w.startedAt)) + 86_400_000;
  const suggestKinds = Object.fromEntries(
    ids.flatMap((id) => {
      const ex = exMap.get(id);
      return ex ? [[id, suggestNext(ex, exerciseHistory(workouts, id), undefined, now)?.kind ?? 'none']] : [];
    }),
  );
  return {
    workouts: workouts.length,
    exercisesUsed: ids.length,
    unknownExercises: ids.filter((id) => !exMap.has(id)).length,
    doneSets: done.length,
    warmupSets: warm.length,
    volumeKgNow: Math.round(volumeNow),
    volumeKgWithoutWarmups: Math.round(volumeNoWarmup),
    setsPerMuscle: Object.fromEntries(Object.entries(sets).map(([m, v]) => [m, Math.round((v as number) * 10) / 10])),
    suggestKinds,
    overloadStates: Object.fromEntries(overloadOverview(workouts, exMap).map((r) => [r.exercise.id, r.state])),
    perExercise,
  };
}
