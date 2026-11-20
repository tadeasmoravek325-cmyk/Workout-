import type { Exercise, ExerciseTarget, Focus } from '../../types';
import { weightIncrement } from './increment';
import { analyzeTrend, TREND, trendPoints } from './trend';
import { e1rm, e1rmReliable, isLoggedWorkingSet } from '../metrics';
import type { Session } from '../history';
import { t } from '../../i18n';

/**
 * Progression engine. Pure functions over an exercise's history; nothing here writes to the workout.
 * The result is advice the user confirms, never an automatic change.
 *
 * Method: double progression. Stay at a weight until every working set reaches the top of the rep range,
 * then add the smallest sensible load and restart at the bottom of the range. RIR comes from the existing
 * RPE field (RIR = 10 − RPE). When it was not logged the engine does not guess it and lowers its confidence.
 */

export type ProgressState = 'ready' | 'building' | 'hold' | 'stagnation' | 'decline' | 'insufficient';
export type Confidence = 'low' | 'medium' | 'high';

export interface ProgressAdvice {
  state: ProgressState;
  /** Suggested next weight in kg (only when it differs from or restates the current one). */
  weight?: number;
  /** Rep goal for the first working set. */
  reps?: number;
  confidence: Confidence;
  /** Plain-language reasons shown to the user. */
  reasons: string[];
  /** Caveats, e.g. missing RIR. */
  warnings: string[];
  /** How many logged sessions the verdict rests on. */
  sessionsUsed: number;
}

export const DEFAULT_TARGETS: Record<Focus, Omit<ExerciseTarget, 'focus'>> = {
  strength: { repMin: 3, repMax: 6, sets: 4, rir: 2 },
  hypertrophy: { repMin: 8, repMax: 12, sets: 3, rir: 2 },
  both: { repMin: 6, repMax: 10, sets: 3, rir: 2 },
};

export function targetFor(exerciseId: string, targets: Record<string, ExerciseTarget> | undefined, focus: Focus = 'both'): ExerciseTarget {
  return { ...DEFAULT_TARGETS[focus], focus, ...(targets?.[exerciseId] ?? {}) };
}

/** Reps in reserve from a logged RPE, or undefined when RPE was not entered. */
export function rirOf(rpe: number | undefined): number | undefined {
  return typeof rpe === 'number' && rpe >= 1 && rpe <= 10 ? Math.max(0, 10 - rpe) : undefined;
}

interface TopWork {
  weight: number;
  reps: number[];
  rirs: number[];
  best1rm: number;
  date: number;
}

/** The working sets at the heaviest working weight of a session. */
export function topWork(s: Session): TopWork | null {
  const work = s.sets.filter((x) => isLoggedWorkingSet(x) && (x.reps ?? 0) > 0);
  if (!work.length) return null;
  const weight = Math.max(...work.map((x) => x.weight ?? 0));
  const at = work.filter((x) => (x.weight ?? 0) === weight);
  return {
    weight,
    reps: at.map((x) => x.reps ?? 0),
    rirs: at.map((x) => rirOf(x.rpe)).filter((v): v is number => v !== undefined),
    best1rm: Math.max(...work.map((x) => e1rm(x.weight ?? 0, x.reps ?? 0))),
    date: s.date,
  };
}

const MIN_SESSIONS = 2;

/** Evaluates one weighted exercise. Only `weight_reps` style lifts are supported; others return `insufficient`. */
export function evaluateExercise(ex: Exercise, sessions: Session[], target: ExerciseTarget): ProgressAdvice {
  const base: ProgressAdvice = { state: 'insufficient', confidence: 'low', reasons: [], warnings: [], sessionsUsed: 0 };
  if (ex.type !== 'weight_reps') return { ...base, reasons: [t('Progression advice covers weight and reps exercises.')] };

  const tops = sessions.map(topWork).filter((x): x is TopWork => x !== null && x.weight > 0);
  if (tops.length < MIN_SESSIONS) {
    return { ...base, sessionsUsed: tops.length, reasons: [t('Needs at least {n} logged sessions of this exercise.', { n: MIN_SESSIONS })] };
  }
  const last = tops[0];
  const out: ProgressAdvice = { ...base, sessionsUsed: tops.length, confidence: 'medium' };
  const warnings = out.warnings;
  const hasRir = last.rirs.length > 0;
  if (!hasRir) warnings.push(t('RIR was not logged, so the advice is less certain.'));
  if (last.reps.some((r) => !e1rmReliable(r))) warnings.push(t('Sets above 12 reps make the 1RM estimate unreliable.'));

  const trend = analyzeTrend(trendPoints(sessions));
  if (trend.state === 'decline') {
    return {
      ...out,
      state: 'decline',
      weight: last.weight,
      reps: Math.min(...last.reps),
      confidence: hasRir ? 'medium' : 'low',
      reasons: [
        t('Estimated 1RM fell in 3 sessions in a row ({from} → {to} kg).', { from: Math.round(trend.baselineBest), to: Math.round(trend.recentBest) }),
        t('Possible factors: fatigue, sleep or recovery, a change in plan or exercise order. The data alone cannot say which.'),
      ],
    };
  }
  const reachedTop = last.reps.every((r) => r >= target.repMax) && last.reps.length >= target.sets;
  if (trend.state === 'stagnation' && !reachedTop) {
    return {
      ...out,
      state: 'stagnation',
      weight: last.weight,
      reps: Math.min(...last.reps),
      reasons: [
        t('No new best estimated 1RM in the last {n} sessions (over {d} days).', { n: TREND.recent, d: Math.round(trend.spanDays) }),
        t('A single weak session does not count. This is repeated exposure without progress.'),
      ],
    };
  }

  const topReached = last.reps.length >= target.sets && last.reps.every((r) => r >= target.repMax);
  const minRir = hasRir ? Math.min(...last.rirs) : undefined;
  if (topReached) {
    if (minRir !== undefined && minRir < 1) {
      return {
        ...out,
        state: 'hold',
        weight: last.weight,
        reps: target.repMax,
        reasons: [t('All sets reached {n} reps, but the last set was at or near failure (RIR {r}). Repeat once with a rep in reserve before adding weight.', { n: target.repMax, r: minRir })],
      };
    }
    const inc = weightIncrement(ex);
    return {
      ...out,
      state: 'ready',
      weight: last.weight + inc,
      reps: target.repMin,
      confidence: hasRir ? 'high' : 'medium',
      reasons: [t('All {sets} sets reached {n} reps at {w} kg. Add {inc} kg and restart at {min} reps.', { sets: last.reps.length, n: target.repMax, w: last.weight, inc, min: target.repMin })],
    };
  }

  const weakest = Math.min(...last.reps);
  if (weakest < target.repMin) {
    return {
      ...out,
      state: 'hold',
      weight: last.weight,
      reps: target.repMin,
      reasons: [t('Weakest set was {n} reps, below the {min} rep target. Stay at {w} kg until every set reaches {min}.', { n: weakest, min: target.repMin, w: last.weight })],
    };
  }
  return {
    ...out,
    state: 'building',
    weight: last.weight,
    reps: Math.min(target.repMax, weakest + 1),
    reasons: [t('Stay at {w} kg and aim for {n} reps on every set. Add weight once all sets reach {max}.', { w: last.weight, n: Math.min(target.repMax, weakest + 1), max: target.repMax })],
  };
}
