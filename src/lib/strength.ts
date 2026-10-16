import type { Sex, Workout } from '../types';
import type { IconName } from '../components/Icon';
import { computeRecords, exerciseHistory } from './calc';

export interface Tier {
  id: string;
  name: string;
  color: string;
  icon: IconName;
}

export const TIERS: Tier[] = [
  { id: 'none', name: 'Unranked', color: '#6b6b6b', icon: 'circle' },
  { id: 'bronze', name: 'Bronze', color: '#c27a3d', icon: 'medal' },
  { id: 'silver', name: 'Silver', color: '#c4c4c4', icon: 'medal' },
  { id: 'gold', name: 'Gold', color: '#f2b233', icon: 'medal' },
  { id: 'platinum', name: 'Platinum', color: '#e8e4da', icon: 'shield' },
  { id: 'diamond', name: 'Diamond', color: '#ff7a1a', icon: 'gem' },
];

/**
 * Multiples of body weight for an estimated 1RM (male standards, roughly beginner → elite).
 * Pull-ups use reps instead.
 */
const STANDARDS: Record<string, { label: string; m: number[]; upper: boolean; reps?: boolean }> = {
  'bench-press': { label: 'Bench press', m: [0.5, 0.75, 1.0, 1.5, 2.0], upper: true },
  squat: { label: 'Squat', m: [0.75, 1.25, 1.5, 2.25, 2.75], upper: false },
  deadlift: { label: 'Deadlift', m: [1.0, 1.5, 2.0, 2.5, 3.0], upper: false },
  ohp: { label: 'Overhead press', m: [0.35, 0.55, 0.75, 1.0, 1.25], upper: true },
  'barbell-row': { label: 'Barbell row', m: [0.5, 0.75, 1.0, 1.5, 1.75], upper: true },
  'pull-up': { label: 'Pull-ups', m: [1, 5, 10, 18, 25], upper: true, reps: true },
};

export const RANKED_EXERCISES = Object.keys(STANDARDS);

export interface StrengthRank {
  exerciseId: string;
  label: string;
  tier: Tier;
  next?: Tier;
  /** 0..1 progress towards the next tier. */
  progress: number;
  /** Value needed for the next tier (kg or reps). */
  nextTarget?: number;
  value: number;
  byReps: boolean;
}

export function strengthRank(exerciseId: string, value: number, bodyweight: number, sex: Sex = 'm'): StrengthRank | null {
  const std = STANDARDS[exerciseId];
  if (!std) return null;
  const female = sex === 'f';
  const factor = std.reps ? (female ? 0.4 : 1) : female ? (std.upper ? 0.6 : 0.7) : 1;
  const thresholds = std.m.map((x) => (std.reps ? Math.max(1, Math.round(x * factor)) : x * factor * bodyweight));
  let idx = 0;
  while (idx < thresholds.length && value >= thresholds[idx]) idx++;
  const tier = TIERS[idx];
  const next = TIERS[idx + 1];
  const lo = idx === 0 ? 0 : thresholds[idx - 1];
  const hi = thresholds[idx];
  return {
    exerciseId,
    label: std.label,
    tier,
    next,
    progress: hi === undefined ? 1 : Math.max(0, Math.min(1, (value - lo) / (hi - lo))),
    nextTarget: hi,
    value,
    byReps: !!std.reps,
  };
}

/** Ranks for all ranked lifts the user has performed. */
export function strengthRanks(workouts: Workout[], bodyweight: number | undefined, sex?: Sex): StrengthRank[] {
  if (!bodyweight) return [];
  const out: StrengthRank[] = [];
  for (const id of RANKED_EXERCISES) {
    const rec = computeRecords(exerciseHistory(workouts, id));
    const value = STANDARDS[id].reps ? rec.maxReps : rec.maxE1rm;
    if (!value) continue;
    const r = strengthRank(id, value, bodyweight, sex);
    if (r) out.push(r);
  }
  return out;
}
