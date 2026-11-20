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
    expect(evaluateExercise(bench, [session(1, [set(70, 8)])], target).state).toBe('insufficient');
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
    expect(a.reps).toBe(9);
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
  it('derives RIR from RPE only when logged', () => {
    expect(rirOf(8)).toBe(2);
    expect(rirOf(undefined)).toBeUndefined();
  });
  it('uses focus defaults and per-exercise overrides', () => {
    expect(targetFor('x', undefined, 'strength').repMax).toBe(6);
    expect(targetFor('x', { x: { repMin: 5, repMax: 8, sets: 5 } }, 'strength').sets).toBe(5);
  });
});
