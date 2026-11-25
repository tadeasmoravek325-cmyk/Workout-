import { describe, expect, it } from 'vitest';
import { overloadState, type OverloadPoint } from '../overload';

const DAY = 86_400_000;
type V = [weight: number, reps: number, volume?: number];
// Oldest first, one session per week, like overloadSeries.
const series = (vals: V[]): OverloadPoint[] => vals.map(([weight, reps, volume], i) => ({ date: i * 7 * DAY, best: { weight, reps }, volume: volume ?? weight * reps * 3, belowRange: false }));
const flat = (n: number, w = 60, r = 8): V[] => Array.from({ length: n }, () => [w, r]);

describe('overloadState (best set, shared trend definition)', () => {
  it('needs enough sessions', () => {
    expect(overloadState(series([[60, 8]])).state).toBe('new');
  });
  it('detects progress by weight and says by how much', () => {
    const r = overloadState(series([...flat(3, 57.5), ...flat(3, 60), [62.5, 8]]));
    expect(r.state).toBe('up');
    expect(r.delta?.weight).toBe(2.5);
  });
  it('detects progress by reps at the same weight', () => {
    const r = overloadState(series([...flat(3), [60, 9], [60, 10]]));
    expect(r.state).toBe('up');
    expect(r.delta).toEqual({ weight: 0, reps: 2 });
  });
  it('detects a plateau', () => {
    expect(overloadState(series(flat(5))).state).toBe('flat');
  });
  it('detects a decline', () => {
    expect(overloadState(series([[62.5, 8], [62.5, 8], [60, 8], [57.5, 8], [55, 8]])).state).toBe('down');
  });
  it('never reports progress together with a drop', () => {
    // The old estimate-based panel could say "Progressing -5%". The best set can only be better, equal or worse.
    const r = overloadState(series([[60, 8], [60, 8], [60, 8], [57.5, 8], [57.5, 8], [57.5, 8]]));
    expect(r.state === 'up' && (r.delta?.weight ?? 0) < 0).toBe(false);
  });
});
