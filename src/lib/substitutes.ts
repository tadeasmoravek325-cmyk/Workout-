import type { Exercise } from '../types';

/** Alternatives that train the same muscles, best match first. */
export function findSubstitutes(target: Exercise, all: Exercise[], limit = 8): Exercise[] {
  if (!target.primary.length) {
    return all.filter((e) => e.id !== target.id && e.bodyPart === target.bodyPart).slice(0, limit);
  }
  const scored = all
    .filter((e) => e.id !== target.id && e.bodyPart !== 'cardio')
    .map((e) => {
      const primaryOverlap = e.primary.filter((m) => target.primary.includes(m)).length;
      const secondaryOverlap = e.secondary.filter((m) => target.secondary.includes(m)).length;
      let score = primaryOverlap * 3 + secondaryOverlap;
      if (primaryOverlap && e.primary[0] === target.primary[0]) score += 2;
      if (e.bodyPart === target.bodyPart) score += 1;
      if (e.type === target.type) score += 0.5;
      // Prefer exercises with similar focus (penalize extra primary muscles).
      score -= Math.abs(e.primary.length - target.primary.length) * 0.5;
      return { e, score, primaryOverlap };
    })
    .filter((x) => x.primaryOverlap > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.e);
}
