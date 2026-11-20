import type { Exercise, Workout } from '../types';
import { e1rm, exerciseHistory, isWorkingSet, type Session } from './calc';

export type OverloadState = 'up' | 'flat' | 'down' | 'new';

export interface OverloadPoint {
  date: number;
  /** Best estimated 1RM of the session. */
  e1rm: number;
  /** Working reps × weight. */
  volume: number;
  /** Total working reps. */
  reps: number;
}

const point = (s: Session): OverloadPoint => {
  const w = s.sets.filter(isWorkingSet);
  return {
    date: s.date,
    e1rm: Math.max(0, ...w.map((x) => e1rm(x.weight ?? 0, x.reps ?? 0))),
    volume: w.reduce((a, x) => a + (x.weight ?? 0) * (x.reps ?? 0), 0),
    reps: w.reduce((a, x) => a + (x.reps ?? 0), 0),
  };
};

/** Oldest first, the last `n` sessions. */
export function overloadSeries(sessions: Session[], n = 8): OverloadPoint[] {
  return sessions.slice(0, n).map(point).reverse();
}

/**
 * Progressive overload counts as progress when strength (e1RM) or work done (volume) rose. Compares the average
 * of the latest two sessions with the two before them; a change under 1% is treated as flat.
 */
export function overloadState(series: OverloadPoint[]): { state: OverloadState; change: number } {
  if (series.length < 4) return { state: 'new', change: 0 };
  const avg = (a: OverloadPoint[], k: 'e1rm' | 'volume') => a.reduce((x, p) => x + p[k], 0) / a.length;
  const cur = series.slice(-2);
  const prev = series.slice(-4, -2);
  const ch = (k: 'e1rm' | 'volume') => (avg(prev, k) ? (avg(cur, k) - avg(prev, k)) / avg(prev, k) : 0);
  const best = Math.abs(ch('e1rm')) >= Math.abs(ch('volume')) ? ch('e1rm') : ch('volume');
  const up = ch('e1rm') > 0.01 || ch('volume') > 0.01;
  const down = ch('e1rm') < -0.01 && ch('volume') < -0.01;
  return { state: up ? 'up' : down ? 'down' : 'flat', change: best * 100 };
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
