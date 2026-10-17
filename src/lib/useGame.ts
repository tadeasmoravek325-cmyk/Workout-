import { useMemo } from 'react';
import { useExerciseMap, useStore } from '../store/store';
import { computeProgress, leagueInfo, levelInfo, muscleForms, questXpByWeek, streakInfo, streakRisk, weeklyQuests, type GoalPlan } from './gamification';
import { startOfWeek } from './calc';
import type { Exercise, Measurement, Workout } from '../types';

type Inputs = [Workout[], Measurement[], number, [number, number][] | undefined, Map<string, Exercise>, number];

function compute(workouts: Workout[], measurements: Measurement[], current: number, log: [number, number][] | undefined, exMap: Map<string, Exercise>) {
  const goal: GoalPlan = { current, log };
  const progress = computeProgress(workouts, exMap, goal);
  const quests = questXpByWeek(workouts, exMap, goal, measurements);
  const weekXp = new Map(progress.weekXp);
  let questTotal = 0;
  for (const [week, xp] of quests) {
    weekXp.set(week, (weekXp.get(week) ?? 0) + xp);
    questTotal += xp;
  }
  const totalXp = progress.totalXp + questTotal;
  const streak = streakInfo(workouts, goal);
  return {
    progress,
    totalXp,
    level: levelInfo(totalXp),
    league: leagueInfo(weekXp, goal),
    streak,
    risk: streakRisk(workouts, goal, streak),
    quests: weeklyQuests(workouts, exMap, goal, measurements),
    muscles: muscleForms(workouts, exMap),
  };
}

export type GameState = ReturnType<typeof compute>;

// One shared result: several components (the global watcher and the page) read it at once.
let cache: { inputs: Inputs; value: GameState } | null = null;

/** Level, XP, league, streak, quests and muscle form derived from the full history. */
export function useGame(): GameState {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const current = useStore((s) => s.settings.weeklyGoal);
  const log = useStore((s) => s.settings.goalLog);
  const exMap = useExerciseMap();
  // The week is part of the key so leagues and quests roll over when a new week starts.
  const week = startOfWeek(Date.now());
  return useMemo(() => {
    const inputs: Inputs = [workouts, measurements, current, log, exMap, week];
    if (cache && cache.inputs.every((v, i) => v === inputs[i])) return cache.value;
    const value = compute(workouts, measurements, current, log, exMap);
    cache = { inputs, value };
    return value;
  }, [workouts, measurements, current, log, exMap, week]);
}
