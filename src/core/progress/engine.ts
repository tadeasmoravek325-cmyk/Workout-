import type { Exercise, ExerciseTarget, Focus } from '../../types';
import { weightIncrement } from './increment';
import { analyzeTrend, slotOf, TREND, trendPoints, type BestSet } from './trend';
import { isLoggedWorkingSet } from '../metrics';
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

/** How sure the advice is: more logged sessions and a logged RIR raise it. Missing RIR is never guessed. */
export function confidenceOf(sessions: number, hasRir: boolean): Confidence {
  const score = (sessions >= 5 ? 1 : 0) + (hasRir ? 1 : 0);
  return score >= 2 ? 'high' : score === 1 ? 'medium' : 'low';
}

/** Rep range defaults follow the user's goal unless a training focus was chosen explicitly. */
export function defaultFocus(settings: { trainingFocus?: Focus; goal: string }): Focus {
  return settings.trainingFocus ?? (settings.goal === 'muscle' ? 'hypertrophy' : settings.goal === 'strength' ? 'strength' : 'both');
}

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
  date: number;
}

/**
 * The working sets at the heaviest weight that reached the bottom of the rep range (all working sets if none did).
 * Same idea as the best set in the trend: what was really lifted, not an estimate.
 */
export function topWork(s: Session, repMin = 1): TopWork | null {
  const work = s.sets.filter((x) => isLoggedWorkingSet(x) && (x.reps ?? 0) > 0);
  if (!work.length) return null;
  const inRange = work.filter((x) => (x.reps ?? 0) >= repMin);
  const pool = inRange.length ? inRange : work;
  const weight = Math.max(...pool.map((x) => x.weight ?? 0));
  const at = pool.filter((x) => (x.weight ?? 0) === weight);
  return {
    weight,
    reps: at.map((x) => x.reps ?? 0),
    rirs: at.map((x) => rirOf(x.rpe)).filter((v): v is number => v !== undefined),
    date: s.date,
  };
}

const MIN_SESSIONS = 2;
const fmtBest = (b: BestSet) => `${b.weight} kg × ${b.reps}`;

/**
 * Evaluates one weighted exercise. Only `weight_reps` style lifts are supported; others return `insufficient`.
 * `ctx.priorSets` is the work already done today on the same muscles: sessions are compared with sessions done in the
 * same position (first work for the muscle, or after other work for it) when there are enough of them.
 */
export function evaluateExercise(ex: Exercise, sessions: Session[], target: ExerciseTarget, ctx: { priorSets?: number } = {}): ProgressAdvice {
  const base: ProgressAdvice = { state: 'insufficient', confidence: 'low', reasons: [], warnings: [], sessionsUsed: 0 };
  if (ex.type !== 'weight_reps') return { ...base, reasons: [t('Progression advice covers weight and reps exercises.')] };

  const slot = slotOf(ctx.priorSets);
  const all = sessions.map((s) => ({ s, top: topWork(s, target.repMin) })).filter((x): x is { s: Session; top: TopWork } => x.top !== null && x.top.weight > 0);
  let pool = all;
  let mixed = false;
  if (slot) {
    const same = all.filter((x) => slotOf(x.s.priorSets) === slot);
    if (same.length >= MIN_SESSIONS) pool = same;
    else mixed = all.some((x) => slotOf(x.s.priorSets) !== undefined && slotOf(x.s.priorSets) !== slot);
  }
  const tops = pool.map((x) => x.top);
  if (tops.length < MIN_SESSIONS) {
    return { ...base, sessionsUsed: tops.length, reasons: [t('Needs at least {n} logged sessions of this exercise.', { n: MIN_SESSIONS })] };
  }
  const last = tops[0];
  const hasRir = last.rirs.length > 0;
  let confidence = confidenceOf(tops.length, hasRir);
  if (mixed) confidence = confidence === 'high' ? 'medium' : 'low';
  const out: ProgressAdvice = { ...base, sessionsUsed: tops.length, confidence };
  const warnings = out.warnings;
  if (!hasRir) warnings.push(t('RIR was not logged, so the advice is less certain.'));
  if (mixed) warnings.push(t('Earlier sessions were done in a different position in the workout, so they compare less well.'));

  const trend = analyzeTrend(trendPoints(sessions, target.repMin), { slot });
  const where =
    trend.mixed || !trend.slot
      ? ''
      : trend.slot === 'fresh'
        ? t('Compared with sessions where you did it before other work for this muscle.')
        : t('Compared with sessions where you did it after other work for this muscle.');
  if (trend.state === 'decline' && trend.recentBest && trend.baselineBest) {
    return {
      ...out,
      state: 'decline',
      weight: last.weight,
      reps: Math.min(...last.reps),
      reasons: [
        t('Your best set got worse in 3 sessions in a row ({from} → {to}).', { from: fmtBest(trend.baselineBest), to: fmtBest(trend.recentBest) }),
        t('Possible factors: fatigue, sleep or recovery, a change in plan or exercise order. The data alone cannot say which.'),
        ...(where ? [where] : []),
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
        t('No better set than before in the last {n} sessions (over {d} days). Best: {best}.', { n: TREND.recent, d: Math.round(trend.spanDays), best: trend.recentBest ? fmtBest(trend.recentBest) : '–' }),
        t('A single weak session does not count. This is repeated exposure without progress.'),
        ...(where ? [where] : []),
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
    // Three or more reps in reserve on every set: the weight was easy, take a double step.
    const easy = minRir !== undefined && minRir >= 3;
    const inc = weightIncrement(ex) * (easy ? 2 : 1);
    return {
      ...out,
      state: 'ready',
      weight: last.weight + inc,
      reps: target.repMin,
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
