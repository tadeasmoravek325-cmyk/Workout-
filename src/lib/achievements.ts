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
  { id: 'first', icon: 'flag', title: 'První krok', description: 'Dokonči první trénink.', progress: (s) => ratio(s.workouts, 1) },
  { id: 'w10', icon: 'biceps', title: 'Rozjezd', description: 'Dokonči 10 tréninků.', progress: (s) => ratio(s.workouts, 10) },
  { id: 'w50', icon: 'dumbbell', title: 'Pravidelný návštěvník', description: 'Dokonči 50 tréninků.', progress: (s) => ratio(s.workouts, 50) },
  { id: 'w100', icon: 'trophy', title: 'Stovka', description: 'Dokonči 100 tréninků.', progress: (s) => ratio(s.workouts, 100) },
  { id: 'w250', icon: 'crown', title: 'Legenda posilovny', description: 'Dokonči 250 tréninků.', progress: (s) => ratio(s.workouts, 250) },
  { id: 'v10t', icon: 'bricks', title: '10 tun', description: 'Zvedni celkem 10 000 kg.', progress: (s) => ratio(s.totalVolumeKg, 10_000) },
  { id: 'v100t', icon: 'truck', title: 'Náklaďák', description: 'Zvedni celkem 100 000 kg.', progress: (s) => ratio(s.totalVolumeKg, 100_000) },
  { id: 'v1000t', icon: 'ship', title: 'Zaoceánská loď', description: 'Zvedni celkem 1 000 000 kg.', progress: (s) => ratio(s.totalVolumeKg, 1_000_000) },
  { id: 's1000', icon: 'repeat', title: 'Tisíc sérií', description: 'Odcvič 1 000 sérií.', progress: (s) => ratio(s.totalSets, 1000) },
  { id: 'h24', icon: 'timer', title: 'Celý den v posilovně', description: 'Natrénuj celkem 24 hodin.', progress: (s) => ratio(s.totalMinutes, 24 * 60) },
  { id: 'streak', icon: 'flame', title: 'V tahu', description: 'Trénuj 4 týdny po sobě alespoň jednou týdně.', progress: (s) => ratio(s.bestWeekStreak, 4) },
  { id: 'early', icon: 'sunrise', title: 'Ranní ptáče', description: 'Začni trénink před 7. hodinou ráno.', progress: (s) => (s.earlyBird ? 1 : 0) },
  { id: 'night', icon: 'moon', title: 'Noční sova', description: 'Začni trénink po 21. hodině.', progress: (s) => (s.nightOwl ? 1 : 0) },
  { id: 'long', icon: 'hourglass', title: 'Maraton', description: 'Odcvič trénink delší než 2 hodiny.', progress: (s) => (s.longWorkout ? 1 : 0) },
  { id: 'bench-bw', icon: 'weight', title: 'Vlastní váha na benchi', description: 'Zvedni na bench pressu alespoň svou tělesnou hmotnost.', progress: (s) => (s.benchBodyweight ? 1 : 0) },
  { id: 'squat100', icon: 'footprints', title: 'Stovka na dřepu', description: 'Dřepni 100 kg.', progress: (s) => (s.squat100 ? 1 : 0) },
  { id: 'dl140', icon: 'anchor', title: 'Tři plotny', description: 'Mrtvý tah 140 kg.', progress: (s) => (s.deadlift140 ? 1 : 0) },
  { id: 'pull10', icon: 'mountain', title: 'Deset shybů', description: 'Udělej 10 shybů v jedné sérii.', progress: (s) => (s.pullups10 ? 1 : 0) },
  { id: 'variety', icon: 'layers', title: 'Pestrost', description: 'Vyzkoušej 25 různých cviků.', progress: (s) => ratio(s.distinctExercises, 25) },
  { id: 'measure', icon: 'ruler', title: 'Sleduju se', description: 'Zapiš 10 měření těla.', progress: (s) => ratio(s.measurements, 10) },
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
