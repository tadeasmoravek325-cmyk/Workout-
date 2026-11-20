import { describe, expect, it } from 'vitest';
import { countWorkingSets, e1rm, e1rmReliable, isLoggedWorkingSet, isWorkingSet, setVolume, workSetVolume } from '../../core/metrics';
import { setsPerMuscle } from '../../core/muscles';
import { BUILTIN_EXERCISES } from '../../data/exercises';
import type { Workout, WorkoutSet } from '../../types';

const s = (type: string, weight: number, reps: number, done = true): WorkoutSet => ({ id: Math.random().toString(), type, weight, reps, done }) as WorkoutSet;

describe('core metrics', () => {
  it('treats drop and failure sets as working, warm-ups as not', () => {
    expect(isWorkingSet(s('normal', 60, 8))).toBe(true);
    expect(isWorkingSet(s('drop', 50, 8))).toBe(true);
    expect(isWorkingSet(s('failure', 60, 8))).toBe(true);
    expect(isWorkingSet(s('warmup', 40, 10))).toBe(false);
  });
  it('keeps warm-ups in general volume but not in work volume', () => {
    const w = s('warmup', 40, 10);
    expect(setVolume(w)).toBe(400);
    expect(workSetVolume(w)).toBe(0);
    expect(workSetVolume(s('normal', 80, 8))).toBe(640);
  });
  it('ignores unfinished sets', () => {
    expect(setVolume(s('normal', 80, 8, false))).toBe(0);
    expect(countWorkingSets([s('normal', 80, 8), s('normal', 80, 8, false), s('warmup', 40, 10)])).toBe(1);
  });
  it('does not count empty ticked rows as logged', () => {
    expect(isLoggedWorkingSet({ ...s('normal', 0, 0) })).toBe(false);
    expect(isLoggedWorkingSet(s('normal', 80, 5))).toBe(true);
  });
  it('flags e1RM above 12 reps as unreliable', () => {
    expect(e1rmReliable(12)).toBe(true);
    expect(e1rmReliable(13)).toBe(false);
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
  });
  it('counts muscle sets from working sets only', () => {
    const exMap = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
    const w = { id: 'w', name: 'x', startedAt: 10, exercises: [{ id: 'a', exerciseId: 'bench-press', sets: [s('warmup', 40, 10), s('normal', 80, 8), s('normal', 80, 8)] }] } as unknown as Workout;
    expect(setsPerMuscle([w], exMap, 0).chest).toBe(2);
  });
});
