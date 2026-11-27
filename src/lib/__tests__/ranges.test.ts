import { describe, expect, it } from 'vitest';
import { exerciseKind, suggestTarget } from '../../core/progress/ranges';
import { BUILTIN_EXERCISES } from '../../data/exercises';

const ex = (id: string) => BUILTIN_EXERCISES.find((e) => e.id === id)!;

describe('exerciseKind', () => {
  it('tells heavy barbell lifts, other compounds and isolation apart', () => {
    expect(exerciseKind(ex('bench-press'))).toBe('heavy');
    expect(exerciseKind(ex('squat'))).toBe('heavy');
    expect(exerciseKind(ex('db-incline-press'))).toBe('compound');
    expect(exerciseKind(ex('lat-pulldown'))).toBe('compound');
    expect(exerciseKind(ex('lateral-raise'))).toBe('isolation');
    expect(exerciseKind(ex('triceps-pushdown'))).toBe('isolation');
  });
  it('does not treat a curl as a compound lift because of the forearms', () => {
    const curl = BUILTIN_EXERCISES.find((e) => /Bicep Curl \(Barbell\)/.test(e.name))!;
    expect(exerciseKind(curl)).toBe('isolation');
  });
});

describe('suggestTarget', () => {
  it('uses heavier ranges for barbell compounds than for isolation', () => {
    const heavy = suggestTarget(ex('bench-press'), { focus: 'hypertrophy', phase: 'bulk' }).target;
    const iso = suggestTarget(ex('lateral-raise'), { focus: 'hypertrophy', phase: 'bulk' }).target;
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
