import { describe, expect, it } from 'vitest';
import { analyzeStrongCsv, buildStrongImport, exportCsv, importStrongCsv, parseCsv, strongExerciseId } from '../csv';
import { computeRecords, exerciseHistory } from '../calc';
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
    expect(push.exercises.map((e) => e.exerciseId)).toEqual(['bench-press', strongExerciseId('Zercher Squat (Barbell)'), 'plank']);
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

const NEW_FORMAT = `Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes
1,2025-05-02 17:00:00,Legs,3600,Squat (Barbell),1,140,3,,0,0,,
1,2025-05-02 17:00:00,Legs,3600,Hack Squat,1,180,8,,0,0,,
1,2025-05-02 17:00:00,Legs,3600,Reverse Hack Squat,1,200,10,,0,0,,
1,2025-05-02 17:00:00,Legs,3600,Reverse Hack Squat,2,200,9,,0,0,,
2,2025-05-04 08:00:00,Run,1800,Running (Outdoor),1,0,0,,5200,1800,,
`;

describe('Strong import – newer export format and similar names', () => {
  it('reads weights and units from headers like "Weight (kg)"', () => {
    const res = importStrongCsv(NEW_FORMAT, 'lb', BUILTIN_EXERCISES);
    const legs = res.workouts.find((w) => w.name === 'Legs')!;
    expect(legs.exercises[0].sets[0].weight).toBe(140); // kg from header wins over the lb fallback
    expect(legs.finishedAt! - legs.startedAt).toBe(3600 * 1000);
    const run = res.workouts.find((w) => w.name === 'Run')!;
    expect(run.exercises[0].sets[0].distance).toBeCloseTo(5.2); // meters → km
  });

  it('never merges Squat, Hack Squat and Reverse Hack Squat', () => {
    const res = importStrongCsv(NEW_FORMAT, 'kg', BUILTIN_EXERCISES);
    const ids = res.workouts.find((w) => w.name === 'Legs')!.exercises.map((e) => e.exerciseId);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe('squat');
    expect(ids[1]).toBe('hack-squat');
    expect(ids[2]).not.toBe('squat');
    expect(ids[2]).not.toBe('hack-squat');
  });

  it('keeps records apart for similar exercises', () => {
    const res = importStrongCsv(NEW_FORMAT, 'kg', BUILTIN_EXERCISES);
    const squatId = 'squat';
    const reverseId = res.workouts.find((w) => w.name === 'Legs')!.exercises[2].exerciseId;
    expect(computeRecords(exerciseHistory(res.workouts, squatId)).maxWeight).toBe(140);
    expect(computeRecords(exerciseHistory(res.workouts, reverseId)).maxWeight).toBe(200);
  });

  it('gives different names different ids even when they slugify the same', () => {
    expect(strongExerciseId('Row (Cable)')).not.toBe(strongExerciseId('Row - Cable'));
    expect(strongExerciseId('Reverse Hack Squat')).toBe(strongExerciseId('  reverse   hack squat '));
  });

  it('suggests only exact matches and lets the user override the mapping', () => {
    const analysis = analyzeStrongCsv(NEW_FORMAT, BUILTIN_EXERCISES);
    const rev = analysis.exercises.find((e) => e.name === 'Reverse Hack Squat')!;
    expect(rev.suggested).toBeNull();
    expect(rev.sets).toBe(2);
    expect(analysis.unitFromFile).toBe('kg');
    expect(analysis.workoutCount).toBe(2);
    const mapping = Object.fromEntries(analysis.exercises.map((e) => [e.key, e.suggested]));
    mapping[rev.key] = 'leg-press';
    const res = buildStrongImport(analysis, mapping, 'kg', BUILTIN_EXERCISES);
    const legs = res.workouts.find((w) => w.name === 'Legs')!;
    expect(legs.exercises[2].exerciseId).toBe('leg-press');
    expect(res.newExercises.some((e) => e.name === 'Reverse Hack Squat')).toBe(false);
  });
});
