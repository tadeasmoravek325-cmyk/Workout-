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

describe('withSuggestedMuscles', () => {
  const base = { id: 'c1', name: 'Reverse Hack Squat', equipment: 'machine' as const, type: 'weight_reps' as const, bodyPart: 'fullbody' as const, primary: [], secondary: [], custom: true };
  it('fills a custom exercise that has no muscles', async () => {
    const { withSuggestedMuscles } = await import('../suggestMuscles');
    const e = withSuggestedMuscles(base, BUILTIN_EXERCISES);
    expect(e.primary).toContain('quads');
    expect(e.bodyPart).toBe('legs');
  });
  it('leaves an exercise that already has muscles alone', async () => {
    const { withSuggestedMuscles } = await import('../suggestMuscles');
    const mine = { ...base, primary: ['chest' as const] };
    expect(withSuggestedMuscles(mine, BUILTIN_EXERCISES)).toBe(mine);
  });
});
