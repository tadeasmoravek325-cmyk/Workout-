import type { Session } from '../history';
import { e1rm, isLoggedWorkingSet, workSetVolume } from '../metrics';

/**
 * The one definition of "is this lift progressing, stuck or going backwards". The progress engine, the
 * progress panel, the coach notes and the in-workout deload advice all ask this module, so they cannot disagree.
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
  /** A recent best within this fraction of the baseline counts as no improvement. */
  tolerance: 0.005,
  /** The window must span at least this many days, so a few sessions in one week prove nothing. */
  minSpanDays: 14,
  /** Three falling sessions in a row must lose more than this fraction in total. */
  declineDrop: 0.03,
} as const;

export interface TrendPoint {
  date: number;
  /** Best estimated 1RM of the session's working sets. */
  e1rm: number;
  /** Working-set volume of the session. */
  volume: number;
}

export type TrendState = 'insufficient' | 'improving' | 'stagnation' | 'decline';

export interface Trend {
  state: TrendState;
  /** Percent: recent best against baseline best (decline: newest against oldest of the three). 0 when unknown. */
  change: number;
  recentBest: number;
  baselineBest: number;
  spanDays: number;
}

/** Session points, newest first. Sessions without a weighted working set are skipped. */
export function trendPoints(sessions: Session[]): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (const s of sessions) {
    const work = s.sets.filter((x) => isLoggedWorkingSet(x) && (x.reps ?? 0) > 0 && (x.weight ?? 0) > 0);
    if (!work.length) continue;
    out.push({
      date: s.date,
      e1rm: Math.max(...work.map((x) => e1rm(x.weight ?? 0, x.reps ?? 0))),
      volume: work.reduce((a, x) => a + workSetVolume(x), 0),
    });
  }
  return out;
}

/** `points` newest first (as returned by `trendPoints`). */
export function analyzeTrend(points: TrendPoint[]): Trend {
  const none: Trend = { state: 'insufficient', change: 0, recentBest: 0, baselineBest: 0, spanDays: 0 };
  if (points.length < 3) return none;
  const recent = points.slice(0, TREND.recent);
  const recentBest = Math.max(...recent.map((p) => p.e1rm));
  const spanDays = (recent[0].date - recent[recent.length - 1].date) / 86_400_000;

  // Decline: three sessions in a row, each lower than the one before, and the total fall is more than noise.
  const [a, b, c] = recent;
  if (a.e1rm < b.e1rm && b.e1rm < c.e1rm && (c.e1rm - a.e1rm) / c.e1rm > TREND.declineDrop) {
    return { state: 'decline', change: ((a.e1rm - c.e1rm) / c.e1rm) * 100, recentBest, baselineBest: c.e1rm, spanDays };
  }

  const baseline = points.slice(TREND.recent, TREND.recent + TREND.baselineSessions);
  if (baseline.length < TREND.minBaseline) return { ...none, recentBest, spanDays };
  const baselineBest = Math.max(...baseline.map((p) => p.e1rm));
  const baselineVolume = Math.max(...baseline.map((p) => p.volume));
  const recentVolume = Math.max(...recent.map((p) => p.volume));
  const change = baselineBest ? ((recentBest - baselineBest) / baselineBest) * 100 : 0;
  // Progress is either a higher best estimate or more work done at it; the lift is stuck only when neither moved.
  const stuck = recentBest <= baselineBest * (1 + TREND.tolerance) && recentVolume <= baselineVolume * (1 + TREND.tolerance);
  return { state: stuck && spanDays >= TREND.minSpanDays ? 'stagnation' : 'improving', change, recentBest, baselineBest, spanDays };
}
