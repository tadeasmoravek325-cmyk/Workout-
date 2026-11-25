import { describe, expect, it } from 'vitest';
import { analyzeTrend, compareBest, slotOf, TREND, trendPoints, type Slot, type TrendPoint } from '../../core/progress/trend';
import type { Session } from '../../core/history';
import type { WorkoutSet } from '../../types';

const DAY = 86_400_000;
type V = [weight: number, reps: number, volume?: number, slot?: Slot];
// Newest first.
const pts = (vals: V[], gapDays = 7): TrendPoint[] =>
  vals.map(([weight, reps, volume, slot], i) => ({ date: 1e12 - i * gapDays * DAY, best: { weight, reps }, volume: volume ?? weight * reps * 3, slot, belowRange: false }));
const same = (n: number, w = 60, r = 8) => Array.from({ length: n }, () => [w, r] as V);

describe('compareBest', () => {
  it('ranks weight first, then reps', () => {
    expect(compareBest({ weight: 60, reps: 3 }, { weight: 57.5, reps: 12 })).toBe(1);
    expect(compareBest({ weight: 60, reps: 9 }, { weight: 60, reps: 8 })).toBe(1);
    expect(compareBest({ weight: 60, reps: 8 }, { weight: 60, reps: 8 })).toBe(0);
  });
});

describe('trendPoints', () => {
  const set = (weight: number, reps: number, type = 'normal'): WorkoutSet => ({ id: String(Math.random()), type, weight, reps, done: true }) as WorkoutSet;
  const session = (sets: WorkoutSet[], priorSets?: number): Session => ({ workoutId: 'w', workoutName: 'x', date: 1, sets, priorSets });
  it('takes the heaviest set that reached the bottom of the rep range', () => {
    const p = trendPoints([session([set(100, 2), set(60, 8), set(60, 9), set(40, 12, 'warmup')])], 8);
    expect(p[0].best).toEqual({ weight: 60, reps: 9 });
    expect(p[0].belowRange).toBe(false);
  });
  it('falls back to the heaviest set when none reached the range', () => {
    const p = trendPoints([session([set(100, 2), set(90, 3)])], 8);
    expect(p[0].best).toEqual({ weight: 100, reps: 2 });
    expect(p[0].belowRange).toBe(true);
  });
  it('records where in the workout the lift was done', () => {
    expect(trendPoints([session([set(60, 8)], 0)])[0].slot).toBe('fresh');
    expect(trendPoints([session([set(60, 8)], 4)])[0].slot).toBe('fatigued');
    expect(trendPoints([session([set(60, 8)])])[0].slot).toBeUndefined();
    expect(slotOf(TREND.fatiguedSets)).toBe('fatigued');
  });
});

describe('analyzeTrend', () => {
  it('needs at least three sessions and a baseline', () => {
    expect(analyzeTrend(pts(same(2))).state).toBe('insufficient');
    expect(analyzeTrend(pts(same(3))).state).toBe('insufficient');
    expect(analyzeTrend(pts(same(4))).state).toBe('insufficient');
  });
  it('calls a plateau only over enough days', () => {
    expect(analyzeTrend(pts(same(5), 7)).state).toBe('stagnation');
    expect(analyzeTrend(pts(same(5), 1)).state).toBe('improving'); // 2 days is too short to judge
  });
  it('counts a heavier best set as progress', () => {
    const t = analyzeTrend(pts([[62.5, 8], [60, 8], [60, 8], [60, 8], [57.5, 8], [57.5, 8]]));
    expect(t.state).toBe('improving');
    expect(t.delta).toEqual({ weight: 2.5, reps: 0 });
  });
  it('counts more reps at the same weight as progress', () => {
    const t = analyzeTrend(pts([[60, 10], [60, 9], [60, 8], [60, 8], [60, 8]]));
    expect(t.state).toBe('improving');
    expect(t.delta).toEqual({ weight: 0, reps: 2 });
  });
  it('counts more work at the same best set as progress, but says so', () => {
    const t = analyzeTrend(pts([[60, 8, 1800], [60, 8, 1800], [60, 8, 1800], [60, 8, 1440], [60, 8, 1440]]));
    expect(t.state).toBe('improving');
    expect(t.moreWork).toBe(true);
  });
  it('compares with the recent baseline, not an old peak', () => {
    const eight = same(8);
    expect(analyzeTrend(pts([[62.5, 8], [60, 8], [60, 8], ...eight, [80, 8]])).state).toBe('improving');
    expect(analyzeTrend(pts([[60, 8], [60, 8], [60, 8], ...eight, [80, 8]])).state).toBe('stagnation');
    expect(analyzeTrend(pts([[60, 8], [60, 8], [60, 8], [80, 8], ...same(4)])).state).toBe('stagnation'); // the 80 is inside the window
  });
  it('flags three falling sessions with a real drop in weight or reps', () => {
    expect(analyzeTrend(pts([[55, 8], [57.5, 8], [60, 8]])).state).toBe('decline');
    expect(analyzeTrend(pts([[60, 6], [60, 7], [60, 8]])).state).toBe('decline'); // two reps lost at the same weight
    expect(analyzeTrend(pts([[60, 8], [60, 8], [60, 8]])).state).toBe('insufficient');
    expect(analyzeTrend(pts([[57.5, 8], [60, 8], [57.5, 8], ...same(3)])).state).not.toBe('decline'); // not in a row
  });
  it('judges a lift only against sessions done in the same position', () => {
    // Incline press: first thing (fresh) at 60, later (fatigued) at 50, over and over.
    const mixedHistory: V[] = [];
    for (let i = 0; i < 6; i++) mixedHistory.push([60, 8, undefined, 'fresh'], [50, 8, undefined, 'fatigued']);
    const fresh = analyzeTrend(pts(mixedHistory), { slot: 'fresh' });
    expect(fresh.mixed).toBe(false);
    expect(fresh.recentBest).toEqual({ weight: 60, reps: 8 });
    const fat = analyzeTrend(pts(mixedHistory), { slot: 'fatigued' });
    expect(fat.recentBest).toEqual({ weight: 50, reps: 8 });
    expect(fat.mixed).toBe(false);
  });
  it('falls back to all sessions, marked as mixed, when the position has too few', () => {
    const few: V[] = [[60, 8, undefined, 'fresh'], [50, 8, undefined, 'fatigued'], [50, 8, undefined, 'fatigued'], [50, 8, undefined, 'fatigued'], [50, 8, undefined, 'fatigued']];
    const t = analyzeTrend(pts(few), { slot: 'fresh' });
    expect(t.mixed).toBe(true);
  });
  it('uses documented thresholds', () => {
    expect(TREND.recent).toBe(3);
    expect(TREND.minSpanDays).toBe(14);
  });
});
