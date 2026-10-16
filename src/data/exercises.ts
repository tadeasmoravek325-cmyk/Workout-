import type { BodyPart, Equipment, Exercise, ExerciseType, Muscle } from '../types';

function ex(
  id: string,
  name: string,
  equipment: Equipment,
  bodyPart: BodyPart,
  primary: Muscle[],
  secondary: Muscle[] = [],
  type: ExerciseType = 'weight_reps',
  instructions?: string[],
): Exercise {
  return { id, name, equipment, bodyPart, primary, secondary, type, instructions };
}

export const BUILTIN_EXERCISES: Exercise[] = [
  // Hrudník
  ex('bench-press', 'Bench press (velká činka)', 'barbell', 'chest', ['chest'], ['triceps', 'shoulders'], 'weight_reps', [
    'Lehni si na lavici, oči pod osou, lopatky stáhni k sobě a dolů.',
    'Uchop osu o něco šířeji než na šířku ramen.',
    'Kontrolovaně spusť osu na spodní část hrudníku, lokty drž cca 45° od těla.',
    'Vytlač osu zpět nahoru, chodidla pevně na zemi.',
  ]),
  ex('incline-bench-press', 'Bench press na šikmé lavici', 'barbell', 'chest', ['chest'], ['shoulders', 'triceps']),
  ex('decline-bench-press', 'Bench press hlavou dolů', 'barbell', 'chest', ['chest'], ['triceps']),
  ex('db-bench-press', 'Tlaky s jednoručkami na rovné lavici', 'dumbbell', 'chest', ['chest'], ['triceps', 'shoulders']),
  ex('db-incline-press', 'Tlaky s jednoručkami na šikmé lavici', 'dumbbell', 'chest', ['chest'], ['shoulders', 'triceps']),
  ex('db-fly', 'Rozpažování s jednoručkami', 'dumbbell', 'chest', ['chest'], ['shoulders']),
  ex('cable-fly', 'Křížení kladek', 'cable', 'chest', ['chest'], ['shoulders']),
  ex('pec-deck', 'Peck deck (motýlek)', 'machine', 'chest', ['chest']),
  ex('chest-press-machine', 'Tlaky na stroji (hrudník)', 'machine', 'chest', ['chest'], ['triceps']),
  ex('push-up', 'Kliky', 'bodyweight', 'chest', ['chest'], ['triceps', 'shoulders', 'abs'], 'reps_only'),
  ex('dips', 'Kliky na bradlech', 'bodyweight', 'chest', ['chest', 'triceps'], ['shoulders'], 'weighted_bodyweight'),

  // Záda
  ex('deadlift', 'Mrtvý tah', 'barbell', 'back', ['lowerBack', 'glutes', 'hamstrings'], ['traps', 'lats', 'forearms', 'quads'], 'weight_reps', [
    'Postav se tak, aby osa byla nad středem chodidla.',
    'Uchop osu těsně vně kolen, záda rovná, hrudník nahoru.',
    'Zatlač nohama do země a táhni osu po nohách nahoru.',
    'Nahoře propni kyčle, neklop se dozadu. Spouštěj kontrolovaně.',
  ]),
  ex('sumo-deadlift', 'Mrtvý tah sumo', 'barbell', 'back', ['glutes', 'quads', 'lowerBack'], ['hamstrings', 'traps']),
  ex('barbell-row', 'Přítahy velké činky v předklonu', 'barbell', 'back', ['lats', 'traps'], ['biceps', 'rearDelts', 'lowerBack']),
  ex('pendlay-row', 'Pendlay přítahy', 'barbell', 'back', ['lats', 'traps'], ['biceps', 'rearDelts']),
  ex('db-row', 'Přítahy jednoručky jednoruč', 'dumbbell', 'back', ['lats'], ['biceps', 'rearDelts', 'traps']),
  ex('pull-up', 'Shyby nadhmatem', 'bodyweight', 'back', ['lats'], ['biceps', 'traps', 'forearms'], 'weighted_bodyweight', [
    'Chyť hrazdu nadhmatem o něco šířeji než ramena.',
    'Stáhni lopatky dolů a přitáhni se, dokud brada nepřejde hrazdu.',
    'Kontrolovaně se spusť do plného propnutí.',
  ]),
  ex('chin-up', 'Shyby podhmatem', 'bodyweight', 'back', ['lats', 'biceps'], ['traps'], 'weighted_bodyweight'),
  ex('assisted-pull-up', 'Shyby s dopomocí', 'machine', 'back', ['lats'], ['biceps'], 'assisted_bodyweight'),
  ex('lat-pulldown', 'Stahování horní kladky', 'cable', 'back', ['lats'], ['biceps', 'rearDelts']),
  ex('seated-cable-row', 'Přítahy spodní kladky vsedě', 'cable', 'back', ['lats', 'traps'], ['biceps', 'rearDelts']),
  ex('t-bar-row', 'T-bar přítahy', 'barbell', 'back', ['lats', 'traps'], ['biceps', 'rearDelts']),
  ex('machine-row', 'Přítahy na stroji', 'machine', 'back', ['lats', 'traps'], ['biceps']),
  ex('straight-arm-pulldown', 'Stahování kladky propnutými pažemi', 'cable', 'back', ['lats']),
  ex('shrug', 'Krčení ramen s velkou činkou', 'barbell', 'back', ['traps'], ['forearms']),
  ex('db-shrug', 'Krčení ramen s jednoručkami', 'dumbbell', 'back', ['traps'], ['forearms']),
  ex('back-extension', 'Hyperextenze', 'bodyweight', 'back', ['lowerBack'], ['glutes', 'hamstrings'], 'weighted_bodyweight'),

  // Nohy
  ex('squat', 'Dřep s velkou činkou', 'barbell', 'legs', ['quads', 'glutes'], ['hamstrings', 'lowerBack', 'abs'], 'weight_reps', [
    'Osu polož na horní část trapézů, chodidla na šířku ramen.',
    'Nadechni se, zpevni trup a jdi dolů tlakem kyčlí dozadu a kolen do stran.',
    'Klesej alespoň do paralely, záda neutrální.',
    'Zatlač do země celým chodidlem a vrať se nahoru.',
  ]),
  ex('front-squat', 'Čelní dřep', 'barbell', 'legs', ['quads'], ['glutes', 'abs']),
  ex('goblet-squat', 'Goblet dřep', 'dumbbell', 'legs', ['quads', 'glutes'], ['abs']),
  ex('leg-press', 'Leg press', 'machine', 'legs', ['quads', 'glutes'], ['hamstrings']),
  ex('hack-squat', 'Hackenův dřep', 'machine', 'legs', ['quads'], ['glutes']),
  ex('bulgarian-split-squat', 'Bulharský dřep', 'dumbbell', 'legs', ['quads', 'glutes'], ['hamstrings']),
  ex('lunge', 'Výpady s jednoručkami', 'dumbbell', 'legs', ['quads', 'glutes'], ['hamstrings']),
  ex('romanian-deadlift', 'Rumunský mrtvý tah', 'barbell', 'legs', ['hamstrings', 'glutes'], ['lowerBack', 'forearms']),
  ex('db-romanian-deadlift', 'Rumunský mrtvý tah s jednoručkami', 'dumbbell', 'legs', ['hamstrings', 'glutes'], ['lowerBack']),
  ex('leg-extension', 'Předkopávání', 'machine', 'legs', ['quads']),
  ex('leg-curl', 'Zakopávání vleže', 'machine', 'legs', ['hamstrings']),
  ex('seated-leg-curl', 'Zakopávání vsedě', 'machine', 'legs', ['hamstrings']),
  ex('hip-thrust', 'Hip thrust', 'barbell', 'legs', ['glutes'], ['hamstrings']),
  ex('glute-bridge', 'Glute bridge', 'bodyweight', 'legs', ['glutes'], ['hamstrings'], 'reps_only'),
  ex('standing-calf-raise', 'Výpony ve stoje', 'machine', 'legs', ['calves']),
  ex('seated-calf-raise', 'Výpony vsedě', 'machine', 'legs', ['calves']),
  ex('hip-adduction', 'Přitahování nohou na stroji', 'machine', 'legs', ['quads']),
  ex('hip-abduction', 'Unožování na stroji', 'machine', 'legs', ['glutes']),

  // Ramena
  ex('ohp', 'Tlak nad hlavu (velká činka)', 'barbell', 'shoulders', ['shoulders'], ['triceps', 'traps', 'abs'], 'weight_reps', [
    'Osu drž v úrovni klíčních kostí, úchop těsně vně ramen.',
    'Zpevni hýždě a břicho, tlač osu kolmo nahoru.',
    'Nahoře dostaň hlavu pod osu, pak kontrolovaně spusť.',
  ]),
  ex('db-shoulder-press', 'Tlaky s jednoručkami nad hlavu', 'dumbbell', 'shoulders', ['shoulders'], ['triceps']),
  ex('arnold-press', 'Arnold press', 'dumbbell', 'shoulders', ['shoulders'], ['triceps']),
  ex('machine-shoulder-press', 'Tlaky nad hlavu na stroji', 'machine', 'shoulders', ['shoulders'], ['triceps']),
  ex('lateral-raise', 'Upažování s jednoručkami', 'dumbbell', 'shoulders', ['shoulders']),
  ex('cable-lateral-raise', 'Upažování na kladce', 'cable', 'shoulders', ['shoulders']),
  ex('front-raise', 'Předpažování', 'dumbbell', 'shoulders', ['shoulders']),
  ex('rear-delt-fly', 'Zapažování v předklonu', 'dumbbell', 'shoulders', ['rearDelts'], ['traps']),
  ex('reverse-pec-deck', 'Reverse peck deck', 'machine', 'shoulders', ['rearDelts'], ['traps']),
  ex('face-pull', 'Face pull', 'cable', 'shoulders', ['rearDelts'], ['traps']),
  ex('upright-row', 'Přítahy k bradě', 'barbell', 'shoulders', ['shoulders', 'traps']),

  // Paže
  ex('barbell-curl', 'Bicepsový zdvih s velkou činkou', 'barbell', 'arms', ['biceps'], ['forearms']),
  ex('ez-curl', 'Bicepsový zdvih s EZ osou', 'barbell', 'arms', ['biceps'], ['forearms']),
  ex('db-curl', 'Bicepsový zdvih s jednoručkami', 'dumbbell', 'arms', ['biceps'], ['forearms']),
  ex('hammer-curl', 'Kladivové zdvihy', 'dumbbell', 'arms', ['biceps', 'forearms']),
  ex('incline-db-curl', 'Bicepsový zdvih na šikmé lavici', 'dumbbell', 'arms', ['biceps']),
  ex('preacher-curl', 'Scottův bicepsový zdvih', 'barbell', 'arms', ['biceps']),
  ex('cable-curl', 'Bicepsový zdvih na kladce', 'cable', 'arms', ['biceps']),
  ex('triceps-pushdown', 'Stahování kladky na triceps', 'cable', 'arms', ['triceps']),
  ex('overhead-triceps-extension', 'Tricepsové tlaky za hlavou', 'cable', 'arms', ['triceps']),
  ex('skull-crusher', 'Francouzský tlak vleže', 'barbell', 'arms', ['triceps']),
  ex('close-grip-bench', 'Bench press úzkým úchopem', 'barbell', 'arms', ['triceps'], ['chest', 'shoulders']),
  ex('db-kickback', 'Zanožování s jednoručkou (triceps)', 'dumbbell', 'arms', ['triceps']),
  ex('wrist-curl', 'Zápěstní zdvihy', 'dumbbell', 'arms', ['forearms']),

  // Střed těla
  ex('plank', 'Prkno', 'bodyweight', 'core', ['abs'], ['shoulders'], 'duration'),
  ex('side-plank', 'Boční prkno', 'bodyweight', 'core', ['abs'], [], 'duration'),
  ex('crunch', 'Sedy-lehy (crunch)', 'bodyweight', 'core', ['abs'], [], 'reps_only'),
  ex('cable-crunch', 'Zkracovačky na kladce', 'cable', 'core', ['abs']),
  ex('hanging-leg-raise', 'Zvedání nohou ve visu', 'bodyweight', 'core', ['abs'], ['forearms'], 'reps_only'),
  ex('ab-wheel', 'Kolečko na břicho', 'other', 'core', ['abs'], ['lats'], 'reps_only'),
  ex('russian-twist', 'Ruský twist', 'bodyweight', 'core', ['abs'], [], 'reps_only'),
  ex('pallof-press', 'Pallof press', 'cable', 'core', ['abs']),

  // Celé tělo
  ex('power-clean', 'Přemístění (power clean)', 'barbell', 'fullbody', ['quads', 'glutes', 'traps'], ['hamstrings', 'shoulders']),
  ex('kb-swing', 'Švihy s kettlebellem', 'kettlebell', 'fullbody', ['glutes', 'hamstrings'], ['lowerBack', 'shoulders']),
  ex('farmers-walk', 'Farmářská chůze', 'dumbbell', 'fullbody', ['forearms', 'traps'], ['abs'], 'weight_reps'),
  ex('burpee', 'Angličáky (burpees)', 'bodyweight', 'fullbody', ['quads', 'chest'], ['abs'], 'reps_only'),

  // Kardio
  ex('running', 'Běh', 'other', 'cardio', [], [], 'distance_duration'),
  ex('treadmill', 'Běžecký pás', 'machine', 'cardio', [], [], 'distance_duration'),
  ex('cycling', 'Kolo / rotoped', 'machine', 'cardio', [], [], 'distance_duration'),
  ex('rowing', 'Veslařský trenažér', 'machine', 'cardio', [], [], 'distance_duration'),
  ex('elliptical', 'Eliptický trenažér', 'machine', 'cardio', [], [], 'distance_duration'),
  ex('jump-rope', 'Švihadlo', 'other', 'cardio', [], [], 'duration'),
  ex('stair-climber', 'Schodový trenažér', 'machine', 'cardio', [], [], 'duration'),
];

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: 'Hrudník',
  back: 'Záda',
  legs: 'Nohy',
  shoulders: 'Ramena',
  arms: 'Paže',
  core: 'Střed těla',
  cardio: 'Kardio',
  fullbody: 'Celé tělo',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Velká činka',
  dumbbell: 'Jednoručky',
  machine: 'Stroj',
  cable: 'Kladka',
  kettlebell: 'Kettlebell',
  bodyweight: 'Vlastní váha',
  band: 'Guma',
  other: 'Ostatní',
};

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Váha × opakování',
  weighted_bodyweight: 'Vlastní váha + zátěž',
  assisted_bodyweight: 'Vlastní váha s dopomocí',
  reps_only: 'Jen opakování',
  duration: 'Čas',
  distance_duration: 'Vzdálenost a čas',
};

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Prsa',
  lats: 'Široký sval zádový',
  traps: 'Trapézy',
  lowerBack: 'Spodní záda',
  shoulders: 'Ramena',
  rearDelts: 'Zadní ramena',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Předloktí',
  abs: 'Břicho',
  quads: 'Stehna (přední)',
  hamstrings: 'Stehna (zadní)',
  glutes: 'Hýždě',
  calves: 'Lýtka',
};

export const ALL_MUSCLES = Object.keys(MUSCLE_LABELS) as Muscle[];

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
