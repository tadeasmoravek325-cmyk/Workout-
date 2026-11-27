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

export type ProgressState = 'ready' | 'building' | 'hold' | 'reduce' | 'stagnation' | 'decline' | 'insufficient';
export type Confidence = 'low' | 'medium' | 'high';

export interface ProgressAdvice {
  state: ProgressState;
  /** Suggested next weight in kg (only when it differs from or restates the current one). */
  weight?: number;
  /** Rep goal for the first working set. */
  reps?: number;
  /** Rep goal for each working set in order, e.g. 11 / 10 / 9. */
  setReps?: number[];
  /** After a weight increase: the rep range to aim for at the new weight. */
  nextRange?: [number, number];
  /** Repeated sets to failure: weight is deliberately not raised. */
  intensityHigh?: boolean;
  /** Performance fell, possibly from fatigue. */
  fatigue?: boolean;
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
  both: { repMin: 5, repMax: 10, sets: 3, rir: 2 },
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
  /** Reps of every working set at that weight, in order (sets below the rep range included). */
  reps: number[];
  rirs: number[];
  /** Any working set of the session went to failure (RIR 0, or a set marked as failure). */
  failure: boolean;
  date: number;
}

/**
 * The working weight of a session: the heaviest weight that reached the bottom of the rep range (the heaviest overall if
 * none did). `reps` are all working sets at that weight, so a set that fell below the range is still seen.
 * Same idea as the best set in the trend: what was really lifted, not an estimate.
 */
export function topWork(s: Session, repMin = 1): TopWork | null {
  const work = s.sets.filter((x) => isLoggedWorkingSet(x) && (x.reps ?? 0) > 0);
  if (!work.length) return null;
  const inRange = work.filter((x) => (x.reps ?? 0) >= repMin);
  const weight = Math.max(...(inRange.length ? inRange : work).map((x) => x.weight ?? 0));
  const at = work.filter((x) => (x.weight ?? 0) === weight);
  return {
    weight,
    reps: at.map((x) => x.reps ?? 0),
    rirs: at.map((x) => rirOf(x.rpe)).filter((v): v is number => v !== undefined),
    failure: work.some((x) => x.type === 'failure' || rirOf(x.rpe) === 0),
    date: s.date,
  };
}

const MIN_SESSIONS = 1;
const REP_TYPES = ['weight_reps', 'weighted_bodyweight', 'assisted_bodyweight', 'reps_only'];
const fmtBest = (b: BestSet) => (b.weight > 0 ? `${b.weight} kg × ${b.reps}` : `${b.reps} reps`);

/**
 * Evaluates one weighted exercise. Only `weight_reps` style lifts are supported; others return `insufficient`.
 * `ctx.priorSets` is the work already done today on the same muscles: sessions are compared with sessions done in the
 * same position (first work for the muscle, or after other work for it) when there are enough of them.
 */
export function evaluateExercise(ex: Exercise, sessions: Session[], target: ExerciseTarget, ctx: { priorSets?: number } = {}): ProgressAdvice {
  const base: ProgressAdvice = { state: 'insufficient', confidence: 'low', reasons: [], warnings: [], sessionsUsed: 0 };
  if (!REP_TYPES.includes(ex.type)) return { ...base, reasons: [t('Progression advice covers exercises counted in reps.')] };
  // Bodyweight lifts can have no added weight; assisted lifts progress by needing less help.
  const zeroOk = ex.type !== 'weight_reps';
  const assisted = ex.type === 'assisted_bodyweight';
  const repsOnly = ex.type === 'reps_only';

  const slot = slotOf(ctx.priorSets);
  const all = sessions.map((s) => ({ s, top: topWork(s, target.repMin) })).filter((x): x is { s: Session; top: TopWork } => x.top !== null && (x.top.weight > 0 || zeroOk));
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
  const prev = tops[1];
  const hasRir = last.rirs.length > 0;
  const targetRir = target.rir ?? 2;
  const inc = target.increment ?? weightIncrement(ex);
  // Reps-only lifts have no load to name.
  const W = (w: number) => (repsOnly ? t('the same load') : `${w} kg`);
  let confidence = confidenceOf(tops.length, hasRir);
  if (mixed) confidence = confidence === 'high' ? 'medium' : 'low';
  const out: ProgressAdvice = { ...base, sessionsUsed: tops.length, confidence };
  const warnings = out.warnings;
  if (!hasRir) warnings.push(t('RIR was not logged, so the advice is less certain.'));
  if (mixed) warnings.push(t('Earlier sessions were done in a different position in the workout, so they compare less well.'));

  // Rep goal for each working set: from last time's reps, kept inside the range, always one entry per target set.
  const perSet = (f: (r: number, i: number) => number): number[] => {
    const base = last.reps.slice(0, Math.max(target.sets, 1));
    while (base.length < target.sets) base.push(last.reps[last.reps.length - 1]);
    return base.map(f);
  };
  const keep = (): number[] => perSet((r) => r);
  const plus = (): number[] => perSet((r) => Math.min(target.repMax, Math.max(target.repMin, r + 1)));
  const asText = (a: number[]) => a.join(' / ');
  const answer = (state: ProgressState, weight: number | undefined, setReps: number[], reasons: string[], extra: Partial<ProgressAdvice> = {}): ProgressAdvice => ({
    ...out,
    state,
    weight: repsOnly ? undefined : weight,
    reps: setReps[0],
    setReps,
    reasons,
    ...extra,
  });

  // Assisted lifts get better with a lower number, which the trend does not model, so they are judged set by set only.
  const trend = assisted ? analyzeTrend([]) : analyzeTrend(trendPoints(sessions, target.repMin, { zeroWeight: zeroOk }), { slot });
  const where =
    trend.mixed || !trend.slot
      ? ''
      : trend.slot === 'fresh'
        ? t('Compared with sessions where you did it before other work for this muscle.')
        : t('Compared with sessions where you did it after other work for this muscle.');
  const topReached = last.reps.length >= target.sets && last.reps.every((r) => r >= target.repMax);
  const weakest = Math.min(...last.reps);
  const minRir = hasRir ? Math.min(...last.rirs) : undefined;

  // Situation C (part): the best set got worse in three sessions in a row.
  if (trend.state === 'decline' && trend.recentBest && trend.baselineBest) {
    return answer('decline', last.weight, keep(), [
      t('Your best set got worse in 3 sessions in a row ({from} → {to}).', { from: fmtBest(trend.baselineBest), to: fmtBest(trend.recentBest) }),
      t('Possible factors: fatigue, sleep or recovery, a change in plan or exercise order. The data alone cannot say which.'),
      ...(where ? [where] : []),
    ], { fatigue: true });
  }
  if (trend.state === 'stagnation' && !topReached) {
    return answer('stagnation', last.weight, keep(), [
      t('No better set than before in the last {n} sessions (over {d} days). Best: {best}.', { n: TREND.recent, d: Math.round(trend.spanDays), best: trend.recentBest ? fmtBest(trend.recentBest) : '–' }),
      t('A single weak session does not count. This is repeated exposure without progress.'),
      ...(where ? [where] : []),
    ]);
  }

  // Situation D: repeated sets to failure. The weight is deliberately not raised.
  const failures = tops.slice(0, 3).filter((x) => x.failure).length;
  if (failures >= 2) {
    warnings.push(t('High training intensity: {n} of your last {m} sessions went to failure.', { n: failures, m: Math.min(3, tops.length) }));
    return answer('hold', last.weight, keep(), [
      t('You reached failure in {n} of the last {m} sessions. Keep {w} for now and stop one or two reps short of failure.', { n: failures, m: Math.min(3, tops.length), w: W(last.weight) }),
      t('Check recovery first: sleep, food, and how hard the other workouts for this muscle were.'),
    ], { intensityHigh: true });
  }

  // Situation C: below the minimum reps, or a clear drop since last time. Never raised automatically.
  const lowNow = weakest < target.repMin;
  const lowBefore = !!prev && prev.weight === last.weight && Math.min(...prev.reps) < target.repMin;
  if (lowNow && lowBefore && repsOnly) {
    // No load to lower: use an easier variation, then build back up.
    const reps = perSet(() => Math.min(target.repMax, target.repMin + 1));
    return answer('reduce', undefined, reps, [
      t('Below {min} reps in two sessions in a row. Use an easier variation or an assisted version and aim for {reps}.', { min: target.repMin, reps: asText(reps) }),
      t('Possible fatigue or too hard for now. Check sleep and recovery.'),
    ], { fatigue: true });
  }
  if (lowNow && lowBefore) {
    // Lighter load; for assisted lifts that means more help.
    const lighter = assisted ? last.weight + inc : Math.max(0, last.weight - inc);
    const reps = perSet(() => Math.min(target.repMax, target.repMin + 1));
    return answer('reduce', lighter, reps, [
      t('Below {min} reps at {w} kg in two sessions in a row. Try {lighter} kg and aim for {reps}.', { min: target.repMin, w: last.weight, lighter, reps: asText(reps) }),
      t('Possible fatigue or too much load for now. Check sleep and recovery.'),
    ], { fatigue: true });
  }
  const dropped = !!prev && prev.weight === last.weight && last.reps.reduce((a, b) => a + b, 0) < 0.8 * prev.reps.reduce((a, b) => a + b, 0);
  if (lowNow || dropped) {
    const reps = lowNow ? plus() : keep();
    if (dropped) warnings.push(t('Total reps fell clearly since last time. Possible fatigue.'));
    return answer('hold', last.weight, reps, [
      lowNow
        ? t('Weakest set was {n} reps, below the {min} rep target. Stay at {w} and aim for {reps}.', { n: weakest, min: target.repMin, w: W(last.weight), reps: asText(reps) })
        : t('Reps dropped clearly since last time. Stay at {w} and aim for {reps}.', { w: W(last.weight), reps: asText(reps) }),
    ], { fatigue: true });
  }

  // Situation B: top of the range on every set, with the target reserve. Add load and go back down the range.
  if (topReached) {
    if (minRir !== undefined && minRir < targetRir) {
      return answer('hold', last.weight, keep(), [
        t('All sets reached {n} reps, but with less in reserve than your target (RIR {r}, target {target}). Repeat {w} and finish with the target reserve before adding weight.', { n: target.repMax, r: minRir, target: targetRir, w: W(last.weight) }),
      ]);
    }
    // Three or more reps beyond the target reserve: the weight was easy, take a double step.
    const easy = minRir !== undefined && minRir >= Math.max(3, targetRir + 1);
    const step = inc * (easy ? 2 : 1);
    const range: [number, number] = [target.repMin, Math.min(target.repMax, target.repMin + 2)];
    if (repsOnly) {
      // No load to add: make it harder yourself (weight, a slower tempo, a harder variation) and start the range again.
      return answer('ready', undefined, perSet(() => range[0]), [
        t('All {sets} sets reached {n} reps. Make it harder (add weight or a harder variation) and aim for {a}–{b} reps.', { sets: last.reps.length, n: target.repMax, a: range[0], b: range[1] }),
      ], { nextRange: range });
    }
    if (assisted) {
      const less = Math.max(0, last.weight - step);
      return answer('ready', less, perSet(() => range[0]), [
        t('All {sets} sets reached {n} reps with {w} kg of assistance. Use {less} kg and aim for {a}–{b} reps.', { sets: last.reps.length, n: target.repMax, w: last.weight, less, a: range[0], b: range[1] }),
      ], { nextRange: range });
    }
    return answer('ready', last.weight + step, perSet(() => range[0]), [
      t('All {sets} sets reached {n} reps at {w} kg{rir}. Add {inc} kg and aim for {a}–{b} reps.', {
        sets: last.reps.length,
        n: target.repMax,
        w: last.weight,
        rir: minRir !== undefined ? ` with RIR ${minRir} or more` : '',
        inc: step,
        a: range[0],
        b: range[1],
      }),
    ], { nextRange: range });
  }

  // Situation A: not at the top on every set. Same weight, one more rep on each set.
  const reps = plus();
  return answer('building', last.weight, reps, [t('Stay at {w} and aim for {reps}. Add {what} once every set reaches {max}.', { w: W(last.weight), what: repsOnly ? t('difficulty') : t('weight'), reps: asText(reps), max: target.repMax })]);
}
