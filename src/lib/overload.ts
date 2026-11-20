import type { Exercise, Workout } from '../types';
import { e1rm, e1rmReliable, isWorkingSet, workSetVolume } from '../core/metrics';
import { exerciseHistory, type Session } from '../core/history';
import { analyzeTrend } from '../core/progress/trend';

export type OverloadState = 'up' | 'flat' | 'down' | 'new';

export interface OverloadPoint {
  date: number;
  /** Best estimated 1RM of the session. */
  e1rm: number;
  /** Working reps × weight. */
  volume: number;
  /** Total working reps. */
  reps: number;
  /** False when the best estimate comes from a set with too many reps to trust. */
  reliable: boolean;
}

const point = (s: Session): OverloadPoint => {
  const w = s.sets.filter(isWorkingSet);
  const best = w.reduce((b, x) => (e1rm(x.weight ?? 0, x.reps ?? 0) > e1rm(b.weight ?? 0, b.reps ?? 0) ? x : b), w[0]);
  return {
    date: s.date,
    e1rm: Math.max(0, ...w.map((x) => e1rm(x.weight ?? 0, x.reps ?? 0))),
    volume: w.reduce((a, x) => a + workSetVolume(x), 0),
    reps: w.reduce((a, x) => a + (x.reps ?? 0), 0),
    reliable: !best || e1rmReliable(best.reps ?? 0),
  };
};

/** Oldest first, the last `n` sessions. */
export function overloadSeries(sessions: Session[], n = 11): OverloadPoint[] {
  return sessions.slice(0, n).map(point).reverse();
}

/**
 * State of a lift, from the single trend definition in `core/progress/trend`
 * (recent best against the best of the sessions just before; stuck only when neither strength nor work rose).
 */
export function overloadState(series: OverloadPoint[]): { state: OverloadState; change: number } {
  const t = analyzeTrend([...series].reverse());
  if (t.state === 'insufficient') return { state: 'new', change: 0 };
  return { state: t.state === 'improving' ? 'up' : t.state === 'stagnation' ? 'flat' : 'down', change: t.change };
}

export interface OverloadRow {
  exercise: Exercise;
  state: OverloadState;
  change: number;
}

/** Lifts done at least 4 times, grouped by whether they are progressing. */
export function overloadOverview(workouts: Workout[], exMap: Map<string, Exercise>): OverloadRow[] {
  const ids = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  const rows: OverloadRow[] = [];
  for (const id of ids) {
    const ex = exMap.get(id);
    if (!ex || ex.type !== 'weight_reps') continue;
    const { state, change } = overloadState(overloadSeries(exerciseHistory(workouts, id)));
    if (state !== 'new') rows.push({ exercise: ex, state, change });
  }
  return rows.sort((a, b) => b.change - a.change);
}
