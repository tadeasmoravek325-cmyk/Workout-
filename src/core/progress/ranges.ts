import type { Exercise, ExerciseTarget, Focus, Phase } from '../../types';
import { muscleLoad } from '../../data/exercises';
import { DEFAULT_TARGETS, defaultFocus } from './engine';

/**
 * Suggested rep range, sets and reps in reserve for an exercise, from the exercise type, the training focus and the
 * current body goal (cutting, maintaining, bulking). Pure and deterministic. The result is advice that the user applies
 * explicitly; nothing is written automatically.
 *
 * What the evidence supports and what it does not (see docs/analytics.md):
 * - Muscle growth is similar across a wide range of loads when sets are taken close to failure; strength is better
 *   with heavier loads. So the choice of rep range is mostly about strength priority, joint and fatigue cost.
 * - In an energy deficit, lean mass gains are impaired while strength is mostly kept, and training intensity (load)
 *   is the main thing that keeps muscle, while volume can drop. So when cutting the ranges move towards heavier loads.
 * - Training to failure is not clearly better than stopping a few reps short.
 * The numbers below are practical heuristics built on that, not published prescriptions.
 */

export type ExerciseKind = 'heavy' | 'compound' | 'isolation' | 'small';

/** Exercises the muscle loads classify wrongly. */
const KIND_OVERRIDE: Record<string, ExerciseKind> = {
  'decline-bench-press': 'heavy',
};

/** Muscles that are trained with light loads and higher reps: shoulders' side and rear, calves, forearms, core. */
const SMALL_MUSCLES = new Set(['sideDelts', 'rearDelts', 'calves', 'forearms', 'abs', 'obliques']);

/**
 * What kind of exercise it is, because that decides how heavy it makes sense to train it.
 * - heavy: barbell multi-joint lift (squat, bench, deadlift, row, press, hip thrust)
 * - compound: other multi-joint lift (dumbbell, machine, cable presses, rows, pulldowns, leg press, lunges)
 * - isolation: one joint, a big muscle (curls, extensions, leg curl, flyes, pushdowns, hip abduction)
 * - small: one joint, a small or light-load muscle (side and rear delts, calves, forearms, core), done with higher reps
 * Multi-joint is read from the muscle loads: three or more muscles at half load or more (forearms do not count, they
 * only grip), or two at three quarters, or a leg exercise with two big muscles.
 */
export function exerciseKind(ex: Exercise): ExerciseKind {
  const override = KIND_OVERRIDE[ex.id];
  if (override) return override;
  const load = muscleLoad(ex);
  const entries = Object.entries(load) as [string, number][];
  const loads = entries.filter(([m]) => m !== 'forearms').map(([, v]) => v);
  const half = loads.filter((v) => v >= 0.5).length;
  const strong = loads.filter((v) => v >= 0.75).length;
  const multi = half >= 3 || strong >= 2 || (half >= 2 && ex.bodyPart === 'legs');
  if (multi) return ex.equipment === 'barbell' ? 'heavy' : 'compound';
  const main = entries.reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0])[0];
  return SMALL_MUSCLES.has(main) ? 'small' : 'isolation';
}

export const KIND_LABEL: Record<ExerciseKind, string> = {
  heavy: 'Heavy barbell lift',
  compound: 'Compound lift',
  isolation: 'Isolation',
  small: 'Small-muscle isolation',
};

const BASE: Record<Focus, Record<ExerciseKind, [number, number]>> = {
  strength: { heavy: [3, 6], compound: [5, 8], isolation: [8, 12], small: [8, 12] },
  both: { heavy: [4, 8], compound: [6, 10], isolation: [8, 12], small: [10, 15] },
  hypertrophy: { heavy: [6, 10], compound: [8, 12], isolation: [10, 15], small: [12, 20] },
};

/** When cutting, load is kept high and reps are not chased upwards: the whole range moves down. */
const CUT_SHIFT = 2;
const MIN_REPS = 3;

export interface RangeSuggestion {
  target: ExerciseTarget;
  kind: ExerciseKind;
  /** One short sentence for the user. */
  reason: string;
}

export function suggestTarget(ex: Exercise, ctx: { focus: Focus; phase?: Phase; plannedSets?: number }): RangeSuggestion {
  const phase: Phase = ctx.phase ?? 'maintain';
  const kind = exerciseKind(ex);
  let [lo, hi] = BASE[ctx.focus][kind];
  if (phase === 'cut') {
    lo = Math.max(MIN_REPS, lo - CUT_SHIFT);
    hi = Math.max(lo + 2, hi - CUT_SHIFT);
  }
  // Number of sets follows the user's own plan when there is one; otherwise the usual default.
  const sets = ctx.plannedSets && ctx.plannedSets > 0 ? ctx.plannedSets : DEFAULT_TARGETS[ctx.focus].sets;
  // Close to failure either way; a little further from it on heavy barbell lifts and when cutting (recovery).
  const rir = phase === 'bulk' && kind !== 'heavy' ? 1 : 2;
  const why: Record<Phase, string> = {
    bulk: 'Bulking: full range, close to failure, add weight when every set reaches the top.',
    maintain: 'Maintaining: moderate range; keep the load and the habit, small steady progress is enough.',
    cut: 'Cutting: heavier, lower reps to keep the load that protects muscle. Holding your weights counts as progress.',
  };
  return { target: { repMin: lo, repMax: hi, sets, rir, focus: ctx.focus }, kind, reason: why[phase] };
}

/**
 * The target the app actually uses for an exercise: your own range if you set one, otherwise the range that follows
 * your training focus and body goal for this kind of exercise. Changing the focus or the body goal therefore changes
 * the advice at once, without applying anything.
 */
export function targetForExercise(ex: Exercise, settings: { exerciseTargets?: Record<string, ExerciseTarget>; trainingFocus?: Focus; goal: string; phase?: Phase }): ExerciseTarget {
  const own = settings.exerciseTargets?.[ex.id];
  const base = suggestTarget(ex, { focus: defaultFocus(settings), phase: settings.phase }).target;
  return own ? { ...base, ...own } : base;
}
