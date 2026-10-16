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
  level: 'Začátečník' | 'Pokročilý' | 'Všechny úrovně';
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
    name: '5×5 Síla',
    level: 'Začátečník',
    daysPerWeek: 3,
    goal: 'Síla',
    description:
      'Klasický silový program pro začátečníky. Střídej tréninky A a B, každý trénink přidej 2,5 kg (mrtvý tah 5 kg).',
    days: [
      { name: '5×5 – Trénink A', exercises: [e('squat', 5, 5, 180), e('bench-press', 5, 5, 180), e('barbell-row', 5, 5, 180)] },
      { name: '5×5 – Trénink B', exercises: [e('squat', 5, 5, 180), e('ohp', 5, 5, 180), e('deadlift', 1, 5, 180)] },
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    level: 'Pokročilý',
    daysPerWeek: 6,
    goal: 'Svalová hmota',
    description: 'Oblíbené rozdělení na tlaky, přítahy a nohy. Ideálně 2× týdně každý den (6 tréninků).',
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
    name: 'Horní / Dolní polovina',
    level: 'Všechny úrovně',
    daysPerWeek: 4,
    goal: 'Síla i hmota',
    description: 'Čtyři tréninky týdně, každá partie 2× týdně. Skvělý poměr objemu a regenerace.',
    days: [
      {
        name: 'Horní A',
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
        name: 'Dolní A',
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
        name: 'Horní B',
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
        name: 'Dolní B',
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
    name: 'Celé tělo 3× týdně',
    level: 'Začátečník',
    daysPerWeek: 3,
    goal: 'Obecná kondice',
    description: 'Jednoduchý program na celé tělo. Vhodný pro začátečníky a lidi s omezeným časem.',
    days: [
      {
        name: 'Celé tělo A',
        exercises: [e('squat', 3, 8, 150), e('bench-press', 3, 8, 120), e('lat-pulldown', 3, 10, 90), e('plank', 3, 0, 60)],
      },
      {
        name: 'Celé tělo B',
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
    name: 'Doma bez vybavení',
    level: 'Všechny úrovně',
    daysPerWeek: 3,
    goal: 'Kondice',
    description: 'Trénink jen s vlastní vahou. Stačí kus podlahy a hrazda.',
    days: [
      {
        name: 'Domácí trénink',
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
