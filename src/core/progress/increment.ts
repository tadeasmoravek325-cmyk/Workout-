import type { Exercise } from '../../types';

/** Smallest sensible load jump for an exercise (kg). */
export function weightIncrement(ex: Exercise): number {
  if (ex.equipment === 'barbell' && (ex.bodyPart === 'legs' || ex.id.includes('deadlift'))) return 5;
  if (ex.equipment === 'dumbbell') return 2;
  if (ex.equipment === 'kettlebell') return 4;
  return 2.5;
}
