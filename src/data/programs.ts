/** Ready-made training programs that can be imported as routines. */
export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  reps?: number;
  durationSec?: number;
  restSec?: number;
}

export interface ProgramDay {
  name: string;
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  name: string;
  level: 'Beginner' | 'Intermediate' | 'All levels';
  daysPerWeek: number;
  goal: string;
  description: string;
  days: ProgramDay[];
}

const e = (exerciseId: string, sets: number, reps: number, restSec?: number): ProgramExercise => ({
  exerciseId,
  sets,
  reps,
  restSec,
});

export const PROGRAMS: Program[] = [
  {
    id: 'stronglifts',
    name: '5×5 Strength',
    level: 'Beginner',
    daysPerWeek: 3,
    goal: 'Strength',
    description:
      'The classic strength program for beginners. Alternate workouts A and B and add 2.5 kg every session (5 kg on the deadlift).',
    days: [
      { name: '5×5 – Workout A', exercises: [e('squat', 5, 5, 180), e('bench-press', 5, 5, 180), e('barbell-row', 5, 5, 180)] },
      { name: '5×5 – Workout B', exercises: [e('squat', 5, 5, 180), e('ohp', 5, 5, 180), e('deadlift', 1, 5, 180)] },
    ],
  },
  {
    id: 'ppl',
    name: 'Push Pull Legs',
    level: 'Intermediate',
    daysPerWeek: 6,
    goal: 'Muscle gain',
    description: 'The popular push, pull and legs split. Ideally run each day twice a week (6 workouts).',
    days: [
      {
        name: 'Push',
        exercises: [
          e('bench-press', 4, 6, 150),
          e('ohp', 3, 8, 120),
          e('db-incline-press', 3, 10, 90),
          e('lateral-raise', 4, 15, 60),
          e('triceps-pushdown', 3, 12, 60),
          e('overhead-triceps-extension', 3, 12, 60),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          e('deadlift', 3, 5, 180),
          e('pull-up', 3, 8, 120),
          e('barbell-row', 3, 8, 120),
          e('face-pull', 3, 15, 60),
          e('barbell-curl', 3, 10, 60),
          e('hammer-curl', 3, 12, 60),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          e('squat', 4, 6, 180),
          e('romanian-deadlift', 3, 10, 120),
          e('leg-press', 3, 12, 90),
          e('leg-curl', 3, 12, 60),
          e('standing-calf-raise', 4, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    level: 'All levels',
    daysPerWeek: 4,
    goal: 'Strength and size',
    description: 'Four workouts a week, each muscle group hit twice. A great balance of volume and recovery.',
    days: [
      {
        name: 'Upper A',
        exercises: [
          e('bench-press', 4, 6, 150),
          e('barbell-row', 4, 6, 150),
          e('db-shoulder-press', 3, 10, 90),
          e('lat-pulldown', 3, 10, 90),
          e('ez-curl', 2, 12, 60),
          e('triceps-pushdown', 2, 12, 60),
        ],
      },
      {
        name: 'Lower A',
        exercises: [
          e('squat', 4, 6, 180),
          e('romanian-deadlift', 3, 8, 120),
          e('leg-press', 3, 12, 90),
          e('leg-curl', 3, 12, 60),
          e('standing-calf-raise', 4, 12, 60),
          e('plank', 3, 0, 60),
        ],
      },
      {
        name: 'Upper B',
        exercises: [
          e('ohp', 4, 6, 150),
          e('pull-up', 4, 8, 120),
          e('db-incline-press', 3, 10, 90),
          e('seated-cable-row', 3, 10, 90),
          e('lateral-raise', 3, 15, 60),
          e('hammer-curl', 2, 12, 60),
        ],
      },
      {
        name: 'Lower B',
        exercises: [
          e('deadlift', 3, 5, 180),
          e('front-squat', 3, 8, 150),
          e('bulgarian-split-squat', 3, 10, 90),
          e('hip-thrust', 3, 10, 90),
          e('seated-calf-raise', 4, 15, 60),
          e('hanging-leg-raise', 3, 12, 60),
        ],
      },
    ],
  },
  {
    id: 'fullbody',
    name: 'Full body for beginners',
    level: 'Beginner',
    daysPerWeek: 3,
    goal: 'General fitness',
    description: 'A simple full-body program, three times a week. Great for beginners and anyone short on time.',
    days: [
      {
        name: 'Full body A',
        exercises: [e('squat', 3, 8, 150), e('bench-press', 3, 8, 120), e('lat-pulldown', 3, 10, 90), e('plank', 3, 0, 60)],
      },
      {
        name: 'Full body B',
        exercises: [
          e('deadlift', 3, 5, 180),
          e('ohp', 3, 8, 120),
          e('seated-cable-row', 3, 10, 90),
          e('lunge', 3, 10, 90),
        ],
      },
    ],
  },
  {
    id: 'home',
    name: 'Home, no equipment',
    level: 'All levels',
    daysPerWeek: 3,
    goal: 'Fitness',
    description: 'Bodyweight-only training. All you need is a bit of floor and a pull-up bar.',
    days: [
      {
        name: 'Home workout',
        exercises: [
          e('push-up', 4, 15, 60),
          e('pull-up', 4, 6, 90),
          e('glute-bridge', 3, 15, 60),
          e('burpee', 3, 10, 60),
          e('crunch', 3, 20, 45),
          { exerciseId: 'plank', sets: 3, durationSec: 45, restSec: 45 },
        ],
      },
    ],
  },
];
