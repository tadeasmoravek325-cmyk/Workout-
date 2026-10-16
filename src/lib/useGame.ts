import { useMemo } from 'react';
import { useExerciseMap, useStore } from '../store/store';
import { computeProgress, levelInfo, questXp, streakInfo, weeklyQuests } from './gamification';

/** Level, XP, streak and quests derived from the full history. */
export function useGame() {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const goal = useStore((s) => s.settings.weeklyGoal);
  const exMap = useExerciseMap();
  return useMemo(() => {
    const progress = computeProgress(workouts, exMap, goal);
    const bonus = questXp(workouts, exMap, goal, measurements);
    const totalXp = progress.totalXp + bonus;
    return {
      progress,
      totalXp,
      level: levelInfo(totalXp),
      streak: streakInfo(workouts, goal),
      quests: weeklyQuests(workouts, exMap, goal, measurements),
    };
  }, [workouts, measurements, goal, exMap]);
}
