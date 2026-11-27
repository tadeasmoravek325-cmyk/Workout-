import { describe, expect, it } from 'vitest';
import { repStatus, reviewSets } from '../../core/progress/live';
import type { WorkoutSet } from '../../types';

const target = { repMin: 8, repMax: 12, sets: 3, rir: 2 };
const set = (reps: number, rpe?: number, type = 'normal'): WorkoutSet => ({ id: String(Math.random()), type, weight: 70, reps, rpe, done: true }) as WorkoutSet;

describe('reviewSets', () => {
  it('places each set against the range', () => {
    expect(repStatus(7, target)).toBe('below');
    expect(repStatus(10, target)).toBe('in');
    expect(repStatus(12, target)).toBe('top');
  });
  it('reports a set below the minimum', () => {
    const r = reviewSets([set(10), set(7)], target);
    expect(r.sets.map((s) => s.status)).toEqual(['in', 'below']);
    expect(r.message).toMatch(/Set 2 is below 8/);
  });
  it('says to add weight when every set is at the top with the reserve', () => {
    const r = reviewSets([set(12, 8), set(12, 8), set(12, 8)], target);
    expect(r.topOnEverySet).toBe(true);
    expect(r.message).toMatch(/Add weight next time/);
  });
  it('does not when the reserve was smaller than the target', () => {
    const r = reviewSets([set(12, 9), set(12, 9), set(12, 9)], target);
    expect(r.topOnEverySet).toBe(false);
    expect(r.message).toMatch(/less in reserve/);
  });
  it('flags a set to failure', () => {
    expect(reviewSets([set(10, 10)], target).message).toMatch(/failure/);
    expect(reviewSets([set(10, 8, 'failure')], target).sets[0].failure).toBe(true);
  });
  it('ignores warm-ups and says nothing before any set is done', () => {
    expect(reviewSets([set(5, undefined, 'warmup')], target).message).toBeNull();
    expect(reviewSets([], target).sets).toEqual([]);
  });
  it('says how many sets are left while in range', () => {
    expect(reviewSets([set(10)], target).message).toMatch(/2 more to go/);
  });
});
