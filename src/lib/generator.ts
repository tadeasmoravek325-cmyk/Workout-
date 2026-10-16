import type { Equipment, Exercise, Goal, Muscle, Routine, Workout } from '../types';
import { exerciseHistory, muscleRecovery, setsPerMuscle, suggestNext, uid } from './calc';

export type Focus = 'auto' | 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full';

export const FOCUS_LABELS: Record<Focus, string> = {
  auto: '✨ Podle regenerace',
  push: 'Tlaky',
  pull: 'Přítahy',
  legs: 'Nohy',
  upper: 'Horní polovina',
  lower: 'Dolní polovina',
  full: 'Celé tělo',
};

const FOCUS_MUSCLES: Record<Exclude<Focus, 'auto'>, Muscle[]> = {
  push: ['chest', 'shoulders', 'triceps', 'chest', 'shoulders', 'triceps'],
  pull: ['lats', 'traps', 'lats', 'biceps', 'rearDelts', 'biceps'],
  legs: ['quads', 'hamstrings', 'glutes', 'quads', 'calves', 'abs'],
  upper: ['chest', 'lats', 'shoulders', 'lats', 'triceps', 'biceps', 'rearDelts'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'lowerBack'],
  full: ['quads', 'chest', 'lats', 'hamstrings', 'shoulders', 'abs', 'biceps'],
};

export interface GenerateOptions {
  focus: Focus;
  minutes: number;
  equipment: Equipment[];
  goal: Goal;
  seed: number;
}

function rng(seed: number) {
  let x = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    x = (x * 48271) % 2147483647;
    return x / 2147483647;
  };
}

/** Picks the focus whose muscles are, on average, the most recovered. */
export function autoFocus(workouts: Workout[], exMap: Map<string, Exercise>, now = Date.now()): Exclude<Focus, 'auto'> {
  const rec = muscleRecovery(workouts, exMap, now);
  const candidates: Exclude<Focus, 'auto'>[] = ['push', 'pull', 'legs'];
  if (!workouts.length) return 'full';
  let best = candidates[0];
  let bestScore = -1;
  for (const f of candidates) {
    const ms = [...new Set(FOCUS_MUSCLES[f])];
    const score = ms.reduce((a, m) => a + (rec[m] ?? 1), 0) / ms.length;
    if (score > bestScore + 1e-6) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

function repsFor(goal: Goal, compound: boolean): number {
  switch (goal) {
    case 'strength':
      return compound ? 5 : 8;
    case 'muscle':
      return compound ? 8 : 12;
    case 'weightloss':
      return compound ? 10 : 15;
    default:
      return compound ? 10 : 12;
  }
}

export interface GeneratedWorkout {
  focus: Exclude<Focus, 'auto'>;
  routine: Routine;
}

/** Builds a workout from the exercise library for the chosen focus, time and equipment. */
export function generateWorkout(
  opts: GenerateOptions,
  all: Exercise[],
  workouts: Workout[],
  exMap: Map<string, Exercise>,
): GeneratedWorkout {
  const focus = opts.focus === 'auto' ? autoFocus(workouts, exMap) : opts.focus;
  const rand = rng(opts.seed);
  const count = Math.max(3, Math.min(8, Math.round(opts.minutes / 10)));
  const usage = new Map<string, number>();
  for (const w of workouts.slice(0, 40)) for (const e of w.exercises) usage.set(e.exerciseId, (usage.get(e.exerciseId) ?? 0) + 1);
  const weekly = setsPerMuscle(workouts, exMap, Date.now() - 7 * 86_400_000);

  // Muscles slots ordered by the focus; under-trained muscles get pulled forward a bit.
  const slots = [...FOCUS_MUSCLES[focus]];
  const pool = all.filter(
    (e) => e.bodyPart !== 'cardio' && opts.equipment.includes(e.equipment) && e.primary.length > 0 && e.type !== 'distance_duration',
  );
  const chosen: Exercise[] = [];
  const slotList = slots.length >= count ? slots.slice(0, count) : [...slots, ...slots].slice(0, count);
  slotList.sort((a, b) => {
    const ia = slots.indexOf(a);
    const ib = slots.indexOf(b);
    // Keep compound-first order, but nudge muscles with < 6 weekly sets earlier.
    return ia - ib + ((weekly[a] ?? 0) < 6 ? -0.5 : 0) - ((weekly[b] ?? 0) < 6 ? -0.5 : 0);
  });

  for (const [i, muscle] of slotList.entries()) {
    const candidates = pool
      .filter((e) => e.primary[0] === muscle || (e.primary.includes(muscle) && e.primary.length <= 2))
      .filter((e) => !chosen.some((c) => c.id === e.id))
      .map((e) => {
        const compound = e.primary.length + e.secondary.length;
        // First slots prefer big compound lifts, later slots isolation.
        let score = i < 2 ? compound * 1.5 : 4 - Math.abs(compound - 2);
        if (e.equipment === 'barbell' && i < 2) score += 2;
        score += Math.min(3, (usage.get(e.id) ?? 0) * 0.5);
        score += rand() * 2.5;
        return { e, score };
      })
      .sort((a, b) => b.score - a.score);
    if (candidates[0]) chosen.push(candidates[0].e);
  }

  const routine: Routine = {
    id: uid(),
    name: `${FOCUS_LABELS[focus]} · ${opts.minutes} min`,
    createdAt: Date.now(),
    exercises: chosen.map((ex, i) => {
      const compound = ex.primary.length + ex.secondary.length >= 3 || i < 2;
      const sets = opts.minutes >= 60 && compound ? 4 : 3;
      const hist = exerciseHistory(workouts, ex.id);
      const sug = suggestNext(ex, hist);
      const isTime = ex.type === 'duration';
      const reps = ex.type === 'reps_only' ? (sug?.reps ?? 12) : repsFor(opts.goal, compound);
      const weight = ex.type === 'weight_reps' || ex.type === 'weighted_bodyweight' ? sug?.weight : undefined;
      return {
        id: uid(),
        exerciseId: ex.id,
        restSec: compound ? (opts.goal === 'strength' ? 180 : 120) : 75,
        sets: Array.from({ length: sets }, () => ({
          type: 'normal' as const,
          reps: isTime ? undefined : reps,
          weight,
          durationSec: isTime ? (sug?.durationSec ?? 45) : undefined,
        })),
      };
    }),
  };
  return { focus, routine };
}
