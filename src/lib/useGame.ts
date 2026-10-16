import { useMemo } from 'react';
import { useExerciseMap, useStore } from '../store/store';
import { computeProgress, leagueInfo, levelInfo, muscleForms, questXpByWeek, streakInfo, weeklyQuests, type GoalPlan } from './gamification';

/** Level, XP, league, streak, quests and muscle form derived from the full history. */
export function useGame() {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const current = useStore((s) => s.settings.weeklyGoal);
  const log = useStore((s) => s.settings.goalLog);
  const exMap = useExerciseMap();
  return useMemo(() => {
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
    return {
      progress,
      totalXp,
      level: levelInfo(totalXp),
      league: leagueInfo(weekXp, goal),
      streak: streakInfo(workouts, goal),
      quests: weeklyQuests(workouts, exMap, goal, measurements),
      muscles: muscleForms(workouts, exMap),
    };
  }, [workouts, measurements, current, log, exMap]);
}
