import { describe, expect, it } from 'vitest';
import { findDuplicates, nameKey, remapExercise } from '../mergeExercises';
import type { Exercise } from '../../types';

const ex = (id: string, name: string, custom = false) => ({ id, name, custom }) as Exercise;

describe('mergeExercises', () => {
  it('matches reordered names', () => {
    expect(nameKey('Squat (Smith Machine)')).toBe(nameKey('Smith Machine Squat'));
    expect(nameKey('Bench Press')).not.toBe(nameKey('Incline Bench Press'));
  });
  it('keeps the built-in as the target', () => {
    const g = findDuplicates([ex('smith-squat', 'Squat (Smith Machine)'), ex('strong-1', 'Squat (Smith Machine)', true)], new Map([['strong-1', 9]]));
    expect(g).toHaveLength(1);
    expect(g[0].target.id).toBe('smith-squat');
    expect(g[0].sources.map((s) => s.id)).toEqual(['strong-1']);
  });
  it('ignores two built-ins', () => {
    expect(findDuplicates([ex('a', 'Row'), ex('b', 'Row')], new Map())).toHaveLength(0);
  });
  it('remaps ids without touching others', () => {
    const items = [{ id: 1, exercises: [{ exerciseId: 'x' }, { exerciseId: 'y' }] }, { id: 2, exercises: [{ exerciseId: 'y' }] }];
    const r = remapExercise(items, 'x', 'z');
    expect(r.changed).toBe(1);
    expect(r.items[0].exercises.map((e) => e.exerciseId)).toEqual(['z', 'y']);
    expect(r.items[1]).toBe(items[1]);
  });
});
