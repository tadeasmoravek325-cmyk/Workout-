import type { Exercise, Measurement, Workout } from '../types';
import type { IconName } from '../components/Icon';
import { computeRecords, exerciseHistory, workoutVolume } from './calc';

export interface AchievementStats {
  workouts: number;
  totalVolumeKg: number;
  totalSets: number;
  totalMinutes: number;
  bestWeekStreak: number;
  earlyBird: boolean;
  nightOwl: boolean;
  longWorkout: boolean;
  benchBodyweight: boolean;
  squat100: boolean;
  deadlift140: boolean;
  pullups10: boolean;
  distinctExercises: number;
  measurements: number;
}

export interface Achievement {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  /** 0..1 */
  progress: (s: AchievementStats) => number;
}

function ratio(v: number, target: number) {
  return Math.max(0, Math.min(1, v / target));
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: 'flag', title: 'First step', description: 'Finish your first workout.', progress: (s) => ratio(s.workouts, 1) },
  { id: 'w10', icon: 'biceps', title: 'Warming up', description: 'Finish 10 workouts.', progress: (s) => ratio(s.workouts, 10) },
  { id: 'w50', icon: 'dumbbell', title: 'Regular', description: 'Finish 50 workouts.', progress: (s) => ratio(s.workouts, 50) },
  { id: 'w100', icon: 'trophy', title: 'Century', description: 'Finish 100 workouts.', progress: (s) => ratio(s.workouts, 100) },
  { id: 'w250', icon: 'crown', title: 'Gym legend', description: 'Finish 250 workouts.', progress: (s) => ratio(s.workouts, 250) },
  { id: 'v10t', icon: 'bricks', title: '10 tonnes', description: 'Lift 10,000 kg in total.', progress: (s) => ratio(s.totalVolumeKg, 10_000) },
  { id: 'v100t', icon: 'truck', title: 'Truckload', description: 'Lift 100,000 kg in total.', progress: (s) => ratio(s.totalVolumeKg, 100_000) },
  { id: 'v1000t', icon: 'ship', title: 'Ocean liner', description: 'Lift 1,000,000 kg in total.', progress: (s) => ratio(s.totalVolumeKg, 1_000_000) },
  { id: 's1000', icon: 'repeat', title: 'A thousand sets', description: 'Complete 1,000 sets.', progress: (s) => ratio(s.totalSets, 1000) },
  { id: 'h24', icon: 'timer', title: 'A day at the gym', description: 'Train for 24 hours in total.', progress: (s) => ratio(s.totalMinutes, 24 * 60) },
  { id: 'streak', icon: 'flame', title: 'On a roll', description: 'Train at least once a week for 4 weeks in a row.', progress: (s) => ratio(s.bestWeekStreak, 4) },
  { id: 'early', icon: 'sunrise', title: 'Early bird', description: 'Start a workout before 7 am.', progress: (s) => (s.earlyBird ? 1 : 0) },
  { id: 'night', icon: 'moon', title: 'Night owl', description: 'Start a workout after 9 pm.', progress: (s) => (s.nightOwl ? 1 : 0) },
  { id: 'long', icon: 'hourglass', title: 'Marathon', description: 'Finish a workout longer than 2 hours.', progress: (s) => (s.longWorkout ? 1 : 0) },
  { id: 'bench-bw', icon: 'weight', title: 'Bodyweight bench', description: 'Bench press at least your own bodyweight.', progress: (s) => (s.benchBodyweight ? 1 : 0) },
  { id: 'squat100', icon: 'footprints', title: '100 kg squat', description: 'Squat 100 kg.', progress: (s) => (s.squat100 ? 1 : 0) },
  { id: 'dl140', icon: 'anchor', title: 'Three plates', description: 'Deadlift 140 kg.', progress: (s) => (s.deadlift140 ? 1 : 0) },
  { id: 'pull10', icon: 'mountain', title: 'Ten pull-ups', description: 'Do 10 pull-ups in a single set.', progress: (s) => (s.pullups10 ? 1 : 0) },
  { id: 'variety', icon: 'layers', title: 'Variety', description: 'Try 25 different exercises.', progress: (s) => ratio(s.distinctExercises, 25) },
  { id: 'measure', icon: 'ruler', title: 'Self-tracker', description: 'Log 10 body measurements.', progress: (s) => ratio(s.measurements, 10) },
];

function maxConsecutiveWeeks(workouts: Workout[]): number {
  const weeks = [
    ...new Set(
      workouts.map((w) => {
        const d = new Date(w.startedAt);
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return Math.round(d.getTime() / (7 * 86_400_000));
      }),
    ),
  ].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < weeks.length; i++) {
    run = i > 0 && weeks[i] === weeks[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function achievementStats(workouts: Workout[], exMap: Map<string, Exercise>, measurements: Measurement[]): AchievementStats {
  const bodyweight = [...measurements].reverse().find((m) => m.type === 'bodyweight')?.value;
  const maxW = (id: string) => computeRecords(exerciseHistory(workouts, id)).maxWeight;
  const maxReps = (ids: string[]) => Math.max(0, ...ids.map((id) => computeRecords(exerciseHistory(workouts, id)).maxReps));
  const distinct = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  return {
    workouts: workouts.length,
    totalVolumeKg: workouts.reduce((a, w) => a + workoutVolume(w, exMap), 0),
    totalSets: workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter((s) => s.done).length, 0), 0),
    totalMinutes: workouts.reduce((a, w) => a + ((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000, 0),
    bestWeekStreak: maxConsecutiveWeeks(workouts),
    earlyBird: workouts.some((w) => new Date(w.startedAt).getHours() < 7),
    nightOwl: workouts.some((w) => new Date(w.startedAt).getHours() >= 21),
    longWorkout: workouts.some((w) => (w.finishedAt ?? w.startedAt) - w.startedAt > 2 * 3_600_000),
    benchBodyweight: !!bodyweight && maxW('bench-press') >= bodyweight,
    squat100: maxW('squat') >= 100,
    deadlift140: Math.max(maxW('deadlift'), maxW('sumo-deadlift')) >= 140,
    pullups10: maxReps(['pull-up', 'chin-up']) >= 10,
    distinctExercises: distinct.size,
    measurements: measurements.length,
  };
}

export function unlockedIds(stats: AchievementStats): Set<string> {
  return new Set(ACHIEVEMENTS.filter((a) => a.progress(stats) >= 1).map((a) => a.id));
}
