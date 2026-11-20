import { describe, expect, it } from 'vitest';
import { overloadState, type OverloadPoint } from '../overload';

const p = (e1rm: number, volume: number): OverloadPoint => ({ date: 0, e1rm, volume, reps: 0 });

describe('overloadState', () => {
  it('needs four sessions', () => {
    expect(overloadState([p(100, 1000)]).state).toBe('new');
  });
  it('detects progress', () => {
    expect(overloadState([p(100, 1000), p(100, 1000), p(105, 1100), p(106, 1100)]).state).toBe('up');
  });
  it('detects flat and down', () => {
    expect(overloadState([p(100, 1000), p(100, 1000), p(100, 1000), p(100, 1000)]).state).toBe('flat');
    expect(overloadState([p(110, 1100), p(110, 1100), p(100, 1000), p(100, 1000)]).state).toBe('down');
  });
  it('counts more volume at the same strength as progress', () => {
    expect(overloadState([p(100, 1000), p(100, 1000), p(100, 1200), p(100, 1200)]).state).toBe('up');
  });
});
