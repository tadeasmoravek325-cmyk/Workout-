export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'kettlebell'
  | 'bodyweight'
  | 'band'
  | 'other';

/** Determines which fields a set has. */
export type ExerciseType =
  | 'weight_reps'
  | 'weighted_bodyweight'
  | 'assisted_bodyweight'
  | 'reps_only'
  | 'duration'
  | 'distance_duration';

export type BodyPart = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'fullbody';

export type Muscle =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'lats'
  | 'traps'
  | 'upperBack'
  | 'lowerBack'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves';

/** How much a muscle works in an exercise: 1 = prime mover, 0.5 = strong synergist, 0.25 = stabiliser. */
export type MuscleLoad = Partial<Record<Muscle, number>>;

export interface Exercise {
  id: string;
  name: string;
  equipment: Equipment;
  type: ExerciseType;
  bodyPart: BodyPart;
  primary: Muscle[];
  secondary: Muscle[];
  /** Fractional involvement per muscle. Derived from primary/secondary when missing. */
  load?: MuscleLoad;
  instructions?: string[];
  custom?: boolean;
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  id: string;
  type: SetType;
  /** Always stored in kg. */
  weight?: number;
  reps?: number;
  durationSec?: number;
  /** Always stored in km. */
  distance?: number;
  rpe?: number;
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  /** Exercises sharing the same supersetId are performed back to back. */
  supersetId?: string;
  restSec?: number;
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  finishedAt?: number;
  exercises: WorkoutExercise[];
  notes?: string;
  routineId?: string;
}

export interface RoutineSet {
  type: SetType;
  weight?: number;
  reps?: number;
  durationSec?: number;
  distance?: number;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  sets: RoutineSet[];
  restSec?: number;
  supersetId?: string;
  notes?: string;
}

export interface Routine {
  id: string;
  name: string;
  folder?: string;
  notes?: string;
  exercises: RoutineExercise[];
  createdAt: number;
}

export type MeasurementType =
  | 'bodyweight'
  | 'bodyfat'
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'bicepsL'
  | 'bicepsR'
  | 'forearm'
  | 'thighL'
  | 'thighR'
  | 'calf';

export interface Measurement {
  id: string;
  type: MeasurementType;
  /** kg for bodyweight, % for bodyfat, cm for the rest. */
  value: number;
  date: number;
}

export type Unit = 'kg' | 'lb';

export type Goal = 'strength' | 'muscle' | 'fitness' | 'weightloss';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Sex = 'm' | 'f';

export interface Settings {
  name: string;
  sex?: Sex;
  /** Used for age-adjusted strength standards. */
  birthYear?: number;
  goal: Goal;
  experience: Experience;
  onboarded: boolean;
  /** Equipment available for the workout generator. */
  equipment: Equipment[];
  unit: Unit;
  defaultRestSec: number;
  autoStartRest: boolean;
  sound: boolean;
  vibrate: boolean;
  weeklyGoal: number;
  /** [weekStart, goal] pairs, ascending. Keeps past weeks judged by the goal they had. */
  goalLog?: [number, number][];
  /** Last league week whose result the user has seen. */
  leagueSeenWeek?: number;
  barWeightKg: number;
  /** Available plates in kg (per side). */
  plates: number[];
  theme: 'dark' | 'light' | 'system';
  showRpe: boolean;
  smartCoach: boolean;
  /** When the user last saved a backup file (ms). */
  lastBackupAt?: number;
  /** Backup reminder is hidden until this time (ms). */
  backupSnoozeUntil?: number;
}

export interface RestTimer {
  startedAt: number;
  endsAt: number;
  durationSec: number;
}
