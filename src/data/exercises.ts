import type { BodyPart, Equipment, Exercise, ExerciseType, Muscle, MuscleLoad } from '../types';

/**
 * Muscle involvement uses fractional set counting: the target muscle counts 1.0 per set,
 * strong synergists 0.5–0.75, stabilisers 0.25. Values follow common EMG / volume-study practice
 * (direct sets count fully, indirect sets roughly half).
 */
function ex(
  id: string,
  name: string,
  equipment: Equipment,
  bodyPart: BodyPart,
  load: MuscleLoad,
  type: ExerciseType = 'weight_reps',
  instructions?: string[],
): Exercise {
  const entries = Object.entries(load) as [Muscle, number][];
  return {
    id,
    name,
    equipment,
    bodyPart,
    load,
    primary: entries.filter(([, w]) => w >= 0.75).map(([m]) => m),
    secondary: entries.filter(([, w]) => w > 0 && w < 0.75).map(([m]) => m),
    type,
    instructions,
  };
}

export const BUILTIN_EXERCISES: Exercise[] = [
  // Chest
  ex('bench-press', 'Bench Press (Barbell)', 'barbell', 'chest', { chest: 1, frontDelts: 0.5, triceps: 0.5 }, 'weight_reps', [
    'Lie on the bench with your eyes under the bar. Pull your shoulder blades back and down.',
    'Grip the bar slightly wider than shoulder width.',
    'Lower the bar under control to your lower chest, elbows about 45° from your body.',
    'Press back up with your feet planted.',
  ]),
  ex('incline-bench-press', 'Incline Bench Press (Barbell)', 'barbell', 'chest', { chest: 1, frontDelts: 0.75, triceps: 0.5 }),
  ex('decline-bench-press', 'Decline Bench Press (Barbell)', 'barbell', 'chest', { chest: 1, triceps: 0.5, frontDelts: 0.25 }),
  ex('db-bench-press', 'Bench Press (Dumbbell)', 'dumbbell', 'chest', { chest: 1, frontDelts: 0.5, triceps: 0.5 }),
  ex('db-incline-press', 'Incline Bench Press (Dumbbell)', 'dumbbell', 'chest', { chest: 1, frontDelts: 0.75, triceps: 0.5 }),
  ex('db-fly', 'Chest Fly (Dumbbell)', 'dumbbell', 'chest', { chest: 1, frontDelts: 0.25 }),
  ex('cable-fly', 'Cable Crossover', 'cable', 'chest', { chest: 1, frontDelts: 0.25 }),
  ex('pec-deck', 'Pec Deck (Machine)', 'machine', 'chest', { chest: 1, frontDelts: 0.25 }),
  ex('chest-press-machine', 'Chest Press (Machine)', 'machine', 'chest', { chest: 1, frontDelts: 0.5, triceps: 0.5 }),
  ex('push-up', 'Push Up', 'bodyweight', 'chest', { chest: 1, frontDelts: 0.5, triceps: 0.5, abs: 0.25 }, 'reps_only'),
  ex('dips', 'Chest Dip', 'bodyweight', 'chest', { chest: 1, triceps: 0.75, frontDelts: 0.5 }, 'weighted_bodyweight'),

  // Back
  ex('deadlift', 'Deadlift (Barbell)', 'barbell', 'back', { glutes: 1, hamstrings: 0.75, lowerBack: 0.75, quads: 0.5, traps: 0.5, forearms: 0.5, lats: 0.25, upperBack: 0.25 }, 'weight_reps', [
    'Stand with the bar over the middle of your feet.',
    'Grip just outside your knees. Back flat, chest up.',
    'Push the floor away and drag the bar up your legs.',
    'Finish with hips locked out, without leaning back. Lower under control.',
  ]),
  ex('sumo-deadlift', 'Sumo Deadlift (Barbell)', 'barbell', 'back', { glutes: 1, quads: 0.75, adductors: 0.75, hamstrings: 0.5, lowerBack: 0.5, traps: 0.5, forearms: 0.5 }),
  ex('barbell-row', 'Bent Over Row (Barbell)', 'barbell', 'back', { lats: 1, upperBack: 1, rearDelts: 0.5, biceps: 0.5, lowerBack: 0.25, forearms: 0.25 }),
  ex('pendlay-row', 'Pendlay Row (Barbell)', 'barbell', 'back', { lats: 1, upperBack: 1, rearDelts: 0.5, biceps: 0.5, lowerBack: 0.25 }),
  ex('db-row', 'Bent Over One Arm Row (Dumbbell)', 'dumbbell', 'back', { lats: 1, upperBack: 0.75, rearDelts: 0.5, biceps: 0.5 }),
  ex('pull-up', 'Pull Up', 'bodyweight', 'back', { lats: 1, upperBack: 0.5, biceps: 0.5, forearms: 0.25, abs: 0.25 }, 'weighted_bodyweight', [
    'Grip the bar overhand, slightly wider than your shoulders.',
    'Pull your shoulder blades down and pull until your chin clears the bar.',
    'Lower under control to a full hang.',
  ]),
  ex('chin-up', 'Chin Up', 'bodyweight', 'back', { lats: 1, biceps: 0.75, upperBack: 0.5, forearms: 0.25 }, 'weighted_bodyweight'),
  ex('assisted-pull-up', 'Pull Up (Assisted)', 'machine', 'back', { lats: 1, upperBack: 0.5, biceps: 0.5 }, 'assisted_bodyweight'),
  ex('lat-pulldown', 'Lat Pulldown (Cable)', 'cable', 'back', { lats: 1, upperBack: 0.5, biceps: 0.5, rearDelts: 0.25 }),
  ex('seated-cable-row', 'Seated Row (Cable)', 'cable', 'back', { upperBack: 1, lats: 0.75, rearDelts: 0.5, biceps: 0.5 }),
  ex('t-bar-row', 'T Bar Row', 'barbell', 'back', { upperBack: 1, lats: 1, rearDelts: 0.5, biceps: 0.5, lowerBack: 0.25 }),
  ex('machine-row', 'Seated Row (Machine)', 'machine', 'back', { upperBack: 1, lats: 0.75, rearDelts: 0.5, biceps: 0.5 }),
  ex('straight-arm-pulldown', 'Straight Arm Pulldown (Cable)', 'cable', 'back', { lats: 1, triceps: 0.25 }),
  ex('shrug', 'Shrug (Barbell)', 'barbell', 'back', { traps: 1, forearms: 0.25 }),
  ex('db-shrug', 'Shrug (Dumbbell)', 'dumbbell', 'back', { traps: 1, forearms: 0.25 }),
  ex('back-extension', 'Back Extension', 'bodyweight', 'back', { lowerBack: 1, glutes: 0.75, hamstrings: 0.5 }, 'weighted_bodyweight'),

  // Legs
  ex('squat', 'Squat (Barbell)', 'barbell', 'legs', { quads: 1, glutes: 0.75, adductors: 0.5, lowerBack: 0.25, hamstrings: 0.25, abs: 0.25 }, 'weight_reps', [
    'Rest the bar on your upper traps, feet about shoulder width apart.',
    'Breathe in, brace and sit down by pushing your hips back and knees out.',
    'Go at least to parallel with a neutral back.',
    'Drive through the whole foot to stand up.',
  ]),
  ex('front-squat', 'Front Squat (Barbell)', 'barbell', 'legs', { quads: 1, glutes: 0.5, adductors: 0.5, abs: 0.5, upperBack: 0.25 }),
  ex('goblet-squat', 'Goblet Squat (Dumbbell)', 'dumbbell', 'legs', { quads: 1, glutes: 0.75, adductors: 0.5, abs: 0.25 }),
  ex('leg-press', 'Leg Press', 'machine', 'legs', { quads: 1, glutes: 0.5, adductors: 0.5 }),
  ex('hack-squat', 'Hack Squat', 'machine', 'legs', { quads: 1, glutes: 0.5, adductors: 0.25 }),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'dumbbell', 'legs', { quads: 1, glutes: 1, adductors: 0.5, hamstrings: 0.25 }),
  ex('lunge', 'Lunge (Dumbbell)', 'dumbbell', 'legs', { quads: 1, glutes: 0.75, adductors: 0.5, hamstrings: 0.25 }),
  ex('romanian-deadlift', 'Romanian Deadlift (Barbell)', 'barbell', 'legs', { hamstrings: 1, glutes: 0.75, lowerBack: 0.5, forearms: 0.25, adductors: 0.25 }),
  ex('db-romanian-deadlift', 'Romanian Deadlift (Dumbbell)', 'dumbbell', 'legs', { hamstrings: 1, glutes: 0.75, lowerBack: 0.5, forearms: 0.25 }),
  ex('leg-extension', 'Leg Extension (Machine)', 'machine', 'legs', { quads: 1 }),
  ex('leg-curl', 'Lying Leg Curl (Machine)', 'machine', 'legs', { hamstrings: 1, calves: 0.25 }),
  ex('seated-leg-curl', 'Seated Leg Curl (Machine)', 'machine', 'legs', { hamstrings: 1 }),
  ex('hip-thrust', 'Hip Thrust (Barbell)', 'barbell', 'legs', { glutes: 1, hamstrings: 0.5, quads: 0.25 }),
  ex('glute-bridge', 'Glute Bridge', 'bodyweight', 'legs', { glutes: 1, hamstrings: 0.5 }, 'reps_only'),
  ex('standing-calf-raise', 'Standing Calf Raise (Machine)', 'machine', 'legs', { calves: 1 }),
  ex('seated-calf-raise', 'Seated Calf Raise (Machine)', 'machine', 'legs', { calves: 1 }),
  ex('hip-adduction', 'Hip Adductor (Machine)', 'machine', 'legs', { adductors: 1 }),
  ex('hip-abduction', 'Hip Abductor (Machine)', 'machine', 'legs', { glutes: 1 }),

  // Shoulders
  ex('ohp', 'Overhead Press (Barbell)', 'barbell', 'shoulders', { frontDelts: 1, sideDelts: 0.5, triceps: 0.75, upperBack: 0.25, abs: 0.25 }, 'weight_reps', [
    'Hold the bar at collarbone height, hands just outside your shoulders.',
    'Squeeze your glutes and abs, press straight up.',
    'At the top move your head under the bar, then lower under control.',
  ]),
  ex('db-shoulder-press', 'Shoulder Press (Dumbbell)', 'dumbbell', 'shoulders', { frontDelts: 1, sideDelts: 0.5, triceps: 0.75 }),
  ex('arnold-press', 'Arnold Press (Dumbbell)', 'dumbbell', 'shoulders', { frontDelts: 1, sideDelts: 0.75, triceps: 0.5 }),
  ex('machine-shoulder-press', 'Shoulder Press (Machine)', 'machine', 'shoulders', { frontDelts: 1, sideDelts: 0.5, triceps: 0.75 }),
  ex('lateral-raise', 'Lateral Raise (Dumbbell)', 'dumbbell', 'shoulders', { sideDelts: 1, traps: 0.25 }),
  ex('cable-lateral-raise', 'Lateral Raise (Cable)', 'cable', 'shoulders', { sideDelts: 1, traps: 0.25 }),
  ex('front-raise', 'Front Raise (Dumbbell)', 'dumbbell', 'shoulders', { frontDelts: 1, chest: 0.25 }),
  ex('rear-delt-fly', 'Reverse Fly (Dumbbell)', 'dumbbell', 'shoulders', { rearDelts: 1, upperBack: 0.5 }),
  ex('reverse-pec-deck', 'Reverse Fly (Machine)', 'machine', 'shoulders', { rearDelts: 1, upperBack: 0.5 }),
  ex('face-pull', 'Face Pull (Cable)', 'cable', 'shoulders', { rearDelts: 1, upperBack: 0.75, traps: 0.25 }),
  ex('upright-row', 'Upright Row (Barbell)', 'barbell', 'shoulders', { sideDelts: 1, traps: 0.75, biceps: 0.25 }),

  // Arms
  ex('barbell-curl', 'Bicep Curl (Barbell)', 'barbell', 'arms', { biceps: 1, forearms: 0.5 }),
  ex('ez-curl', 'EZ Bar Curl', 'barbell', 'arms', { biceps: 1, forearms: 0.5 }),
  ex('db-curl', 'Bicep Curl (Dumbbell)', 'dumbbell', 'arms', { biceps: 1, forearms: 0.5 }),
  ex('hammer-curl', 'Hammer Curl (Dumbbell)', 'dumbbell', 'arms', { biceps: 1, forearms: 0.75 }),
  ex('incline-db-curl', 'Incline Curl (Dumbbell)', 'dumbbell', 'arms', { biceps: 1, forearms: 0.25 }),
  ex('preacher-curl', 'Preacher Curl (Barbell)', 'barbell', 'arms', { biceps: 1, forearms: 0.25 }),
  ex('cable-curl', 'Bicep Curl (Cable)', 'cable', 'arms', { biceps: 1, forearms: 0.25 }),
  ex('triceps-pushdown', 'Triceps Pushdown (Cable)', 'cable', 'arms', { triceps: 1 }),
  ex('overhead-triceps-extension', 'Triceps Extension (Cable)', 'cable', 'arms', { triceps: 1 }),
  ex('skull-crusher', 'Skullcrusher (Barbell)', 'barbell', 'arms', { triceps: 1 }),
  ex('close-grip-bench', 'Bench Press - Close Grip (Barbell)', 'barbell', 'arms', { triceps: 1, chest: 0.75, frontDelts: 0.5 }),
  ex('db-kickback', 'Triceps Kickback (Dumbbell)', 'dumbbell', 'arms', { triceps: 1 }),
  ex('wrist-curl', 'Wrist Curl (Dumbbell)', 'dumbbell', 'arms', { forearms: 1 }),

  // Core
  ex('plank', 'Plank', 'bodyweight', 'core', { abs: 1, obliques: 0.5, frontDelts: 0.25 }, 'duration'),
  ex('side-plank', 'Side Plank', 'bodyweight', 'core', { obliques: 1, abs: 0.5 }, 'duration'),
  ex('crunch', 'Crunch', 'bodyweight', 'core', { abs: 1, obliques: 0.25 }, 'reps_only'),
  ex('cable-crunch', 'Cable Crunch', 'cable', 'core', { abs: 1, obliques: 0.25 }),
  ex('hanging-leg-raise', 'Hanging Leg Raise', 'bodyweight', 'core', { abs: 1, obliques: 0.5, forearms: 0.25 }, 'reps_only'),
  ex('ab-wheel', 'Ab Wheel', 'other', 'core', { abs: 1, lats: 0.25, obliques: 0.25 }, 'reps_only'),
  ex('russian-twist', 'Russian Twist', 'bodyweight', 'core', { obliques: 1, abs: 0.5 }, 'reps_only'),
  ex('pallof-press', 'Pallof Press (Cable)', 'cable', 'core', { obliques: 1, abs: 0.5 }),

  // Full body
  ex('power-clean', 'Power Clean', 'barbell', 'fullbody', { quads: 0.75, glutes: 0.75, traps: 0.75, hamstrings: 0.5, upperBack: 0.5, frontDelts: 0.25 }),
  ex('kb-swing', 'Kettlebell Swing', 'kettlebell', 'fullbody', { glutes: 1, hamstrings: 0.75, lowerBack: 0.5, frontDelts: 0.25 }),
  ex('farmers-walk', "Farmer's Walk", 'dumbbell', 'fullbody', { forearms: 1, traps: 0.75, abs: 0.25, obliques: 0.25 }),
  ex('burpee', 'Burpee', 'bodyweight', 'fullbody', { quads: 0.75, chest: 0.5, frontDelts: 0.25, abs: 0.25 }, 'reps_only'),

  // Cardio
  ex('running', 'Running (Outdoor)', 'other', 'cardio', {}, 'distance_duration'),
  ex('treadmill', 'Running (Treadmill)', 'machine', 'cardio', {}, 'distance_duration'),
  ex('cycling', 'Cycling (Indoor)', 'machine', 'cardio', {}, 'distance_duration'),
  ex('rowing', 'Rowing (Machine)', 'machine', 'cardio', {}, 'distance_duration'),
  ex('elliptical', 'Elliptical Trainer', 'machine', 'cardio', {}, 'distance_duration'),
  ex('jump-rope', 'Jump Rope', 'other', 'cardio', {}, 'duration'),
  ex('stair-climber', 'Climbing Stairs', 'machine', 'cardio', {}, 'duration'),
];

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  cardio: 'Cardio',
  fullbody: 'Full body',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  kettlebell: 'Kettlebell',
  bodyweight: 'Bodyweight',
  band: 'Band',
  other: 'Other',
};

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Weight × reps',
  weighted_bodyweight: 'Bodyweight + weight',
  assisted_bodyweight: 'Assisted bodyweight',
  reps_only: 'Reps only',
  duration: 'Time',
  distance_duration: 'Distance and time',
};

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest',
  frontDelts: 'Front delts',
  sideDelts: 'Side delts',
  rearDelts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  lats: 'Lats',
  traps: 'Traps',
  upperBack: 'Upper back',
  lowerBack: 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  calves: 'Calves',
};

export const ALL_MUSCLES = Object.keys(MUSCLE_LABELS) as Muscle[];

/** Old muscle ids (before the anatomy update) → current ones, for custom exercises saved earlier. */
const LEGACY_MUSCLES: Record<string, Muscle[]> = { shoulders: ['frontDelts', 'sideDelts'] };

export function normalizeMuscles(list: string[]): Muscle[] {
  const out = new Set<Muscle>();
  for (const m of list) {
    if (m in MUSCLE_LABELS) out.add(m as Muscle);
    else for (const n of LEGACY_MUSCLES[m] ?? []) out.add(n);
  }
  return [...out];
}

/**
 * Fractional load per muscle for one set of the exercise. Built-in exercises carry explicit values;
 * custom ones derive them: target muscles 1.0, secondary 0.5.
 */
export function muscleLoad(ex: Exercise): MuscleLoad {
  if (ex.load) return ex.load;
  const out: MuscleLoad = {};
  for (const m of normalizeMuscles(ex.secondary)) out[m] = 0.5;
  for (const m of normalizeMuscles(ex.primary)) out[m] = 1;
  return out;
}

export const BODY_PART_COLORS: Record<BodyPart, string> = {
  chest: '#ff4a1a',
  back: '#ff7a1a',
  legs: '#ffa030',
  shoulders: '#ffc65c',
  arms: '#ff5e2a',
  core: '#ff8f3a',
  cardio: '#ffb347',
  fullbody: '#ff6a1f',
};

/**
 * YouTube search for a form video. "Bench Press (Barbell)" becomes "barbell bench press proper form",
 * which finds technique videos far more reliably than the Strong-style name.
 */
export function youtubeSearchUrl(ex: Pick<Exercise, 'name'>): string {
  const m = ex.name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const base = m ? `${m[2]} ${m[1]}` : ex.name;
  const q = `${base.replace(/\s+-\s+/g, ' ').toLowerCase()} proper form`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
