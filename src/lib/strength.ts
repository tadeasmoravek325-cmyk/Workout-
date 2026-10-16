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
 * Strength standards: estimated 1RM as a multiple of bodyweight for a reference lifter
 * (80 kg men, 60 kg women) at the five common levels Beginner → Elite. The ratios follow the
 * widely published lifting standards (ExRx / Kilgore–Rippetoe tables and the large
 * user-submitted dataset behind Strength Level), rounded.
 *
 * Bodyweight is scaled allometrically (strength grows with bodyweight^(2/3), Jaric 2002), so a
 * heavy lifter doesn't need the same ratio as a light one. Masters and teens get an age factor
 * similar to the age coefficients used in powerlifting. Pull-ups use reps instead.
 */
const STANDARDS: Record<string, { label: string; m: number[]; f: number[]; reps?: boolean }> = {
  'bench-press': { label: 'Bench press', m: [0.5, 0.75, 1.0, 1.5, 2.0], f: [0.25, 0.5, 0.75, 1.0, 1.5] },
  squat: { label: 'Squat', m: [0.75, 1.25, 1.5, 2.25, 2.75], f: [0.5, 0.75, 1.25, 1.75, 2.25] },
  deadlift: { label: 'Deadlift', m: [1.0, 1.5, 2.0, 2.5, 3.0], f: [0.5, 1.0, 1.25, 1.75, 2.5] },
  ohp: { label: 'Overhead press', m: [0.35, 0.55, 0.75, 1.0, 1.35], f: [0.2, 0.35, 0.5, 0.75, 1.0] },
  'barbell-row': { label: 'Barbell row', m: [0.5, 0.75, 1.0, 1.5, 1.75], f: [0.25, 0.4, 0.65, 0.9, 1.2] },
  'pull-up': { label: 'Pull-ups', m: [1, 5, 10, 18, 25], f: [0, 1, 4, 9, 14], reps: true },
};

/** Level names shown next to the tier, matching how the standards are usually published. */
export const LEVELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

export const STANDARDS_SOURCE =
  'Based on published strength standards (ExRx / Kilgore–Rippetoe, Strength Level) for your sex, scaled to your bodyweight and age. Once Gym has enough lifters, ranks will compare you with real users of your weight.';

const REF_BW = { m: 80, f: 60 };

export function ageFromBirthYear(birthYear?: number, now = new Date()): number | undefined {
  return birthYear ? now.getFullYear() - birthYear : undefined;
}

/** 1.0 for ages 23–40; lower for teens and masters, roughly like powerlifting age coefficients. */
export function ageFactor(age?: number): number {
  if (!age || age <= 0) return 1;
  if (age < 23) return Math.max(0.8, 1 - (23 - age) * 0.025);
  if (age <= 40) return 1;
  return Math.max(0.55, 1 - (age - 40) * 0.01 - Math.max(0, age - 60) * 0.005);
}

/** Thresholds (kg, or reps for pull-ups) for the five levels. */
export function standardsFor(exerciseId: string, bodyweight: number, sex: Sex = 'm', age?: number): number[] | null {
  const std = STANDARDS[exerciseId];
  if (!std) return null;
  const key = sex === 'f' ? 'f' : 'm';
  const a = ageFactor(age);
  if (std.reps) return std[key].map((x) => Math.max(x === 0 ? 0 : 1, Math.round(x * a)));
  const ref = REF_BW[key];
  const scaled = ref * Math.pow(bodyweight / ref, 2 / 3);
  return std[key].map((x) => x * scaled * a);
}

export const RANKED_EXERCISES = Object.keys(STANDARDS);

export interface StrengthRank {
  exerciseId: string;
  label: string;
  tier: Tier;
  /** Beginner … Elite, or undefined below beginner. */
  level?: string;
  next?: Tier;
  /** 0..1 progress towards the next tier. */
  progress: number;
  /** Value needed for the next tier (kg or reps). */
  nextTarget?: number;
  value: number;
  byReps: boolean;
}

export function strengthRank(exerciseId: string, value: number, bodyweight: number, sex: Sex = 'm', age?: number): StrengthRank | null {
  const std = STANDARDS[exerciseId];
  const thresholds = standardsFor(exerciseId, bodyweight, sex, age);
  if (!std || !thresholds) return null;
  let idx = 0;
  while (idx < thresholds.length && value >= thresholds[idx] && (thresholds[idx] > 0 || value > 0)) idx++;
  const tier = TIERS[idx];
  const next = TIERS[idx + 1];
  const lo = idx === 0 ? 0 : thresholds[idx - 1];
  const hi = thresholds[idx];
  return {
    exerciseId,
    label: std.label,
    tier,
    level: idx > 0 ? LEVELS[idx - 1] : undefined,
    next,
    progress: hi === undefined ? 1 : Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1))),
    nextTarget: hi,
    value,
    byReps: !!std.reps,
  };
}

/** Ranks for all ranked lifts the user has performed. */
export function strengthRanks(workouts: Workout[], bodyweight: number | undefined, sex?: Sex, age?: number): StrengthRank[] {
  if (!bodyweight) return [];
  const out: StrengthRank[] = [];
  for (const id of RANKED_EXERCISES) {
    const rec = computeRecords(exerciseHistory(workouts, id));
    const value = STANDARDS[id].reps ? rec.maxReps : rec.maxE1rm;
    if (!value) continue;
    const r = strengthRank(id, value, bodyweight, sex, age);
    if (r) out.push(r);
  }
  return out;
}
