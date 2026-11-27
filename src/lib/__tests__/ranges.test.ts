import { describe, expect, it } from 'vitest';
import { exerciseKind, suggestTarget, targetForExercise } from '../../core/progress/ranges';
import { BUILTIN_EXERCISES } from '../../data/exercises';

const ex = (id: string) => BUILTIN_EXERCISES.find((e) => e.id === id)!;

describe('exerciseKind', () => {
  it('tells heavy barbell lifts, other compounds and isolation apart', () => {
    expect(exerciseKind(ex('bench-press'))).toBe('heavy');
    expect(exerciseKind(ex('squat'))).toBe('heavy');
    expect(exerciseKind(ex('db-incline-press'))).toBe('compound');
    expect(exerciseKind(ex('lat-pulldown'))).toBe('compound');
    expect(exerciseKind(ex('lateral-raise'))).toBe('small');
    expect(exerciseKind(ex('triceps-pushdown'))).toBe('isolation');
  });
  it('puts small-muscle work on higher reps and fixes known misclassifications', () => {
    expect(exerciseKind(ex('standing-calf-raise'))).toBe('small');
    expect(exerciseKind(ex('cable-crunch'))).toBe('small');
    expect(exerciseKind(ex('wrist-curl'))).toBe('small');
    expect(exerciseKind(ex('decline-bench-press'))).toBe('heavy');
    expect(exerciseKind(ex('hip-thrust'))).toBe('heavy');
    expect(exerciseKind(ex('leg-extension'))).toBe('isolation');
    const small = suggestTarget(ex('lateral-raise'), { focus: 'hypertrophy' }).target;
    const big = suggestTarget(ex('triceps-pushdown'), { focus: 'hypertrophy' }).target;
    expect(small.repMax).toBeGreaterThan(big.repMax);
  });
  it('does not treat a curl as a compound lift because of the forearms', () => {
    const curl = BUILTIN_EXERCISES.find((e) => /Bicep Curl \(Barbell\)/.test(e.name))!;
    expect(exerciseKind(curl)).toBe('isolation');
  });
});

describe('suggestTarget', () => {
  it('uses heavier ranges for barbell compounds than for isolation', () => {
    const heavy = suggestTarget(ex('bench-press'), { focus: 'hypertrophy', phase: 'bulk' }).target;
    const iso = suggestTarget(ex('triceps-pushdown'), { focus: 'hypertrophy', phase: 'bulk' }).target;
    expect(heavy.repMax).toBeLessThan(iso.repMax);
    expect(heavy.repMin).toBeLessThan(iso.repMin);
  });
  it('moves the range down when cutting and keeps it when maintaining', () => {
    const bulk = suggestTarget(ex('db-incline-press'), { focus: 'hypertrophy', phase: 'bulk' }).target;
    const keep = suggestTarget(ex('db-incline-press'), { focus: 'hypertrophy', phase: 'maintain' }).target;
    const cut = suggestTarget(ex('db-incline-press'), { focus: 'hypertrophy', phase: 'cut' }).target;
    expect(keep.repMin).toBe(bulk.repMin);
    expect(cut.repMin).toBe(bulk.repMin - 2);
    expect(cut.repMax).toBe(bulk.repMax - 2);
  });
  it('never goes below 3 reps and keeps a usable range', () => {
    const t = suggestTarget(ex('squat'), { focus: 'strength', phase: 'cut' }).target;
    expect(t.repMin).toBeGreaterThanOrEqual(3);
    expect(t.repMax - t.repMin).toBeGreaterThanOrEqual(2);
  });
  it('follows your planned number of sets and defaults to maintaining', () => {
    const a = suggestTarget(ex('bench-press'), { focus: 'both', plannedSets: 5 });
    expect(a.target.sets).toBe(5);
    expect(a.reason).toMatch(/Maintaining/);
  });
  it('asks for strength-focused heavy lifts in a low range', () => {
    const t = suggestTarget(ex('bench-press'), { focus: 'strength', phase: 'maintain' }).target;
    expect([t.repMin, t.repMax]).toEqual([3, 6]);
  });
});

describe('targetForExercise', () => {
  const base = { goal: 'muscle' };
  it('follows training focus and body goal without applying anything', () => {
    const press = ex('db-incline-press');
    expect(targetForExercise(press, { ...base, trainingFocus: 'hypertrophy' }).repMin).toBe(8);
    expect(targetForExercise(press, { ...base, trainingFocus: 'strength' }).repMin).toBe(5);
    expect(targetForExercise(press, { ...base, trainingFocus: 'hypertrophy', phase: 'cut' }).repMin).toBe(6);
  });
  it('uses the profile goal when no focus was chosen', () => {
    expect(targetForExercise(ex('bench-press'), { goal: 'strength' }).repMax).toBe(6);
    expect(targetForExercise(ex('bench-press'), { goal: 'muscle' }).repMax).toBe(10);
  });
  it('lets your own range win', () => {
    const t = targetForExercise(ex('bench-press'), { ...base, exerciseTargets: { 'bench-press': { repMin: 5, repMax: 7, sets: 5, rir: 1 } } });
    expect([t.repMin, t.repMax, t.sets]).toEqual([5, 7, 5]);
  });
});

describe('ranges for bodyweight and timed exercises', () => {
  const anyEx = (id: string) => BUILTIN_EXERCISES.find((e) => e.id === id)!;
  it('gives every rep-based type a target', () => {
    for (const id of ['push-up', 'back-extension', 'assisted-pull-up', 'plank']) {
      const t = targetForExercise(anyEx(id), { goal: 'muscle' });
      expect(t.repMin).toBeGreaterThan(0);
      expect(t.repMax).toBeGreaterThan(t.repMin);
    }
  });
  it('uses seconds for holds and no cut shift for reps-only exercises', () => {
    const plank = targetForExercise(anyEx('plank'), { goal: 'muscle' });
    expect([plank.repMin, plank.repMax, plank.increment]).toEqual([30, 60, 5]);
    const bulk = targetForExercise(anyEx('push-up'), { goal: 'muscle', phase: 'bulk' });
    const cut = targetForExercise(anyEx('push-up'), { goal: 'muscle', phase: 'cut' });
    expect([cut.repMin, cut.repMax]).toEqual([bulk.repMin, bulk.repMax]);
  });
});

describe('the focus is a recommendation, not a rule', () => {
  const find = (re: RegExp) => BUILTIN_EXERCISES.find((e) => re.test(e.name))!;
  it('keeps the deadlift low-rep and calves high-rep whatever the focus', () => {
    const dead = find(/^Deadlift \(Barbell\)/);
    const calf = find(/Standing Calf/);
    for (const focus of ['strength', 'both', 'hypertrophy'] as const) {
      const d = targetForExercise(dead, { goal: 'muscle', trainingFocus: focus });
      expect(d.repMax).toBeLessThanOrEqual(7);
      const c = targetForExercise(calf, { goal: 'muscle', trainingFocus: focus });
      expect(c.repMin).toBeGreaterThanOrEqual(11);
      expect(c.repMax).toBeGreaterThanOrEqual(19);
    }
  });
  it('only nudges a natural range by a rep', () => {
    const calf = find(/Standing Calf/);
    expect(targetForExercise(calf, { goal: 'muscle', trainingFocus: 'both' }).repMin).toBe(12);
    expect(targetForExercise(calf, { goal: 'muscle', trainingFocus: 'hypertrophy' }).repMin).toBe(13);
    expect(targetForExercise(calf, { goal: 'muscle', trainingFocus: 'strength' }).repMin).toBe(11);
  });
  it('treats a recommended range as a guide and your own as strict', () => {
    const press = ex('db-incline-press');
    expect(targetForExercise(press, { goal: 'muscle' }).tolerance).toBe(1);
    expect(targetForExercise(press, { goal: 'muscle', exerciseTargets: { 'db-incline-press': { repMin: 8, repMax: 12, sets: 3 } } }).tolerance).toBeUndefined();
  });
});
