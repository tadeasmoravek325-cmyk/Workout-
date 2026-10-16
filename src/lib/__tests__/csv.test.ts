import { describe, expect, it } from 'vitest';
import { exportCsv, importStrongCsv, parseCsv } from '../csv';
import { BUILTIN_EXERCISES } from '../../data/exercises';

const STRONG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-03-01 18:00:00,"Push Day",1h 5m,"Bench Press (Barbell)",W,60,10,0,0,"","Good, strong",
2024-03-01 18:00:00,"Push Day",1h 5m,"Bench Press (Barbell)",1,100,5,0,0,"","Good, strong",8
2024-03-01 18:00:00,"Push Day",1h 5m,"Bench Press (Barbell)",2,100,5,0,0,"","Good, strong",9
2024-03-01 18:00:00,"Push Day",1h 5m,"Zercher Squat (Barbell)",1,80,8,0,0,"","Good, strong",
2024-03-01 18:00:00,"Push Day",1h 5m,"Plank",1,0,0,0,60,"","Good, strong",
2024-03-03 09:30:00,"Run",30m,"Running (Outdoor)",1,0,0,5.2,1800,"","",
`;

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and semicolons', () => {
    expect(parseCsv('a;b\n"x;1";"he said ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'he said "hi"'],
    ]);
  });
});

describe('importStrongCsv', () => {
  const res = importStrongCsv(STRONG, 'kg', BUILTIN_EXERCISES);

  it('groups rows into workouts', () => {
    expect(res.workouts).toHaveLength(2);
    const push = res.workouts.find((w) => w.name === 'Push Day')!;
    expect(push.exercises.map((e) => e.exerciseId)).toEqual(['bench-press', 'strong-zercher-squat-barbell', 'plank']);
    expect(push.finishedAt! - push.startedAt).toBe(65 * 60_000);
    expect(push.notes).toBe('Good, strong');
  });

  it('maps set types, weights and RPE', () => {
    const bench = res.workouts.find((w) => w.name === 'Push Day')!.exercises[0];
    expect(bench.sets.map((s) => s.type)).toEqual(['warmup', 'normal', 'normal']);
    expect(bench.sets[1]).toMatchObject({ weight: 100, reps: 5, rpe: 8, done: true });
  });

  it('creates custom exercises for unknown names', () => {
    expect(res.unmatched).toEqual(['Zercher Squat (Barbell)']);
    expect(res.newExercises[0]).toMatchObject({ equipment: 'barbell', type: 'weight_reps', custom: true });
  });

  it('imports cardio distance and time', () => {
    const run = res.workouts.find((w) => w.name === 'Run')!;
    expect(run.exercises[0].exerciseId).toBe('running');
    expect(run.exercises[0].sets[0]).toMatchObject({ distance: 5.2, durationSec: 1800 });
  });

  it('converts pounds to kg', () => {
    const lb = importStrongCsv(STRONG, 'lb', BUILTIN_EXERCISES);
    const bench = lb.workouts.find((w) => w.name === 'Push Day')!.exercises[0];
    expect(bench.sets[1].weight).toBeCloseTo(45.36, 1);
  });

  it('rejects files that are not Strong exports', () => {
    expect(() => importStrongCsv('a,b\n1,2', 'kg', BUILTIN_EXERCISES)).toThrow();
  });

  it('round-trips through our own CSV export', () => {
    const exMap = new Map([...BUILTIN_EXERCISES, ...res.newExercises].map((e) => [e.id, e]));
    const csv = exportCsv(res.workouts, exMap);
    const again = importStrongCsv(csv, 'kg', [...BUILTIN_EXERCISES, ...res.newExercises]);
    expect(again.workouts).toHaveLength(2);
    expect(again.unmatched).toEqual([]);
    const bench = again.workouts.find((w) => w.name === 'Push Day')!.exercises[0];
    expect(bench.sets.map((s) => [s.type, s.weight, s.reps])).toEqual([
      ['warmup', 60, 10],
      ['normal', 100, 5],
      ['normal', 100, 5],
    ]);
  });
});
