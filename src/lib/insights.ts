import type { Exercise, Muscle, Workout } from '../types';
import { exerciseHistory, setsPerMuscle } from './calc';
import { analyzeTrend, trendPoints } from '../core/progress/trend';
import { MUSCLE_LABELS } from '../data/exercises';
import { t } from '../i18n';

export interface Insight {
  kind: 'low' | 'high' | 'stall';
  text: string;
}

const DAY = 86_400_000;
/** ~10 weighted sets per muscle per week is the minimum for reliable growth (Schoenfeld 2017); returns shrink past ~20. */
export const WEEKLY_MIN = 10;
export const WEEKLY_MAX = 20;

/**
 * Plain-language coaching notes from the last weeks of training. Muscles are only flagged when you have trained
 * them in the past four weeks, so nobody gets nagged about a muscle they skip on purpose. Plateau detection is a
 * heuristic, not a published threshold.
 */
export function coachInsights(workouts: Workout[], exMap: Map<string, Exercise>, now = Date.now()): Insight[] {
  const out: Insight[] = [];
  if (workouts.length < 3) return out;

  const week = setsPerMuscle(workouts, exMap, now - 7 * DAY);
  const month = setsPerMuscle(workouts, exMap, now - 28 * DAY);
  const firstAt = Math.min(...workouts.map((w) => w.startedAt));
  if (now - firstAt >= 7 * DAY) {
    const entries = (Object.entries(month) as [Muscle, number][]).filter(([, v]) => v / 4 >= 6);
    const low = entries
      .map(([m]) => [m, week[m] ?? 0] as const)
      .filter(([, v]) => v < WEEKLY_MIN)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
    for (const [m, v] of low)
      out.push({ kind: 'low', text: t('{muscle}: {n} sets in the last 7 days. About {min} or more a week is where growth is reliable.', { muscle: MUSCLE_LABELS[m], n: Math.round(v), min: WEEKLY_MIN }) });
    const high = (Object.entries(week) as [Muscle, number][]).filter(([, v]) => v > WEEKLY_MAX).sort((a, b) => b[1] - a[1])[0];
    if (high) out.push({ kind: 'high', text: t('{muscle}: {n} sets in 7 days. Gains flatten above roughly {max}, so you can hold here.', { muscle: MUSCLE_LABELS[high[0]], n: Math.round(high[1]), max: WEEKLY_MAX }) });
  }

  // Plateau: judged by the one shared trend definition.
  const ids = new Set(workouts.filter((w) => w.startedAt > now - 42 * DAY).flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  for (const id of ids) {
    const ex = exMap.get(id);
    if (!ex || ex.type !== 'weight_reps') continue;
    if (analyzeTrend(trendPoints(exerciseHistory(workouts, id))).state === 'stagnation') {
      out.push({ kind: 'stall', text: t('{name}: no new best in your last 3 sessions. Try adding a rep before adding weight, or take an easier week.', { name: ex.name }) });
      break;
    }
  }
  return out.slice(0, 3);
}
