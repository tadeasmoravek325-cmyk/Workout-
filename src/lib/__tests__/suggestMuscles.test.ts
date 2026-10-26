import { describe, expect, it } from 'vitest';
import { suggestMuscles } from '../suggestMuscles';
import { BUILTIN_EXERCISES } from '../../data/exercises';

describe('suggestMuscles', () => {
  it('finds chest for a new bench press variation', () => {
    const s = suggestMuscles('Spoto bench press', BUILTIN_EXERCISES);
    expect(s?.primary).toContain('chest');
    expect(s?.bodyPart).toBe('chest');
  });
  it('picks up the equipment from the name', () => {
    expect(suggestMuscles('Smith machine squat', BUILTIN_EXERCISES)?.equipment).toBe('barbell');
  });
  it('returns null for an unrelated name', () => {
    expect(suggestMuscles('Xyzzy', BUILTIN_EXERCISES)).toBeNull();
  });
});
