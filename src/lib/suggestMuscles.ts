import type { BodyPart, Equipment, Exercise, ExerciseType, Muscle } from '../types';

const NOISE = new Set(['the', 'a', 'on', 'with', 'and', 'of', 'to', 'machine', 'barbell', 'dumbbell', 'cable', 'smith', 'kettlebell', 'band', 'bodyweight', 'seated', 'standing', 'lying', 'one', 'arm', 'single', 'wide', 'close', 'grip', 'reverse', 'incline', 'decline', 'flat']);

const EQUIPMENT_WORDS: [RegExp, Equipment][] = [
  [/barbell|ez[- ]?bar|smith/i, 'barbell'],
  [/dumbbell|\bdb\b/i, 'dumbbell'],
  [/cable|pulldown|pushdown/i, 'cable'],
  [/machine|press\b.*\bplate[- ]?loaded|hack|pec deck|leg press|leg extension|leg curl/i, 'machine'],
];

export interface MuscleSuggestion {
  primary: Muscle[];
  secondary: Muscle[];
  bodyPart: BodyPart;
  equipment?: Equipment;
  type: ExerciseType;
  /** Exercises the suggestion is based on. */
  basedOn: string[];
}

function words(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .filter((w) => w && !NOISE.has(w));
}

/**
 * Guesses muscles for a new exercise from the closest built-in exercises by name.
 * Returns null when nothing in the library shares a meaningful word.
 */
export function suggestMuscles(name: string, all: Exercise[]): MuscleSuggestion | null {
  const mine = words(name);
  if (!mine.length) return null;
  const scored = all
    .filter((e) => !e.custom && e.primary.length)
    .map((e) => {
      const theirs = words(e.name);
      const shared = theirs.filter((w) => mine.includes(w)).length;
      return { e, score: shared / Math.max(mine.length, theirs.length) + (shared ? 0.01 * shared : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;

  const best = scored[0].score;
  const top = scored.filter((x) => x.score >= best - 0.001).slice(0, 3).map((x) => x.e);
  const count = new Map<Muscle, { p: number; s: number }>();
  for (const e of top) {
    for (const m of e.primary) count.set(m, { p: (count.get(m)?.p ?? 0) + 1, s: count.get(m)?.s ?? 0 });
    for (const m of e.secondary) count.set(m, { p: count.get(m)?.p ?? 0, s: (count.get(m)?.s ?? 0) + 1 });
  }
  // A muscle counts when most of the matches agree on it.
  const need = Math.ceil(top.length / 2);
  const primary: Muscle[] = [];
  const secondary: Muscle[] = [];
  for (const [m, c] of count) {
    if (c.p >= need) primary.push(m);
    else if (c.p + c.s >= need) secondary.push(m);
  }
  if (!primary.length) return null;
  const equipment = EQUIPMENT_WORDS.find(([re]) => re.test(name))?.[1];
  return { primary, secondary, bodyPart: top[0].bodyPart, equipment, type: top[0].type, basedOn: top.map((e) => e.name) };
}
