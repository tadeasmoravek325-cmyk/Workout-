import { describe, expect, it } from 'vitest';
import type { Workout } from '../../types';
import { BUILTIN_EXERCISES } from '../../data/exercises';
import { busierSide, workoutMuscleSets } from '../../components/WorkoutCard';

const exMap = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
const set = (type: 'normal' | 'warmup', done = true) => ({ id: Math.random().toString(), type, weight: 60, reps: 8, done });

function workout(exerciseId: string, sets: ReturnType<typeof set>[]): Workout {
  return { id: 'w', name: 'W', startedAt: 0, finishedAt: 1, exercises: [{ id: 'e', exerciseId, sets }] } as Workout;
}

describe('workout card muscle map', () => {
  it('counts only done working sets, scaled by muscle load', () => {
    const w = workout('bench-press', [set('warmup'), set('normal'), set('normal'), set('normal', false)]);
    const load = workoutMuscleSets(w, exMap);
    expect(load.chest).toBeCloseTo(2);
    expect(Object.values(load).every((v) => (v ?? 0) <= 2)).toBe(true);
  });

  it('picks the side carrying more load', () => {
    expect(busierSide(workoutMuscleSets(workout('bench-press', [set('normal')]), exMap))).toBe('front');
    expect(busierSide(workoutMuscleSets(workout('deadlift', [set('normal')]), exMap))).toBe('back');
  });

  it('defaults to front for an empty workout', () => {
    expect(busierSide({})).toBe('front');
  });
});
