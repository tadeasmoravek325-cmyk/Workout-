import type { Exercise, Workout } from '../types';
import { exerciseHistory, type Session } from '../core/history';
import { analyzeTrend, trendPoints, type Slot, type TrendPoint } from '../core/progress/trend';

export type OverloadState = 'up' | 'flat' | 'down' | 'new';

/** One session of a lift: the best set actually lifted, its volume and where in the workout it was done. */
export type OverloadPoint = TrendPoint;

/** Oldest first, the last `n` sessions. `repMin` is the bottom of the exercise's rep range. */
export function overloadSeries(sessions: Session[], n = 11, repMin = 1, zeroWeight = false): OverloadPoint[] {
  return trendPoints(sessions.slice(0, n), repMin, { zeroWeight }).reverse();
}

const asTrend = (series: OverloadPoint[]): TrendPoint[] => [...series].reverse();

export interface OverloadResult {
  state: OverloadState;
  /** Recent best set minus the baseline best set: kg, and reps at the same weight. */
  delta: { weight: number; reps: number } | null;
  /** Only the work volume went up. */
  moreWork: boolean;
  slot?: Slot;
  /** Too few sessions in the same position, so sessions from both positions were compared. */
  mixed: boolean;
}

/**
 * State of a lift from the single trend definition in `core/progress/trend`: the best set actually lifted,
 * recent sessions against the sessions before, compared within the same position in the workout.
 */
export function overloadState(series: OverloadPoint[], slot?: Slot): OverloadResult {
  const t = analyzeTrend(asTrend(series), { slot });
  const state: OverloadState = t.state === 'insufficient' ? 'new' : t.state === 'improving' ? 'up' : t.state === 'stagnation' ? 'flat' : 'down';
  return { state, delta: t.delta, moreWork: t.moreWork, slot: t.slot, mixed: t.mixed };
}

export interface OverloadRow extends OverloadResult {
  exercise: Exercise;
}

const ORDER: Record<OverloadState, number> = { up: 0, flat: 1, down: 2, new: 3 };

/** Weighted lifts with enough history, progressing ones first. `repMinOf` gives each exercise's bottom rep. */
export function overloadOverview(workouts: Workout[], exMap: Map<string, Exercise>, repMinOf: (id: string) => number = () => 1): OverloadRow[] {
  const ids = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  const rows: OverloadRow[] = [];
  for (const id of ids) {
    const ex = exMap.get(id);
    if (!ex || ex.type !== 'weight_reps') continue;
    const r = overloadState(overloadSeries(exerciseHistory(workouts, id, exMap), 11, repMinOf(id)));
    if (r.state !== 'new') rows.push({ ...r, exercise: ex });
  }
  return rows.sort((a, b) => ORDER[a.state] - ORDER[b.state] || (b.delta?.weight ?? 0) - (a.delta?.weight ?? 0) || (b.delta?.reps ?? 0) - (a.delta?.reps ?? 0));
}
