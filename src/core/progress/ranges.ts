import type { Exercise, ExerciseTarget, Focus, Phase } from '../../types';
import { muscleLoad } from '../../data/exercises';
import { DEFAULT_TARGETS } from './engine';

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

export type ExerciseKind = 'heavy' | 'compound' | 'isolation';

/**
 * Heavy: barbell multi-joint lift. Compound: other multi-joint lift. Isolation: one main muscle.
 * Multi-joint is read from the muscle loads: three or more muscles carry at least half the load (forearms do not
 * count, they only grip), or two muscles carry at least three quarters, or it is a leg exercise with two big muscles.
 */
export function exerciseKind(ex: Exercise): ExerciseKind {
  const load = muscleLoad(ex);
  const loads = (Object.entries(load) as [string, number][]).filter(([m]) => m !== 'forearms').map(([, v]) => v);
  const half = loads.filter((v) => v >= 0.5).length;
  const strong = loads.filter((v) => v >= 0.75).length;
  const multi = half >= 3 || strong >= 2 || (half >= 2 && ex.bodyPart === 'legs');
  if (!multi) return 'isolation';
  return ex.equipment === 'barbell' ? 'heavy' : 'compound';
}

const BASE: Record<Focus, Record<ExerciseKind, [number, number]>> = {
  strength: { heavy: [3, 6], compound: [5, 8], isolation: [8, 12] },
  both: { heavy: [4, 8], compound: [6, 10], isolation: [8, 12] },
  hypertrophy: { heavy: [6, 10], compound: [8, 12], isolation: [10, 15] },
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
