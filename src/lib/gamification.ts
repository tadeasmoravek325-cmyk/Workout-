import type { Exercise, Measurement, Muscle, Workout, WorkoutSet } from '../types';
import type { IconName } from '../components/Icon';
import { e1rm, isWorkingSet, startOfWeek } from './calc';
import { ALL_MUSCLES, muscleLoad } from '../data/exercises';
import { t, tn } from '../i18n';

/* ------------------------------------------------------------------ */
/* Weekly goal history                                                 */
/* ------------------------------------------------------------------ */

/**
 * The weekly goal can change over time. `log` holds [weekStart, goal] pairs in ascending order,
 * so changing the goal today never rewrites XP, streaks or leagues of earlier weeks.
 */
export interface GoalPlan {
  current: number;
  log?: [number, number][];
}
export type GoalInput = number | GoalPlan;

export function goalForWeek(g: GoalInput, week: number): number {
  if (typeof g === 'number') return g;
  let goal: number | undefined;
  for (const [w, v] of g.log ?? []) {
    if (w <= week) goal = v;
    else break;
  }
  return goal ?? g.current;
}

function goalKey(g: GoalInput): string {
  return typeof g === 'number' ? String(g) : `${g.current}|${JSON.stringify(g.log ?? [])}`;
}

/* ------------------------------------------------------------------ */
/* XP and personal records in a single chronological pass              */
/* ------------------------------------------------------------------ */

export const XP = {
  workout: 50,
  set: 3,
  /** Sets beyond this in one workout earn nothing, so junk volume isn't rewarded. */
  setCap: 30,
  pr: 25,
  prCap: 3,
  /** Only the first workouts of a day earn XP. */
  workoutsPerDay: 2,
  goalWeek: 100,
  /** Bonus per week of an unbroken goal run, up to streakCap weeks. */
  streakWeek: 10,
  streakCap: 10,
} as const;

export interface XpBreakdown {
  workout: number;
  sets: number;
  prs: number;
}

export interface WorkoutProgress {
  xp: number;
  breakdown: XpBreakdown;
  /** Exercise ids that reached a new record in this workout. */
  prExercises: string[];
}

export interface Progress {
  totalXp: number;
  totalPrs: number;
  perWorkout: Map<string, WorkoutProgress>;
  /** XP earned per week (start timestamp), quests not included. */
  weekXp: Map<number, number>;
  /** Weeks where the weekly goal was met. */
  goalWeeks: Set<number>;
}

interface Best {
  w: number;
  e: number;
  r: number;
  d: number;
  km: number;
}

/** A finished working set with something actually logged. Empty ticked rows earn nothing. */
export function countsForXp(s: WorkoutSet): boolean {
  return s.done && isWorkingSet(s) && ((s.reps ?? 0) > 0 || (s.durationSec ?? 0) > 0 || (s.distance ?? 0) > 0);
}

/** A workout that counts towards the weekly goal and streak: at least one real working set. */
export function isGoalWorkout(w: Workout): boolean {
  return w.exercises.some((e) => e.sets.some(countsForXp));
}

// A few entries: the game hook and badge stats ask with different goals for the same history.
const progressCache: { key: Workout[]; ex: Map<string, Exercise>; goal: string; now: number; value: Progress }[] = [];

/**
 * XP for every workout plus weekly bonuses, computed from history alone so it never drifts.
 * A record only counts once an exercise has a baseline session.
 */
export function computeProgress(
  workouts: Workout[],
  exMap: Map<string, Exercise>,
  goal: GoalInput,
  now = Date.now(),
  cache = true,
): Progress {
  const gk = goalKey(goal);
  const nowWeek = startOfWeek(now);
  const hit = cache && progressCache.find((c) => c.key === workouts && c.ex === exMap && c.goal === gk && c.now === nowWeek);
  if (hit) return hit.value;
  const best = new Map<string, Best>();
  const perWorkout = new Map<string, WorkoutProgress>();
  const weekXp = new Map<number, number>();
  const weekCount = new Map<number, number>();
  const dayCount = new Map<string, number>();
  let totalXp = 0;
  let totalPrs = 0;
  const ordered = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  for (const w of ordered) {
    const sessionBest = new Map<string, Best>();
    let sets = 0;
    for (const we of w.exercises) {
      const b = sessionBest.get(we.exerciseId) ?? { w: 0, e: 0, r: 0, d: 0, km: 0 };
      for (const s of we.sets) {
        if (!countsForXp(s)) continue;
        sets++;
        const reps = s.reps ?? 0;
        b.w = Math.max(b.w, reps > 0 ? (s.weight ?? 0) : 0);
        b.e = Math.max(b.e, e1rm(s.weight ?? 0, reps));
        b.r = Math.max(b.r, reps);
        b.d = Math.max(b.d, s.durationSec ?? 0);
        b.km = Math.max(b.km, s.distance ?? 0);
      }
      if (b.w || b.e || b.r || b.d || b.km) sessionBest.set(we.exerciseId, b);
    }
    const prExercises: string[] = [];
    for (const [id, cur] of sessionBest) {
      const prev = best.get(id);
      const ex = exMap.get(id);
      if (prev) {
        const type = ex?.type ?? 'weight_reps';
        const better =
          type === 'weight_reps' || type === 'weighted_bodyweight'
            ? cur.w > prev.w + 1e-9 || cur.e > prev.e + 1e-9
            : type === 'reps_only' || type === 'assisted_bodyweight'
              ? cur.r > prev.r
              : type === 'duration'
                ? cur.d > prev.d
                : cur.km > prev.km + 1e-9;
        if (better) prExercises.push(id);
        best.set(id, {
          w: Math.max(prev.w, cur.w),
          e: Math.max(prev.e, cur.e),
          r: Math.max(prev.r, cur.r),
          d: Math.max(prev.d, cur.d),
          km: Math.max(prev.km, cur.km),
        });
      } else best.set(id, cur);
    }
    const day = new Date(w.startedAt).toDateString();
    const nth = dayCount.get(day) ?? 0;
    const eligible = sets > 0 && nth < XP.workoutsPerDay;
    if (sets > 0) dayCount.set(day, nth + 1);
    const breakdown: XpBreakdown = eligible
      ? { workout: XP.workout, sets: Math.min(sets, XP.setCap) * XP.set, prs: Math.min(prExercises.length, XP.prCap) * XP.pr }
      : { workout: 0, sets: 0, prs: 0 };
    const xp = breakdown.workout + breakdown.sets + breakdown.prs;
    totalXp += xp;
    totalPrs += prExercises.length;
    perWorkout.set(w.id, { xp, breakdown, prExercises });
    const wk = startOfWeek(w.startedAt);
    weekXp.set(wk, (weekXp.get(wk) ?? 0) + xp);
    if (sets > 0) weekCount.set(wk, (weekCount.get(wk) ?? 0) + 1);
  }

  // Weekly goal bonus plus a growing bonus for an unbroken run of goal weeks.
  const goalWeeks = new Set<number>();
  if (ordered.length) {
    let run = 0;
    for (let week = startOfWeek(ordered[0].startedAt); week <= nowWeek; week = nextWeek(week)) {
      const met = (weekCount.get(week) ?? 0) >= goalForWeek(goal, week);
      if (met) {
        run++;
        goalWeeks.add(week);
        const bonus = XP.goalWeek + XP.streakWeek * Math.min(run, XP.streakCap);
        totalXp += bonus;
        weekXp.set(week, (weekXp.get(week) ?? 0) + bonus);
      } else if (week !== nowWeek) run = 0;
    }
  }

  const value = { totalXp, totalPrs, perWorkout, weekXp, goalWeeks };
  if (cache) {
    progressCache.unshift({ key: workouts, ex: exMap, goal: gk, now: nowWeek, value });
    progressCache.length = Math.min(progressCache.length, 4);
  }
  return value;
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */

/** Cumulative XP needed to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(150 * Math.pow(level - 1, 1.6));
}

export interface Rank {
  /** Level at which the rank is reached. */
  level: number;
  title: string;
  meaning: string;
  icon: IconName;
}

/**
 * Eleven ranks over the long run. With regular training (~700 XP a week) Gymrat takes about two
 * months, Jacked half a year, Elite over a year, Veteran about three years and Legend about five.
 */
export const RANKS: Rank[] = [
  { level: 1, title: 'Rookie', meaning: 'Just getting started', icon: 'sprout' },
  { level: 3, title: 'Freshman', meaning: 'Gaining the first experience', icon: 'graduation-cap' },
  { level: 6, title: 'Lifter', meaning: 'Training regularly', icon: 'dumbbell' },
  { level: 10, title: 'Gymrat', meaning: 'The gym is a way of life', icon: 'calendar-check' },
  { level: 15, title: 'Grinder', meaning: 'Discipline and hard work', icon: 'bricks' },
  { level: 20, title: 'Jacked', meaning: 'A built physique', icon: 'biceps' },
  { level: 27, title: 'Beast', meaning: 'Strength and intensity', icon: 'flame' },
  { level: 35, title: 'Elite', meaning: 'The elite level', icon: 'shield' },
  { level: 45, title: 'Prime', meaning: 'Peak form', icon: 'zap' },
  { level: 60, title: 'Veteran', meaning: 'Experience and long-term dedication', icon: 'mountain' },
  { level: 80, title: 'Legend', meaning: 'The highest status', icon: 'crown' },
];

export interface LevelInfo {
  level: number;
  title: string;
  icon: IconName;
  /** 1-based position in RANKS. */
  rank: number;
  nextRank?: Rank;
  /** XP inside the current level. */
  current: number;
  /** XP the current level spans. */
  needed: number;
  progress: number;
}

export function rankForLevel(level: number): number {
  let i = 0;
  while (i + 1 < RANKS.length && RANKS[i + 1].level <= level) i++;
  return i;
}

export function levelInfo(totalXp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const r = rankForLevel(level);
  return {
    level,
    title: t(RANKS[r].title),
    icon: RANKS[r].icon,
    rank: r + 1,
    nextRank: RANKS[r + 1],
    current: totalXp - base,
    needed: next - base,
    progress: (totalXp - base) / (next - base),
  };
}

/* ------------------------------------------------------------------ */
/* Weekly streak with freezes                                          */
/* ------------------------------------------------------------------ */

export interface StreakInfo {
  streak: number;
  freezes: number;
  /** Week start timestamps that were saved by a freeze. */
  frozenWeeks: number[];
  best: number;
}

const DAY = 86_400_000;

function prevWeek(week: number) {
  return startOfWeek(week - 3 * DAY);
}
function nextWeek(week: number) {
  return startOfWeek(week + 10 * DAY);
}

/**
 * Weeks in a row meeting the weekly goal. Every 4 successful weeks earn a freeze (max 2)
 * that automatically saves a missed week. The current week never breaks the streak.
 */
export function streakInfo(workouts: Workout[], goal: GoalInput, now = Date.now()): StreakInfo {
  if (!workouts.length) return { streak: 0, freezes: 0, frozenWeeks: [], best: 0 };
  const counts = new Map<number, number>();
  let first = Infinity;
  for (const w of workouts) {
    if (!isGoalWorkout(w)) continue;
    const k = startOfWeek(w.startedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    first = Math.min(first, k);
  }
  if (!counts.size) return { streak: 0, freezes: 0, frozenWeeks: [], best: 0 };
  const current = startOfWeek(now);
  let streak = 0;
  let best = 0;
  let freezes = 0;
  let earnedIn = 0;
  const frozenWeeks: number[] = [];
  for (let week = first; week <= current; week = nextWeek(week)) {
    const met = (counts.get(week) ?? 0) >= goalForWeek(goal, week);
    if (week === current) {
      if (met) streak++;
      break;
    }
    if (met) {
      streak++;
      earnedIn++;
      if (earnedIn >= 4) {
        earnedIn = 0;
        freezes = Math.min(2, freezes + 1);
      }
    } else if (streak > 0 && freezes > 0) {
      freezes--;
      frozenWeeks.push(week);
    } else {
      streak = 0;
      earnedIn = 0;
    }
    best = Math.max(best, streak);
  }
  best = Math.max(best, streak);
  return { streak, freezes, frozenWeeks, best };
}

export { prevWeek };

export interface StreakRisk {
  /** warn: still doable but tight; freeze: can't make it, a freeze will save it; lost: the streak will reset. */
  level: 'warn' | 'freeze' | 'lost';
  needed: number;
  daysLeft: number;
}

/**
 * Whether this week's goal is in danger near the end of the week. Only shown when there is a streak
 * to lose, and only when the user can still act on it (or should know a freeze will be used).
 */
export function streakRisk(workouts: Workout[], goal: GoalInput, streak: StreakInfo, now = Date.now()): StreakRisk | null {
  if (streak.streak <= 0) return null;
  const week = startOfWeek(now);
  const end = nextWeek(week);
  const done = workouts.filter((w) => w.startedAt >= week && w.startedAt < end && isGoalWorkout(w)).length;
  const needed = goalForWeek(goal, week) - done;
  if (needed <= 0) return null;
  // Days left including today; one workout a day is the realistic maximum.
  const daysLeft = Math.max(1, Math.ceil((end - now) / DAY));
  if (needed > daysLeft) return { level: streak.freezes > 0 ? 'freeze' : 'lost', needed, daysLeft };
  if (daysLeft - needed <= 1) return { level: 'warn', needed, daysLeft };
  return null;
}

/* ------------------------------------------------------------------ */
/* Weekly quests                                                       */
/* ------------------------------------------------------------------ */

export interface Quest {
  id: string;
  icon: IconName;
  title: string;
  target: number;
  value: number;
  xp: number;
  done: boolean;
}

interface QuestCtx {
  week: Workout[];
  all: Workout[];
  exMap: Map<string, Exercise>;
  goal: number;
  measurements: Measurement[];
  weekStart: number;
  weekEnd: number;
  prsThisWeek: number;
}

type QuestTemplate = (c: QuestCtx) => Omit<Quest, 'done'>;

const trains = (ex: Exercise | undefined, muscles: Muscle[], min: number) => {
  if (!ex) return false;
  const load = muscleLoad(ex);
  return muscles.some((m) => (load[m] ?? 0) >= min);
};

const muscleSessions = (c: QuestCtx, muscles: Muscle[]) =>
  c.week.filter((w) => w.exercises.some((e) => e.sets.some(countsForXp) && trains(c.exMap.get(e.exerciseId), muscles, 0.75))).length;

const doneSets = (ws: Workout[]) => ws.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter(countsForXp).length, 0), 0);

const QUESTS: QuestTemplate[] = [
  (c) => ({ id: 'sets', icon: 'repeat', title: t('Do {n} working sets', { n: 40 }), target: 40, value: doneSets(c.week), xp: 80 }),
  (c) => ({ id: 'legs', icon: 'footprints', title: t('Train legs {n}× this week', { n: 2 }), target: 2, value: muscleSessions(c, ['quads', 'hamstrings', 'glutes']), xp: 70 }),
  (c) => ({ id: 'pr', icon: 'trophy', title: t('Hit a new PR'), target: 1, value: c.prsThisWeek, xp: 90 }),
  (c) => {
    const before = new Set(c.all.filter((w) => w.startedAt < c.weekStart).flatMap((w) => w.exercises.map((e) => e.exerciseId)));
    const fresh = new Set(c.week.flatMap((w) => w.exercises.filter((e) => !before.has(e.exerciseId)).map((e) => e.exerciseId)));
    return { id: 'new', icon: 'flask', title: t('Try a new exercise'), target: 1, value: fresh.size, xp: 60 };
  },
  (c) => ({
    id: 'early',
    icon: 'sunrise',
    title: t('Early bird workout (start before 9:00)'),
    target: 1,
    value: c.week.filter((w) => new Date(w.startedAt).getHours() < 9).length,
    xp: 60,
  }),
  (c) => ({
    id: 'weigh',
    icon: 'scale',
    title: t('Log your bodyweight'),
    target: 1,
    value: c.measurements.filter((m) => m.type === 'bodyweight' && m.date >= c.weekStart && m.date < c.weekEnd).length,
    xp: 40,
  }),
  (c) => ({ id: 'back', icon: 'shield', title: t('Give your back {n} sets', { n: 12 }), target: 12, value: setsFor(c, ['lats', 'upperBack']), xp: 70 }),
  (c) => ({ id: 'core', icon: 'bricks', title: t('Hit your core with {n} sets', { n: 6 }), target: 6, value: setsFor(c, ['abs', 'obliques']), xp: 50 }),
  (c) => ({
    id: 'long',
    icon: 'hourglass',
    title: t('Train for over {n} minutes', { n: 45 }),
    target: 1,
    value: c.week.filter((w) => (w.finishedAt ?? w.startedAt) - w.startedAt >= 45 * 60_000).length,
    xp: 50,
  }),
];

/** Fractional sets for the muscle group: the biggest share among `muscles` per exercise. */
function setsFor(c: QuestCtx, muscles: Muscle[]) {
  let n = 0;
  for (const w of c.week)
    for (const e of w.exercises) {
      const ex = c.exMap.get(e.exerciseId);
      if (!ex) continue;
      const load = muscleLoad(ex);
      const share = Math.max(...muscles.map((m) => load[m] ?? 0));
      if (share >= 0.5) n += e.sets.filter(countsForXp).length * share;
    }
  return Math.floor(n);
}

function seededPick<T>(items: T[], seed: number, count: number): T[] {
  const arr = [...items];
  let x = seed % 2147483647 || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    x = (x * 48271) % 2147483647;
    const j = x % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

/** Three quests for the week containing `now`, plus the always-on weekly goal quest. */
export function weeklyQuests(
  workouts: Workout[],
  exMap: Map<string, Exercise>,
  goalInput: GoalInput,
  measurements: Measurement[],
  now = Date.now(),
): Quest[] {
  const weekStart = startOfWeek(now);
  const weekEnd = nextWeek(weekStart);
  const goal = goalForWeek(goalInput, weekStart);
  const week = workouts.filter((w) => w.startedAt >= weekStart && w.startedAt < weekEnd && isGoalWorkout(w));
  const progress = computeProgress(workouts, exMap, goalInput);
  const prsThisWeek = week.reduce((a, w) => a + (progress.perWorkout.get(w.id)?.prExercises.length ?? 0), 0);
  const ctx: QuestCtx = { week, all: workouts, exMap, goal, measurements, weekStart, weekEnd, prsThisWeek };
  const seed = Math.floor(weekStart / (7 * DAY)) + 7919;
  const main: Omit<Quest, 'done'> = {
    id: 'goal',
    icon: 'target',
    title: tn(goal, 'Hit your weekly goal ({n} workout)', 'Hit your weekly goal ({n} workouts)'),
    target: goal,
    value: week.length,
    xp: XP.goalWeek,
  };
  return [main, ...seededPick(QUESTS, seed, 3).map((tpl) => tpl(ctx))].map((q) => ({
    ...q,
    value: Math.min(q.value, q.target),
    done: q.value >= q.target,
  }));
}

let questCache: { w: Workout[]; ex: Map<string, Exercise>; m: Measurement[]; goal: string; value: Map<number, number> } | null = null;

/** XP from completed side quests per week (the weekly-goal quest is already part of computeProgress). */
export function questXpByWeek(workouts: Workout[], exMap: Map<string, Exercise>, goal: GoalInput, measurements: Measurement[]): Map<number, number> {
  const gk = goalKey(goal);
  if (questCache && questCache.w === workouts && questCache.ex === exMap && questCache.m === measurements && questCache.goal === gk) return questCache.value;
  const weeks = new Set(workouts.map((w) => startOfWeek(w.startedAt)));
  const value = new Map<number, number>();
  for (const week of weeks) {
    let xp = 0;
    for (const q of weeklyQuests(workouts, exMap, goal, measurements, week + 2 * DAY)) if (q.id !== 'goal' && q.done) xp += q.xp;
    if (xp) value.set(week, xp);
  }
  questCache = { w: workouts, ex: exMap, m: measurements, goal: gk, value };
  return value;
}

export function questXp(workouts: Workout[], exMap: Map<string, Exercise>, goal: GoalInput, measurements: Measurement[]): number {
  let xp = 0;
  for (const v of questXpByWeek(workouts, exMap, goal, measurements).values()) xp += v;
  return xp;
}

/* ------------------------------------------------------------------ */
/* Weekly league                                                       */
/* ------------------------------------------------------------------ */

export interface Division {
  id: string;
  name: string;
  color: string;
  /** Colour for the emblem drawn on the badge, readable on `color`. */
  ink: string;
  kind: 'metal' | 'gem' | 'crown';
}

/**
 * Ten divisions: five metals, four gems, then Champion. Reaching the top takes at least nine strong
 * weeks in a row, and every step up raises both the promotion and the keep line.
 */
export const DIVISIONS: Division[] = [
  { id: 'iron', name: 'Iron', color: '#8a8f96', ink: '#1a1a1a', kind: 'metal' },
  { id: 'bronze', name: 'Bronze', color: '#c8814a', ink: '#ffffff', kind: 'metal' },
  { id: 'silver', name: 'Silver', color: '#b9c3cc', ink: '#1a1a1a', kind: 'metal' },
  { id: 'gold', name: 'Gold', color: '#ffc23d', ink: '#1a1a1a', kind: 'metal' },
  { id: 'platinum', name: 'Platinum', color: '#62d6c8', ink: '#1a1a1a', kind: 'metal' },
  { id: 'emerald', name: 'Emerald', color: '#2fbf71', ink: '#ffffff', kind: 'gem' },
  { id: 'ruby', name: 'Ruby', color: '#e5374a', ink: '#ffffff', kind: 'gem' },
  { id: 'sapphire', name: 'Sapphire', color: '#3d7bff', ink: '#ffffff', kind: 'gem' },
  { id: 'diamond', name: 'Diamond', color: '#a9e6ff', ink: '#1a1a1a', kind: 'gem' },
  { id: 'champion', name: 'Champion', color: '#ff5a1f', ink: '#ffffff', kind: 'crown' },
];

/**
 * Weekly XP needed to move up from `division`. Scales with the weekly goal so every plan is fair:
 * at 3 workouts a week that is 400 XP in Iron rising to 1,040 XP to reach Champion.
 */
export function promoteXp(division: number, goal: number): number {
  return Math.round(((goal * 100 + 100) * (1 + 0.2 * division)) / 10) * 10;
}

/** Weekly XP needed to stay in `division`; the share grows from 34 % to 66 % of the promotion line. */
export function keepXp(division: number, goal: number): number {
  return division === 0 ? 0 : Math.round((promoteXp(division, goal) * (0.3 + 0.04 * division)) / 10) * 10;
}

export interface LeagueWeek {
  week: number;
  xp: number;
  from: number;
  to: number;
}

export interface LeagueInfo {
  division: number;
  weekXp: number;
  promoteAt: number;
  keepAt: number;
  /** Resolved weeks, oldest first. */
  history: LeagueWeek[];
  /** When the current league week ends. */
  endsAt: number;
}

/**
 * Replays every week since the first workout: above the promotion line moves up a division,
 * below the keep line moves down. The current week is still open.
 */
export function leagueInfo(weekXp: Map<number, number>, goal: GoalInput, now = Date.now()): LeagueInfo {
  const current = startOfWeek(now);
  const history: LeagueWeek[] = [];
  let division = 0;
  const first = Math.min(...weekXp.keys());
  if (Number.isFinite(first)) {
    for (let week = first; week < current; week = nextWeek(week)) {
      const xp = weekXp.get(week) ?? 0;
      const g = goalForWeek(goal, week);
      let to = division;
      if (division < DIVISIONS.length - 1 && xp >= promoteXp(division, g)) to = division + 1;
      else if (xp < keepXp(division, g)) to = Math.max(0, division - 1);
      history.push({ week, xp, from: division, to });
      division = to;
    }
  }
  const g = goalForWeek(goal, current);
  return {
    division,
    weekXp: weekXp.get(current) ?? 0,
    promoteAt: division < DIVISIONS.length - 1 ? promoteXp(division, g) : Infinity,
    keepAt: keepXp(division, g),
    history,
    endsAt: nextWeek(current),
  };
}

/* ------------------------------------------------------------------ */
/* Muscle levels and form                                              */
/* ------------------------------------------------------------------ */

/** Lifetime fractional sets needed for muscle levels 1..10. */
export const MUSCLE_LEVELS = [1, 10, 30, 60, 100, 160, 240, 350, 500, 700];
/** Form halves after this many days without training, roughly how fast detraining shows. */
export const FORM_HALF_LIFE_DAYS = 14;
/** Decayed sets that count as full form: about 10 sets a week, kept up. */
const FULL_FORM = 30;

export interface MuscleForm {
  /** 0 until the first set, then 1..10. Never goes down. */
  level: number;
  lifetime: number;
  /** Lifetime sets needed for the next level, undefined at max. */
  nextAt?: number;
  /** 0..1, fades when the muscle is not trained. */
  form: number;
}

export function muscleForms(workouts: Workout[], exMap: Map<string, Exercise>, now = Date.now()): Record<Muscle, MuscleForm> {
  const lifetime = {} as Record<Muscle, number>;
  const decayed = {} as Record<Muscle, number>;
  for (const w of workouts) {
    const age = Math.max(0, now - w.startedAt) / DAY;
    const weight = Math.pow(0.5, age / FORM_HALF_LIFE_DAYS);
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      const n = we.sets.filter(countsForXp).length;
      if (!n) continue;
      for (const [m, share] of Object.entries(muscleLoad(ex)) as [Muscle, number][]) {
        lifetime[m] = (lifetime[m] ?? 0) + n * share;
        decayed[m] = (decayed[m] ?? 0) + n * share * weight;
      }
    }
  }
  const out = {} as Record<Muscle, MuscleForm>;
  for (const m of ALL_MUSCLES) {
    const total = lifetime[m] ?? 0;
    const level = MUSCLE_LEVELS.filter((x) => total >= x).length;
    out[m] = { level, lifetime: total, nextAt: MUSCLE_LEVELS[level], form: Math.min(1, (decayed[m] ?? 0) / FULL_FORM) };
  }
  return out;
}
