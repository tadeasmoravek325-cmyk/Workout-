import { describe, expect, it } from 'vitest';
import { hasChanges, routineChanges } from '../routineDiff';
import type { Routine, Workout } from '../../types';

const r = { exercises: [{ id: 'a', exerciseId: 'x', restSec: 90, sets: [{ type: 'normal', weight: 50, reps: 8 }, { type: 'normal', weight: 50, reps: 8 }] }] } as unknown as Routine;
const w = (sets: number, rest = 90, weight = 50, extra = false) =>
  ({ exercises: [{ id: 'b', exerciseId: 'x', restSec: rest, sets: Array.from({ length: sets }, () => ({ type: 'normal', weight, reps: 8 })) }, ...(extra ? [{ id: 'c', exerciseId: 'y', sets: [{ type: 'normal' }] }] : [])] }) as unknown as Workout;

describe('routineChanges', () => {
  it('sees no change', () => expect(hasChanges(routineChanges(r, w(2)))).toBe(false));
  it('counts removed sets and rest changes', () => {
    const c = routineChanges(r, w(1, 120));
    expect(c.removedSets).toBe(1);
    expect(c.rest).toBe(true);
  });
  it('counts added exercises and weight changes', () => {
    const c = routineChanges(r, w(2, 90, 55, true));
    expect(c.addedExercises).toBe(1);
    expect(c.weights).toBe(true);
  });
});
