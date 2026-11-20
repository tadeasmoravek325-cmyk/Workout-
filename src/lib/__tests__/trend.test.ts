import { describe, expect, it } from 'vitest';
import { analyzeTrend, TREND, type TrendPoint } from '../../core/progress/trend';

const DAY = 86_400_000;
// Newest first.
const pts = (vals: [number, number][], gapDays = 7): TrendPoint[] => vals.map(([e, v], i) => ({ date: 1e12 - i * gapDays * DAY, e1rm: e, volume: v }));

describe('analyzeTrend', () => {
  it('needs at least three sessions', () => {
    expect(analyzeTrend(pts([[100, 1], [100, 1]])).state).toBe('insufficient');
  });
  it('needs a baseline before calling a plateau', () => {
    expect(analyzeTrend(pts([[100, 1], [100, 1], [100, 1]])).state).toBe('insufficient');
    expect(analyzeTrend(pts([[100, 1], [100, 1], [100, 1], [100, 1]])).state).toBe('insufficient');
  });
  it('calls a plateau only over enough days', () => {
    const flat: [number, number][] = [[100, 1000], [100, 1000], [100, 1000], [100, 1000], [100, 1000]];
    expect(analyzeTrend(pts(flat, 7)).state).toBe('stagnation');
    expect(analyzeTrend(pts(flat, 1)).state).toBe('improving'); // 2 days span < 14: too short to judge
  });
  it('compares with recent sessions, not an all-time best', () => {
    const eight = Array.from({ length: 8 }, () => [100, 1000] as [number, number]);
    // An old 150 sits beyond the 8 baseline sessions, so it is ignored: 103 beats the recent level of 100.
    expect(analyzeTrend(pts([[103, 1030], [101, 1010], [100, 1000], ...eight, [150, 1500]])).state).toBe('improving');
    expect(analyzeTrend(pts([[100, 1000], [100, 1000], [100, 1000], ...eight, [150, 1500]])).state).toBe('stagnation');
    // The same 150 inside the baseline window still counts.
    expect(analyzeTrend(pts([[103, 1030], [101, 1010], [100, 1000], [150, 1500], ...eight.slice(0, 4)])).state).toBe('stagnation');
  });
  it('flags a decline of three sessions with a real drop', () => {
    expect(analyzeTrend(pts([[96, 1], [100, 1], [105, 1]])).state).toBe('decline');
    expect(analyzeTrend(pts([[104, 1], [105, 1], [106, 1]])).state).toBe('insufficient'); // falls only ~2%
  });
  it('uses documented thresholds', () => {
    expect(TREND.recent).toBe(3);
    expect(TREND.minSpanDays).toBe(14);
  });
});
