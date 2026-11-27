import { describe, expect, it } from 'vitest';
import { evaluateExercise, rirOf, targetFor } from '../../core/progress/engine';
import type { Session } from '../calc';
import type { Exercise, WorkoutSet } from '../../types';

const bench = { id: 'bench-press', name: 'Bench', type: 'weight_reps', equipment: 'barbell', bodyPart: 'chest' } as unknown as Exercise;
const set = (weight: number, reps: number, rpe?: number): WorkoutSet => ({ id: Math.random().toString(), type: 'normal', weight, reps, rpe, done: true });
const session = (daysAgo: number, sets: WorkoutSet[]): Session => ({ workoutId: String(daysAgo), workoutName: 'x', date: Date.UTC(2026, 5, 30) - daysAgo * 86_400_000, sets });
const target = { repMin: 8, repMax: 12, sets: 3, rir: 2 };

describe('double progression engine', () => {
  it('needs history', () => {
    expect(evaluateExercise(bench, [], target).state).toBe('insufficient');
  });
  it('adds weight after reaching the top of the range on every set', () => {
    const a = evaluateExercise(bench, [session(2, [set(70, 12, 8), set(70, 12, 8), set(70, 12, 8)]), session(9, [set(70, 10), set(70, 10), set(70, 9)])], target);
    expect(a.state).toBe('ready');
    expect(a.weight).toBe(72.5);
    expect(a.reps).toBe(8);
    expect(a.confidence).toBe('medium'); // RIR logged, but only 2 sessions of history
  });
  it('is confident with RIR and a longer history', () => {
    const older = [16, 23, 30, 37].map((d) => session(d, [set(70, 9, 8), set(70, 9, 8), set(70, 8, 8)]));
    const a = evaluateExercise(bench, [session(2, [set(70, 12, 8), set(70, 12, 8), set(70, 12, 8)]), session(9, [set(70, 10, 8), set(70, 10, 8), set(70, 9, 8)]), ...older], target);
    expect(a.state).toBe('ready');
    expect(a.confidence).toBe('high');
  });
  it('takes a double step when every set had 3+ reps in reserve', () => {
    const a = evaluateExercise(bench, [session(2, [set(70, 12, 7), set(70, 12, 7), set(70, 12, 6.5)]), session(9, [set(70, 10), set(70, 10), set(70, 9)])], target);
    expect(a.weight).toBe(75);
  });
  it('lowers confidence and warns when RIR is missing', () => {
    const a = evaluateExercise(bench, [session(2, [set(70, 12), set(70, 12), set(70, 12)]), session(9, [set(70, 10), set(70, 10), set(70, 9)])], target);
    expect(a.confidence).toBe('low');
    expect(a.warnings.length).toBeGreaterThan(0);
  });
  it('holds when the top of the range came at failure', () => {
    const a = evaluateExercise(bench, [session(2, [set(70, 12, 8), set(70, 12, 9), set(70, 12, 10)]), session(9, [set(70, 10), set(70, 10), set(70, 9)])], target);
    expect(a.state).toBe('hold');
  });
  it('builds reps at the same weight', () => {
    const a = evaluateExercise(bench, [session(2, [set(70, 10), set(70, 9), set(70, 8)]), session(9, [set(70, 8), set(70, 8), set(70, 8)])], target);
    expect(a.state).toBe('building');
    expect(a.weight).toBe(70);
    expect(a.reps).toBe(11);
    expect(a.setReps).toEqual([11, 10, 9]); // 10 / 9 / 8 last time: one more rep on each set
  });
  it('does not call one bad session a stagnation or decline', () => {
    const a = evaluateExercise(bench, [session(2, [set(70, 8), set(70, 8), set(70, 8)]), session(9, [set(70, 10), set(70, 9), set(70, 9)]), session(16, [set(70, 9), set(70, 9), set(70, 8)])], target);
    expect(['stagnation', 'decline']).not.toContain(a.state);
  });
  it('detects repeated decline without blaming overtraining', () => {
    const a = evaluateExercise(bench, [session(2, [set(80, 5)]), session(9, [set(85, 5)]), session(16, [set(90, 5)])], target);
    expect(a.state).toBe('decline');
    expect(a.reasons.join(' ')).not.toMatch(/overtrain/i);
  });
  it('detects stagnation over several exposures', () => {
    const s = [2, 9, 16, 23, 30].map((d) => session(d, [set(100, 5), set(100, 5), set(100, 5)]));
    expect(evaluateExercise(bench, s, { ...target, repMin: 3, repMax: 6 }).state).toBe('stagnation');
  });
  it('advises from sessions done in the same position as today', () => {
    const fresh1 = { ...session(9, [set(60, 12, 8), set(60, 12, 8), set(60, 12, 8)]), priorSets: 0 };
    const fresh2 = { ...session(23, [set(60, 10, 8), set(60, 10, 8), set(60, 9, 8)]), priorSets: 0 };
    const tired1 = { ...session(2, [set(50, 8, 8), set(50, 8, 8), set(50, 8, 8)]), priorSets: 4 };
    const tired2 = { ...session(16, [set(50, 8, 8), set(50, 8, 8), set(50, 8, 8)]), priorSets: 4 };
    const hist = [tired1, fresh1, tired2, fresh2];
    const first = evaluateExercise(bench, hist, target, { priorSets: 0 });
    expect(first.state).toBe('ready'); // the newest session was a tired one, but today it is done first
    expect(first.weight).toBe(62.5);
    const after = evaluateExercise(bench, hist, target, { priorSets: 4 });
    expect(after.state).toBe('building');
    expect(after.weight).toBe(50);
  });
  it('warns and lowers confidence when it has no session in the same position', () => {
    const hist = [2, 9, 16, 23].map((d) => ({ ...session(d, [set(60, 8, 8), set(60, 8, 8)]), priorSets: 4 }));
    const a = evaluateExercise(bench, hist, target, { priorSets: 0 });
    expect(a.warnings.some((w) => /different position/.test(w))).toBe(true);
    expect(a.confidence).not.toBe('high');
  });
  it('compares best sets, not estimates', () => {
    // Same weight and reps, but the old engine would have seen a different 1RM estimate between 12 and 8 reps.
    const hist = [2, 9, 16, 23, 30].map((d) => session(d, [set(100, 5), set(100, 5), set(100, 5)]));
    expect(evaluateExercise(bench, hist, { ...target, repMin: 3, repMax: 6 }).state).toBe('stagnation');
  });
  it('derives RIR from RPE only when logged', () => {
    expect(rirOf(8)).toBe(2);
    expect(rirOf(undefined)).toBeUndefined();
  });
  it('uses focus defaults and per-exercise overrides', () => {
    expect(targetFor('x', undefined, 'strength').repMax).toBe(6);
    expect(targetFor('x', undefined, 'both').repMin).toBe(5);
    expect(targetFor('x', { x: { repMin: 5, repMax: 8, sets: 5 } }, 'strength').sets).toBe(5);
  });

  // The four situations of double progression.
  describe('situations A to D', () => {
    const t3 = { repMin: 8, repMax: 12, sets: 3, rir: 2 };
    const prior = session(9, [set(70, 9, 8), set(70, 9, 8), set(70, 8, 8)]);
    it('A: not at the top on every set keeps the weight and adds a rep on each set', () => {
      const a = evaluateExercise(bench, [session(2, [set(70, 10, 8), set(70, 9, 8), set(70, 8, 8)]), prior], t3);
      expect(a.state).toBe('building');
      expect(a.weight).toBe(70);
      expect(a.setReps).toEqual([11, 10, 9]);
    });
    it('B: top of the range with the target RIR adds the increment and returns to the lower part of the range', () => {
      const a = evaluateExercise(bench, [session(2, [set(70, 12, 8), set(70, 12, 8), set(70, 12, 8)]), prior], { ...t3, increment: 2.5 });
      expect(a.state).toBe('ready');
      expect(a.weight).toBe(72.5);
      expect(a.nextRange).toEqual([8, 10]);
      expect(a.setReps).toEqual([8, 8, 8]);
    });
    it('B: uses your own increment', () => {
      const a = evaluateExercise(bench, [session(2, [set(70, 12, 8), set(70, 12, 8), set(70, 12, 8)]), prior], { ...t3, increment: 5 });
      expect(a.weight).toBe(75);
    });
    it('B: does not add weight when the reserve was below the target', () => {
      const a = evaluateExercise(bench, [session(2, [set(70, 12, 9), set(70, 12, 9), set(70, 12, 9)]), prior], t3); // RIR 1, target 2
      expect(a.state).toBe('hold');
      expect(a.weight).toBe(70);
    });
    it('C: below the minimum once holds the weight and warns of fatigue', () => {
      const a = evaluateExercise(bench, [session(2, [set(70, 8, 8), set(70, 7, 8), set(70, 6, 8)]), session(9, [set(70, 10, 8), set(70, 9, 8), set(70, 9, 8)])], t3);
      expect(a.state).toBe('hold');
      expect(a.weight).toBe(70);
      expect(a.fatigue).toBe(true);
    });
    it('C: below the minimum twice in a row suggests a lower weight', () => {
      const a = evaluateExercise(bench, [session(2, [set(70, 8, 8), set(70, 7, 8), set(70, 6, 8)]), session(9, [set(70, 8, 8), set(70, 7, 8), set(70, 7, 8)])], { ...t3, increment: 2.5 });
      expect(a.state).toBe('reduce');
      expect(a.weight).toBe(67.5);
      expect(a.fatigue).toBe(true);
    });
    it('C: a clear drop in total reps is not met with a heavier weight', () => {
      const a = evaluateExercise(bench, [session(2, [set(70, 8, 8), set(70, 8, 8), set(70, 8, 8)]), session(9, [set(70, 11, 8), set(70, 11, 8), set(70, 11, 8)])], t3);
      expect(a.state).toBe('hold');
      expect(a.warnings.some((w) => /fell clearly/.test(w))).toBe(true);
    });
    it('D: repeated failure keeps the weight and flags high intensity', () => {
      const f = (d: number) => session(d, [set(70, 12, 10), set(70, 12, 8), set(70, 12, 8)]); // RIR 0 on one set
      const a = evaluateExercise(bench, [f(2), f(9), f(16)], t3);
      expect(a.state).toBe('hold');
      expect(a.intensityHigh).toBe(true);
      expect(a.weight).toBe(70);
      expect(a.warnings.some((w) => /failure/.test(w))).toBe(true);
    });
    it('D: a single set to failure is not yet a pattern', () => {
      const a = evaluateExercise(bench, [session(2, [set(70, 12, 10), set(70, 12, 8), set(70, 12, 8)]), prior], t3);
      expect(a.intensityHigh).toBeUndefined();
    });
    it('works from a single session', () => {
      expect(evaluateExercise(bench, [session(2, [set(70, 10, 8), set(70, 9, 8), set(70, 8, 8)])], t3).state).toBe('building');
    });
  });
});
