import type { Exercise } from '../types';

/** Words that don't tell two exercise names apart. */
const SKIP = new Set(['the', 'a', 'with', 'on']);

/** Same exercise written differently: "Squat (Smith Machine)" and "Smith Machine Squat" share a key. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !SKIP.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .sort()
    .join(' ');
}

export interface DuplicateGroup {
  /** The exercise everything is merged into: the built-in one, else the most used. */
  target: Exercise;
  /** Custom exercises that duplicate it. */
  sources: Exercise[];
}

/** Custom exercises whose name matches another exercise, grouped with the one to keep. */
export function findDuplicates(all: Exercise[], uses: Map<string, number>): DuplicateGroup[] {
  const byKey = new Map<string, Exercise[]>();
  for (const e of all) {
    const k = nameKey(e.name);
    if (!k) continue;
    byKey.set(k, [...(byKey.get(k) ?? []), e]);
  }
  const out: DuplicateGroup[] = [];
  for (const group of byKey.values()) {
    if (group.length < 2 || !group.some((e) => e.custom)) continue;
    const builtin = group.find((e) => !e.custom);
    const ranked = [...group].sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0));
    const target = builtin ?? ranked[0];
    out.push({ target, sources: group.filter((e) => e.id !== target.id) });
  }
  return out.sort((a, b) => a.target.name.localeCompare(b.target.name));
}

/** Points every entry that used `from` at `to`. Returns the new list and how many items changed. */
export function remapExercise<T extends { exercises: { exerciseId: string }[] }>(items: T[], from: string, to: string): { items: T[]; changed: number } {
  let changed = 0;
  const next = items.map((it) => {
    if (!it.exercises.some((e) => e.exerciseId === from)) return it;
    changed++;
    return { ...it, exercises: it.exercises.map((e) => (e.exerciseId === from ? { ...e, exerciseId: to } : e)) };
  });
  return { items: next, changed };
}
