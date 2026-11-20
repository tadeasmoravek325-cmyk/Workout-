import { describe, expect, it } from 'vitest';
import { overloadState, type OverloadPoint } from '../overload';

const DAY = 86_400_000;
// Oldest first, like overloadSeries. One session per week.
const series = (vals: [number, number][]): OverloadPoint[] => vals.map(([e, v], i) => ({ date: i * 7 * DAY, e1rm: e, volume: v, reps: 0, reliable: true }));

describe('overloadState (shared trend definition)', () => {
  it('needs enough sessions', () => {
    expect(overloadState(series([[100, 1000]])).state).toBe('new');
  });
  it('detects progress', () => {
    expect(overloadState(series([[100, 1000], [100, 1000], [100, 1000], [105, 1100], [106, 1100]])).state).toBe('up');
  });
  it('detects a plateau', () => {
    expect(overloadState(series([[100, 1000], [100, 1000], [100, 1000], [100, 1000], [100, 1000]])).state).toBe('flat');
  });
  it('detects a decline', () => {
    expect(overloadState(series([[110, 1100], [108, 1100], [106, 1000], [102, 1000], [98, 1000]])).state).toBe('down');
  });
  it('counts more work at the same strength as progress', () => {
    expect(overloadState(series([[100, 1000], [100, 1000], [100, 1000], [100, 1200], [100, 1200]])).state).toBe('up');
  });
  it('does not call recovery after a dip a plateau', () => {
    // The 120 peak is older than the 8 baseline sessions, so the climb back to 106 counts as progress.
    expect(overloadState(series([[120, 1200], ...Array.from({ length: 8 }, () => [100, 1000] as [number, number]), [101, 1010], [103, 1030], [106, 1060]])).state).toBe('up');
  });
});
