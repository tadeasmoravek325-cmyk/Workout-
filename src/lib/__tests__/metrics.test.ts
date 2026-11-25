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

import { isWeightRecord, liveRecord, emptyRecords, setScore } from '../../core/records';
import { plannedVolume } from '../../core/metrics';

describe('live records and set score', () => {
  const before = { ...emptyRecords(), maxWeight: 100, maxE1rm: 130 };
  it('flags a heavier weight, then a better estimate, else nothing', () => {
    expect(liveRecord(before, [], s('normal', 105, 3))).toBe('weight');
    expect(liveRecord(before, [], s('normal', 95, 12))).toBe('e1rm'); // 95 × 1.4 = 133 > 130
    expect(liveRecord(before, [], s('normal', 90, 5))).toBeNull();
    expect(isWeightRecord(before, s('normal', 101, 1))).toBe(true);
  });
  it('counts sets already done in this workout as the bar to beat', () => {
    expect(liveRecord(before, [s('normal', 110, 3)], s('normal', 105, 3))).toBeNull();
  });
  it('scores each exercise type on its own scale', () => {
    expect(setScore('weight_reps', { weight: 100, reps: 5 })).toBeGreaterThan(setScore('weight_reps', { weight: 100, reps: 4 }));
    expect(setScore('assisted_bodyweight', { weight: 20, reps: 8 })).toBeGreaterThan(setScore('assisted_bodyweight', { weight: 30, reps: 8 }));
    expect(setScore('reps_only', { reps: 12 })).toBe(12);
    expect(setScore('duration', { durationSec: 45 })).toBe(45);
  });
  it('sums planned volume', () => {
    expect(plannedVolume([{ weight: 50, reps: 10 }, { weight: 60, reps: 8 }, {}])).toBe(980);
  });
});

import { workingSetCount } from '../../core/metrics';

describe('workingSetCount', () => {
  it('excludes warm-ups and unfinished sets from the sets shown in statistics', () => {
    const w = { exercises: [{ sets: [s('warmup', 40, 10), s('warmup', 60, 5), s('normal', 80, 8), s('drop', 60, 8), s('normal', 80, 8, false)] }] } as unknown as Workout;
    expect(workingSetCount(w)).toBe(2);
  });
});

import { exerciseHistory } from '../../core/history';

describe('position in the workout', () => {
  const exMap = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
  const wo = (order: string[]): Workout =>
    ({ id: 'w' + order.join(), name: 'x', startedAt: 10, exercises: order.map((id, i) => ({ id: 'e' + i, exerciseId: id, sets: [s('normal', 60, 8), s('normal', 60, 8), s('normal', 60, 8)] })) }) as unknown as Workout;
  it('knows incline press was done after the bench press', () => {
    const after = exerciseHistory([wo(['bench-press', 'db-incline-press'])], 'db-incline-press', exMap)[0];
    const first = exerciseHistory([wo(['db-incline-press', 'bench-press'])], 'db-incline-press', exMap)[0];
    expect(after.priorSets).toBe(3);
    expect(first.priorSets).toBe(0);
  });
  it('does not count work for other muscles as earlier fatigue', () => {
    const w = wo(['squat', 'db-incline-press']);
    expect(exerciseHistory([w], 'db-incline-press', exMap)[0].priorSets).toBe(0);
  });
  it('leaves position unknown without the catalogue', () => {
    expect(exerciseHistory([wo(['bench-press', 'db-incline-press'])], 'db-incline-press')[0].priorSets).toBeUndefined();
  });
});
