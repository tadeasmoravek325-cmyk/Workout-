import type { Exercise, Measurement, Workout } from '../types';
import type { IconName } from '../components/Icon';
import { computeRecords, exerciseHistory, workoutVolume } from './calc';
import { computeProgress } from './gamification';
import { LOCALE_TAG, t, tn } from '../i18n';

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
  /** Workouts started before 7 am. */
  earlyCount: number;
  /** Workouts started at 9 pm or later. */
  nightCount: number;
  /** Workouts longer than 2 hours. */
  longCount: number;
  /** Personal records, counted the same way as for XP (an exercise needs a baseline first). */
  prCount: number;
  squatMax: number;
  deadliftMax: number;
  benchMax: number;
  /** Latest logged bodyweight in kg, 0 when unknown. */
  bodyweight: number;
  /** Best bench press divided by bodyweight, 0 when bodyweight is unknown. */
  benchRatio: number;
  pullupMaxReps: number;
}

/** Medal metal by tier, cheapest first. */
export type Metal = 'bronze' | 'silver' | 'gold' | 'platinum';

/** Centre picture of a medal; drawn by `Medal`. */
export type Motif =
  | 'flag'
  | 'dumbbell'
  | 'flame'
  | 'trophy'
  | 'kettlebell'
  | 'clock'
  | 'tally'
  | 'sunrise'
  | 'moon'
  | 'hourglass'
  | 'squat'
  | 'deadlift'
  | 'bench'
  | 'pullup'
  | 'variety'
  | 'ruler';

export interface Tier {
  /** Stable badge id. Older single badges kept their id as one of the tiers. */
  id: string;
  goal: number;
}

export type FamilyGroup = 'consistency' | 'strength' | 'habits';

export interface AchievementFamily {
  id: string;
  group: FamilyGroup;
  /** English source name, translate with t(). Tiers get a Roman numeral appended. */
  name: string;
  motif: Motif;
  icon: IconName;
  tiers: Tier[];
  /** Current value of the measured quantity. */
  value: (s: AchievementStats) => number;
  /** Sentence for a single tier, already translated. */
  describe: (goal: number) => string;
  /** "37 / 50 workouts", already translated. */
  progressLabel: (value: number, goal: number) => string;
  /** Replaces the progress label when the family can't be tracked yet. */
  hint?: (s: AchievementStats) => string | undefined;
}

export interface Achievement {
  id: string;
  familyId: string;
  /** 0-based tier index inside the family. */
  tier: number;
  tierCount: number;
  metal: Metal;
  motif: Motif;
  icon: IconName;
  goal: number;
  /** "Regular II"; translated on access. */
  readonly title: string;
  readonly description: string;
  /** 0..1 */
  progress: (s: AchievementStats) => number;
}

function ratio(v: number, target: number) {
  return Math.max(0, Math.min(1, v / target));
}

const num = (n: number, digits = 0) => (Math.floor(n * 10 ** digits) / 10 ** digits).toLocaleString(LOCALE_TAG, { maximumFractionDigits: digits });

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Metals used by a family with `count` tiers: 1 tier is gold, 3 stop at gold, 4 reach platinum. */
export function metalsFor(count: number): Metal[] {
  if (count <= 1) return ['gold'];
  if (count === 2) return ['silver', 'gold'];
  if (count === 3) return ['bronze', 'silver', 'gold'];
  return ['bronze', 'silver', 'gold', 'platinum'].slice(0, count) as Metal[];
}

export const FAMILIES: AchievementFamily[] = [
  {
    id: 'first',
    group: 'consistency',
    name: 'First step',
    motif: 'flag',
    icon: 'flag',
    tiers: [{ id: 'first', goal: 1 }],
    value: (s) => s.workouts,
    describe: () => t('Finish your first workout.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} workout', '{v} / {n} workouts', { v: num(Math.min(v, g)) }),
  },
  {
    id: 'workouts',
    group: 'consistency',
    name: 'Regular',
    motif: 'dumbbell',
    icon: 'dumbbell',
    tiers: [
      { id: 'w10', goal: 10 },
      { id: 'w50', goal: 50 },
      { id: 'w100', goal: 100 },
      { id: 'w250', goal: 250 },
    ],
    value: (s) => s.workouts,
    describe: (g) => tn(g, 'Finish {n} workout.', 'Finish {n} workouts.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} workout', '{v} / {n} workouts', { v: num(Math.min(v, g)) }),
  },
  {
    id: 'streak',
    group: 'consistency',
    name: 'On a roll',
    motif: 'flame',
    icon: 'flame',
    tiers: [
      { id: 'streak', goal: 4 },
      { id: 'streak12', goal: 12 },
      { id: 'streak26', goal: 26 },
      { id: 'streak52', goal: 52 },
    ],
    value: (s) => s.bestWeekStreak,
    describe: (g) => tn(g, 'Train at least once a week for {n} week in a row.', 'Train at least once a week for {n} weeks in a row.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} week in a row', '{v} / {n} weeks in a row', { v: num(Math.min(v, g)) }),
  },
  {
    id: 'prs',
    group: 'strength',
    name: 'Record breaker',
    motif: 'trophy',
    icon: 'trophy',
    tiers: [
      { id: 'pr10', goal: 10 },
      { id: 'pr50', goal: 50 },
      { id: 'pr150', goal: 150 },
      { id: 'pr500', goal: 500 },
    ],
    value: (s) => s.prCount,
    describe: (g) => tn(g, 'Set {n} personal record.', 'Set {n} personal records.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} record', '{v} / {n} records', { v: num(Math.min(v, g)) }),
  },
  {
    id: 'volume',
    group: 'strength',
    name: 'Tonnage',
    motif: 'kettlebell',
    icon: 'bricks',
    tiers: [
      { id: 'v10t', goal: 10_000 },
      { id: 'v100t', goal: 100_000 },
      { id: 'v1000t', goal: 1_000_000 },
      { id: 'v5000t', goal: 5_000_000 },
    ],
    value: (s) => s.totalVolumeKg,
    describe: (g) => tn(g / 1000, 'Lift {n} tonne in total.', 'Lift {n} tonnes in total.', { n: num(g / 1000) }),
    progressLabel: (v, g) => t('{v} / {g} t', { v: num(Math.min(v, g) / 1000, 1), g: num(g / 1000) }),
  },
  {
    id: 'hours',
    group: 'consistency',
    name: 'Gym time',
    motif: 'clock',
    icon: 'timer',
    tiers: [
      { id: 'h10', goal: 10 * 60 },
      { id: 'h24', goal: 24 * 60 },
      { id: 'h100', goal: 100 * 60 },
      { id: 'h250', goal: 250 * 60 },
    ],
    value: (s) => s.totalMinutes,
    describe: (g) => tn(g / 60, 'Train for {n} hour in total.', 'Train for {n} hours in total.'),
    progressLabel: (v, g) => tn(g / 60, '{v} / {n} hour', '{v} / {n} hours', { v: num(Math.min(v, g) / 60) }),
  },
  {
    id: 'sets',
    group: 'consistency',
    name: 'Set machine',
    motif: 'tally',
    icon: 'repeat',
    tiers: [
      { id: 's250', goal: 250 },
      { id: 's1000', goal: 1000 },
      { id: 's5000', goal: 5000 },
    ],
    value: (s) => s.totalSets,
    describe: (g) => tn(g, 'Complete {n} set.', 'Complete {n} sets.', { n: num(g) }),
    progressLabel: (v, g) => tn(g, '{v} / {n} set', '{v} / {n} sets', { v: num(Math.min(v, g)), n: num(g) }),
  },
  {
    id: 'early',
    group: 'habits',
    name: 'Early bird',
    motif: 'sunrise',
    icon: 'sunrise',
    tiers: [
      { id: 'early', goal: 1 },
      { id: 'early5', goal: 5 },
      { id: 'early25', goal: 25 },
      { id: 'early100', goal: 100 },
    ],
    value: (s) => s.earlyCount,
    describe: (g) => tn(g, 'Start a workout before 7 am.', 'Start {n} workouts before 7 am.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} early workout', '{v} / {n} early workouts', { v: num(Math.min(v, g)) }),
  },
  {
    id: 'night',
    group: 'habits',
    name: 'Night owl',
    motif: 'moon',
    icon: 'moon',
    tiers: [
      { id: 'night', goal: 1 },
      { id: 'night5', goal: 5 },
      { id: 'night25', goal: 25 },
    ],
    value: (s) => s.nightCount,
    describe: (g) => tn(g, 'Start a workout after 9 pm.', 'Start {n} workouts after 9 pm.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} late workout', '{v} / {n} late workouts', { v: num(Math.min(v, g)) }),
  },
  {
    id: 'long',
    group: 'habits',
    name: 'Marathon',
    motif: 'hourglass',
    icon: 'hourglass',
    tiers: [
      { id: 'long', goal: 1 },
      { id: 'long5', goal: 5 },
      { id: 'long20', goal: 20 },
    ],
    value: (s) => s.longCount,
    describe: (g) => tn(g, 'Finish a workout longer than 2 hours.', 'Finish {n} workouts longer than 2 hours.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} long workout', '{v} / {n} long workouts', { v: num(Math.min(v, g)) }),
  },
  {
    id: 'squat',
    group: 'strength',
    name: 'Squat',
    motif: 'squat',
    icon: 'footprints',
    tiers: [
      { id: 'squat60', goal: 60 },
      { id: 'squat100', goal: 100 },
      { id: 'squat140', goal: 140 },
      { id: 'squat180', goal: 180 },
    ],
    value: (s) => s.squatMax,
    describe: (g) => t('Squat {n} kg.', { n: num(g) }),
    progressLabel: (v, g) => t('{v} / {g} kg squat', { v: num(Math.min(v, g), 1), g: num(g) }),
  },
  {
    id: 'deadlift',
    group: 'strength',
    name: 'Deadlift',
    motif: 'deadlift',
    icon: 'anchor',
    tiers: [
      { id: 'dl100', goal: 100 },
      { id: 'dl140', goal: 140 },
      { id: 'dl180', goal: 180 },
      { id: 'dl220', goal: 220 },
    ],
    value: (s) => s.deadliftMax,
    describe: (g) => t('Deadlift {n} kg.', { n: num(g) }),
    progressLabel: (v, g) => t('{v} / {g} kg deadlift', { v: num(Math.min(v, g), 1), g: num(g) }),
  },
  {
    id: 'bench',
    group: 'strength',
    name: 'Bench vs bodyweight',
    motif: 'bench',
    icon: 'weight',
    tiers: [
      { id: 'bench-075', goal: 0.75 },
      { id: 'bench-bw', goal: 1 },
      { id: 'bench-125', goal: 1.25 },
      { id: 'bench-150', goal: 1.5 },
    ],
    value: (s) => s.benchRatio,
    describe: (g) =>
      g === 1 ? t('Bench press at least your own bodyweight.') : t('Bench press {n}× your bodyweight.', { n: num(g, 2) }),
    progressLabel: (v, g) => t('{v} / {g}× bodyweight', { v: num(Math.min(v, g), 2), g: num(g, 2) }),
    hint: (s) => (s.bodyweight > 0 ? undefined : t('Log your bodyweight to track this')),
  },
  {
    id: 'pullups',
    group: 'strength',
    name: 'Pull-ups',
    motif: 'pullup',
    icon: 'mountain',
    tiers: [
      { id: 'pull5', goal: 5 },
      { id: 'pull10', goal: 10 },
      { id: 'pull15', goal: 15 },
      { id: 'pull20', goal: 20 },
    ],
    value: (s) => s.pullupMaxReps,
    describe: (g) => tn(g, 'Do {n} pull-up in a single set.', 'Do {n} pull-ups in a single set.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} rep in one set', '{v} / {n} reps in one set', { v: num(Math.min(v, g)) }),
  },
  {
    id: 'variety',
    group: 'habits',
    name: 'Variety',
    motif: 'variety',
    icon: 'layers',
    tiers: [
      { id: 'variety10', goal: 10 },
      { id: 'variety', goal: 25 },
      { id: 'variety50', goal: 50 },
    ],
    value: (s) => s.distinctExercises,
    describe: (g) => tn(g, 'Try {n} different exercise.', 'Try {n} different exercises.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} exercise', '{v} / {n} exercises', { v: num(Math.min(v, g)) }),
  },
  {
    id: 'measure',
    group: 'habits',
    name: 'Self-tracker',
    motif: 'ruler',
    icon: 'ruler',
    tiers: [
      { id: 'measure', goal: 10 },
      { id: 'measure30', goal: 30 },
      { id: 'measure100', goal: 100 },
    ],
    value: (s) => s.measurements,
    describe: (g) => tn(g, 'Log {n} body measurement.', 'Log {n} body measurements.'),
    progressLabel: (v, g) => tn(g, '{v} / {n} measurement', '{v} / {n} measurements', { v: num(Math.min(v, g)) }),
  },
];

const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));

export function familyOf(a: Pick<Achievement, 'familyId'>): AchievementFamily {
  return FAMILY_BY_ID.get(a.familyId)!;
}

function tierTitle(f: AchievementFamily, i: number): string {
  return f.tiers.length > 1 ? `${t(f.name)} ${ROMAN[i] ?? i + 1}` : t(f.name);
}

/** Every tier of every family as its own unlockable badge. */
export const ACHIEVEMENTS: Achievement[] = FAMILIES.flatMap((f) => {
  const metals = metalsFor(f.tiers.length);
  return f.tiers.map(
    (tier, i): Achievement => ({
      id: tier.id,
      familyId: f.id,
      tier: i,
      tierCount: f.tiers.length,
      metal: metals[i],
      motif: f.motif,
      icon: f.icon,
      goal: tier.goal,
      get title() {
        return tierTitle(f, i);
      },
      get description() {
        return f.describe(tier.goal);
      },
      progress: (s) => ratio(f.value(s), tier.goal),
    }),
  );
});

/** "37 / 50 workouts" for a single badge. */
export function achievementProgressLabel(a: Achievement, s: AchievementStats): string {
  const f = familyOf(a);
  return f.hint?.(s) ?? f.progressLabel(f.value(s), a.goal);
}

export interface FamilyStatus {
  family: AchievementFamily;
  /** Badges of this family in tier order. */
  tiers: Achievement[];
  value: number;
  /** Highest tier reached, -1 when none. */
  reached: number;
  /** Highest reached badge, if any. */
  current?: Achievement;
  /** Next badge to unlock; undefined when the family is complete. */
  next?: Achievement;
  /** 0..1 towards `next` (1 when complete). */
  progress: number;
  /** "37 / 50 workouts" towards `next`, or towards the top tier when complete. */
  label: string;
}

export function familyStatus(f: AchievementFamily, s: AchievementStats): FamilyStatus {
  const tiers = ACHIEVEMENTS.filter((a) => a.familyId === f.id);
  const value = f.value(s);
  let reached = -1;
  tiers.forEach((a, i) => {
    if (value >= a.goal) reached = i;
  });
  const current = reached >= 0 ? tiers[reached] : undefined;
  const next = tiers[reached + 1];
  const target = next ?? tiers[tiers.length - 1];
  return {
    family: f,
    tiers,
    value,
    reached,
    current,
    next,
    progress: next ? ratio(value, next.goal) : 1,
    label: f.hint?.(s) ?? f.progressLabel(value, target.goal),
  };
}

export function allFamilyStatus(s: AchievementStats): FamilyStatus[] {
  return FAMILIES.map((f) => familyStatus(f, s));
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

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

let statsCache: { workouts: Workout[]; exMap: Map<string, Exercise>; measurements: Measurement[]; value: AchievementStats } | null = null;

/** Stats behind every badge. Repeated calls with the same arrays are served from a one-entry cache. */
export function achievementStats(workouts: Workout[], exMap: Map<string, Exercise>, measurements: Measurement[]): AchievementStats {
  if (statsCache && statsCache.workouts === workouts && statsCache.exMap === exMap && statsCache.measurements === measurements) {
    return statsCache.value;
  }
  const value = computeStats(workouts, exMap, measurements);
  statsCache = { workouts, exMap, measurements, value };
  return value;
}

function computeStats(workouts: Workout[], exMap: Map<string, Exercise>, measurements: Measurement[], cache = true): AchievementStats {
  const bodyweight = [...measurements].sort((a, b) => a.date - b.date).reverse().find((m) => m.type === 'bodyweight')?.value ?? 0;
  const maxW = (id: string) => computeRecords(exerciseHistory(workouts, id)).maxWeight;
  const maxReps = (ids: string[]) => Math.max(0, ...ids.map((id) => computeRecords(exerciseHistory(workouts, id)).maxReps));
  const distinct = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  const hour = (w: Workout) => new Date(w.startedAt).getHours();
  const isLong = (w: Workout) => (w.finishedAt ?? w.startedAt) - w.startedAt > 2 * 3_600_000;
  const earlyCount = workouts.filter((w) => hour(w) < 7).length;
  const nightCount = workouts.filter((w) => hour(w) >= 21).length;
  const longCount = workouts.filter(isLong).length;
  const squatMax = maxW('squat');
  const deadliftMax = Math.max(maxW('deadlift'), maxW('sumo-deadlift'));
  const benchMax = maxW('bench-press');
  const pullupMaxReps = maxReps(['pull-up', 'chin-up']);
  return {
    workouts: workouts.length,
    totalVolumeKg: workouts.reduce((a, w) => a + workoutVolume(w, exMap), 0),
    totalSets: workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter((s) => s.done).length, 0), 0),
    totalMinutes: workouts.reduce((a, w) => a + ((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000, 0),
    bestWeekStreak: maxConsecutiveWeeks(workouts),
    earlyBird: earlyCount > 0,
    nightOwl: nightCount > 0,
    longWorkout: longCount > 0,
    benchBodyweight: bodyweight > 0 && benchMax >= bodyweight,
    squat100: squatMax >= 100,
    deadlift140: deadliftMax >= 140,
    pullups10: pullupMaxReps >= 10,
    distinctExercises: distinct.size,
    measurements: measurements.length,
    earlyCount,
    nightCount,
    longCount,
    prCount: workouts.length ? computeProgress(workouts, exMap, 3, Date.now(), cache).totalPrs : 0,
    squatMax,
    deadliftMax,
    benchMax,
    bodyweight,
    benchRatio: bodyweight > 0 ? benchMax / bodyweight : 0,
    pullupMaxReps,
  };
}

export function unlockedIds(stats: AchievementStats): Set<string> {
  return new Set(ACHIEVEMENTS.filter((a) => a.progress(stats) >= 1).map((a) => a.id));
}

/**
 * When each tier of a family was first reached, by replaying history.
 * Uses a binary search over the timeline, so it assumes the family's value only grows over time
 * (true for everything except bench vs bodyweight, where it gives a reasonable date).
 */
export function tierDates(
  f: AchievementFamily,
  workouts: Workout[],
  exMap: Map<string, Exercise>,
  measurements: Measurement[],
): (number | undefined)[] {
  const times = [...new Set([...workouts.map((w) => w.startedAt), ...measurements.map((m) => m.date)])].sort((a, b) => a - b);
  const valueAt = (i: number) =>
    f.value(
      computeStats(
        workouts.filter((w) => w.startedAt <= times[i]),
        exMap,
        measurements.filter((m) => m.date <= times[i]),
        false,
      ),
    );
  const memo = new Map<number, number>();
  const at = (i: number) => {
    if (!memo.has(i)) memo.set(i, valueAt(i));
    return memo.get(i)!;
  };
  return f.tiers.map((tier) => {
    if (!times.length || at(times.length - 1) < tier.goal) return undefined;
    let lo = 0;
    let hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (at(mid) >= tier.goal) hi = mid;
      else lo = mid + 1;
    }
    return times[lo];
  });
}
