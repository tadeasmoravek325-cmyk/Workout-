import { describe, expect, it } from 'vitest';
import { coachInsights } from '../insights';
import { BUILTIN_EXERCISES } from '../../data/exercises';
import type { Workout } from '../../types';

const exMap = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
const NOW = Date.UTC(2026, 5, 30);
const w = (daysAgo: number, sets: number): Workout =>
  ({ id: `w${daysAgo}`, name: 'x', startedAt: NOW - daysAgo * 86_400_000, endedAt: NOW, exercises: [{ id: `e${daysAgo}`, exerciseId: 'bench-press', sets: Array.from({ length: sets }, (_, i) => ({ id: `s${daysAgo}${i}`, type: 'normal', weight: 80, reps: 8, done: true })) }] }) as unknown as Workout;

describe('coachInsights', () => {
  it('says nothing with too little history', () => {
    expect(coachInsights([w(1, 3)], exMap, NOW)).toEqual([]);
  });
  it('flags a muscle trained before but thin this week', () => {
    const list = coachInsights([w(2, 3), w(10, 10), w(17, 10), w(24, 10)], exMap, NOW);
    expect(list.some((i) => i.kind === 'low')).toBe(true);
  });
  it('stays quiet when weekly volume is fine', () => {
    const list = coachInsights([w(1, 8), w(3, 8), w(10, 8), w(17, 8)], exMap, NOW);
    expect(list.filter((i) => i.kind === 'low')).toHaveLength(0);
  });
});
