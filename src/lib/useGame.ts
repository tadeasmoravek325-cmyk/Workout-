import { useMemo } from 'react';
import { useExerciseMap, useStore } from '../store/store';
import { computeProgress, streakInfo, type GoalPlan } from './gamification';

/** Per-workout records (PRs) and the weekly-goal streak, derived from the full history. */
export function useGame() {
  const workouts = useStore((s) => s.workouts);
  const current = useStore((s) => s.settings.weeklyGoal);
  const log = useStore((s) => s.settings.goalLog);
  const exMap = useExerciseMap();
  return useMemo(() => {
    const goal: GoalPlan = { current, log };
    return { progress: computeProgress(workouts, exMap, goal), streak: streakInfo(workouts, goal) };
  }, [workouts, current, log, exMap]);
}
