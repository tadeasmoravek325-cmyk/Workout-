/**
 * Minimal translation layer.
 *
 * Source strings are written in English directly in the code and wrapped in `t()`.
 * Another language is added by providing a dictionary keyed by the English text,
 * so no component needs to change. Plurals go through `tn()` and Intl.PluralRules.
 */

export type Locale = 'en';

/** BCP 47 tag used for dates and numbers. en-GB gives day-month order and a 24h clock. */
export const LOCALE_TAG = 'en-GB';

type Dict = Record<string, string | Partial<Record<Intl.LDMLPluralRule, string>>>;

const dictionaries: Record<Locale, Dict> = { en: {} };
let current: Locale = 'en';
let rules = new Intl.PluralRules(LOCALE_TAG);

export function setLocale(locale: Locale) {
  current = locale;
  rules = new Intl.PluralRules(LOCALE_TAG);
}

function fill(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Translate a string. `{name}` placeholders are filled from `vars`. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const entry = dictionaries[current][text];
  return fill(typeof entry === 'string' ? entry : text, vars);
}

/**
 * Plural-aware translation: tn(3, '{n} workout', '{n} workouts').
 * `{n}` is filled automatically.
 */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  const entry = dictionaries[current][other];
  const category = rules.select(n);
  let text: string;
  if (entry && typeof entry === 'object') text = entry[category] ?? entry.other ?? other;
  else text = category === 'one' ? one : other;
  return fill(text, { n, ...vars });
}
