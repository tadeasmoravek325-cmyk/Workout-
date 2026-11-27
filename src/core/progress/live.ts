import type { ExerciseTarget, WorkoutSet } from '../../types';
import { isLoggedWorkingSet } from '../metrics';
import { rirOf } from './engine';
import { t } from '../../i18n';

export type RepStatus = 'below' | 'in' | 'top';

/** Where one set's reps sit against the target range. */
export function repStatus(reps: number, target: ExerciseTarget): RepStatus {
  return reps < target.repMin ? 'below' : reps >= target.repMax ? 'top' : 'in';
}

export interface SetReview {
  setId: string;
  status: RepStatus;
  /** Reps in reserve from RPE, when it was logged. */
  rir?: number;
  failure: boolean;
}

export interface SetsReview {
  sets: SetReview[];
  /** One sentence about the exercise so far, or null while there is nothing to say. */
  message: string | null;
  /** Every target set is done and at the top of the range. */
  topOnEverySet: boolean;
}

/**
 * Reviews the working sets done so far in this workout against the exercise's target: each set (below the range, inside
 * it, at the top; reserve against the target; failure) and the exercise as a whole. Display only, nothing is written.
 */
export function reviewSets(sets: WorkoutSet[], target: ExerciseTarget): SetsReview {
  const done = sets.filter((s) => isLoggedWorkingSet(s) && (s.reps ?? 0) > 0);
  const reviews: SetReview[] = done.map((s) => ({
    setId: s.id,
    status: repStatus(s.reps ?? 0, target),
    rir: rirOf(s.rpe),
    failure: s.type === 'failure' || rirOf(s.rpe) === 0,
  }));
  const none: SetsReview = { sets: reviews, message: null, topOnEverySet: false };
  if (!done.length) return none;

  const targetRir = target.rir ?? 2;
  const belowAt = reviews.findIndex((r) => r.status === 'below');
  if (belowAt >= 0) return { ...none, message: t('Set {n} is below {min} reps. Do not add weight; check fatigue.', { n: belowAt + 1, min: target.repMin }) };
  const failedAt = reviews.findIndex((r) => r.failure);
  if (failedAt >= 0) return { ...none, message: t('Set {n} went to failure. Keep the weight and stop a rep or two short next time.', { n: failedAt + 1 }) };

  const complete = done.length >= target.sets;
  const allTop = reviews.every((r) => r.status === 'top');
  const rirs = reviews.map((r) => r.rir).filter((v): v is number => v !== undefined);
  const reserveOk = rirs.length === 0 || Math.min(...rirs) >= targetRir;
  if (complete && allTop) {
    return {
      ...none,
      topOnEverySet: reserveOk,
      message: reserveOk
        ? t('Top of the range on every set. Add weight next time.')
        : t('Top of the range, but with less in reserve than RIR {r}. Repeat the weight.', { r: targetRir }),
    };
  }
  const left = target.sets - done.length;
  return { ...none, message: left > 0 ? t('In range so far. {n} more to go.', { n: left }) : t('In range. Add reps on each set until all reach {max}.', { max: target.repMax }) };
}
