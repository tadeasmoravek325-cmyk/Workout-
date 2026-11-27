import type { Session } from '../history';
import { isLoggedWorkingSet, workSetVolume } from '../metrics';

/**
 * The one definition of "is this lift progressing, stuck or going backwards".
 * It looks only at what was actually lifted: the best set of each session, not an estimate. Sessions are only
 * compared with sessions done in the same position in the workout (first work for the muscle, or after other work
 * for it), because the same lift is not the same effort when the muscle is already tired.
 *
 * Thresholds are heuristics, not published standards.
 */
export const TREND = {
  /** Sessions that make up the window being judged. */
  recent: 3,
  /** The baseline is the best of this many sessions just before the window, not the all-time best. */
  baselineSessions: 8,
  /** Fewest earlier sessions needed before a plateau can be called. */
  minBaseline: 2,
  /** The window must span at least this many days, so a few sessions in one week prove nothing. */
  minSpanDays: 14,
  /** Work volume within this fraction of the baseline counts as no extra work. */
  volumeTolerance: 0.005,
  /** Three falling sessions in a row need a lower weight, or this many fewer reps at the same weight. */
  declineReps: 2,
  /** Earlier working sets on the same muscles from which a lift counts as done after other work. */
  fatiguedSets: 3,
} as const;

export type Slot = 'fresh' | 'fatigued';

/** Fresh: little or no earlier work for the muscle in that workout. Fatigued: three or more sets before it. */
export function slotOf(priorSets: number | undefined): Slot | undefined {
  if (priorSets === undefined) return undefined;
  return priorSets < TREND.fatiguedSets ? 'fresh' : 'fatigued';
}

export interface BestSet {
  weight: number;
  reps: number;
}

/** Heavier wins; at the same weight more reps wins. */
export function compareBest(a: BestSet, b: BestSet): number {
  if (Math.abs(a.weight - b.weight) > 0.01) return a.weight > b.weight ? 1 : -1;
  return Math.sign(a.reps - b.reps);
}

export interface TrendPoint {
  date: number;
  /** Heaviest working set of the session that reached the lower end of the rep range. */
  best: BestSet;
  /** Work volume of the session (working sets only). */
  volume: number;
  /** Working sets done earlier in that workout on the same muscles, when known. */
  priorSets?: number;
  slot?: Slot;
  /** True when no set reached the rep range, so the heaviest set overall was used. */
  belowRange: boolean;
}

export type TrendState = 'insufficient' | 'improving' | 'stagnation' | 'decline';

export interface Trend {
  state: TrendState;
  recentBest: BestSet | null;
  /** Baseline best (for a decline: the oldest of the three falling sessions). */
  baselineBest: BestSet | null;
  /** Recent best minus baseline best: kilograms, and reps when the weight is the same. */
  delta: { weight: number; reps: number } | null;
  /** Work volume went up although the best set did not. */
  moreWork: boolean;
  spanDays: number;
  /** The position the verdict applies to. */
  slot?: Slot;
  /** True when there were not enough sessions in that position, so all sessions were compared. */
  mixed: boolean;
}

/**
 * Session points, newest first. `repMin` is the bottom of the target rep range: a set only counts as the best
 * set when it reached it (a heavy single is not "the working set" of a 8 to 12 rep exercise).
 */
export function trendPoints(sessions: Session[], repMin = 1, opts: { zeroWeight?: boolean } = {}): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (const s of sessions) {
    const work = s.sets.filter((x) => isLoggedWorkingSet(x) && (x.reps ?? 0) > 0 && ((x.weight ?? 0) > 0 || opts.zeroWeight));
    if (!work.length) continue;
    const inRange = work.filter((x) => (x.reps ?? 0) >= repMin);
    const pool = inRange.length ? inRange : work;
    const best = pool.reduce<BestSet>(
      (b, x) => {
        const c = { weight: x.weight ?? 0, reps: x.reps ?? 0 };
        return compareBest(c, b) > 0 ? c : b;
      },
      { weight: 0, reps: 0 },
    );
    out.push({ date: s.date, best, volume: work.reduce((a, x) => a + workSetVolume(x), 0), priorSets: s.priorSets, slot: slotOf(s.priorSets), belowRange: !inRange.length });
  }
  return out;
}

const bestOf = (ps: TrendPoint[]): BestSet => ps.reduce<BestSet>((b, p) => (compareBest(p.best, b) > 0 ? p.best : b), { weight: 0, reps: 0 });

/** `points` newest first. `slot` is the position to judge; it defaults to that of the newest session. */
export function analyzeTrend(points: TrendPoint[], opts: { slot?: Slot } = {}): Trend {
  const none: Trend = { state: 'insufficient', recentBest: null, baselineBest: null, delta: null, moreWork: false, spanDays: 0, slot: opts.slot, mixed: false };
  const slot = opts.slot ?? points[0]?.slot;
  const enough = TREND.recent + TREND.minBaseline;
  const same = slot ? points.filter((p) => p.slot === slot) : points;
  const useSame = slot !== undefined && same.length >= enough;
  const pts = useSame || slot === undefined ? same : points;
  const mixed = slot !== undefined && !useSame && points.some((p) => p.slot !== slot);
  if (pts.length < 3) return { ...none, slot, mixed };

  const recent = pts.slice(0, TREND.recent);
  const recentBest = bestOf(recent);
  const spanDays = (recent[0].date - recent[recent.length - 1].date) / 86_400_000;

  // Decline: three sessions in a row, each worse than the one before, ending lower than the first by real weight or reps.
  const [a, b, c] = recent;
  if (compareBest(a.best, b.best) < 0 && compareBest(b.best, c.best) < 0) {
    const lower = c.best.weight - a.best.weight > 0.01 || (Math.abs(c.best.weight - a.best.weight) <= 0.01 && c.best.reps - a.best.reps >= TREND.declineReps);
    if (lower) {
      return { state: 'decline', recentBest: a.best, baselineBest: c.best, delta: { weight: a.best.weight - c.best.weight, reps: a.best.reps - c.best.reps }, moreWork: false, spanDays, slot, mixed };
    }
  }

  const baseline = pts.slice(TREND.recent, TREND.recent + TREND.baselineSessions);
  if (baseline.length < TREND.minBaseline) return { ...none, recentBest, spanDays, slot, mixed };
  const baselineBest = bestOf(baseline);
  const better = compareBest(recentBest, baselineBest) > 0;
  const baselineVolume = Math.max(...baseline.map((p) => p.volume));
  const moreWork = Math.max(...recent.map((p) => p.volume)) > baselineVolume * (1 + TREND.volumeTolerance);
  const delta = { weight: recentBest.weight - baselineBest.weight, reps: recentBest.reps - baselineBest.reps };
  const stuck = !better && !moreWork;
  return { state: stuck && spanDays >= TREND.minSpanDays ? 'stagnation' : 'improving', recentBest, baselineBest, delta, moreWork: !better && moreWork, spanDays, slot, mixed };
}
