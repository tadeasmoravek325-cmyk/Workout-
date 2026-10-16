import { startOfDay, startOfWeek } from './calc';
import { LOCALE_TAG, t, tn } from '../i18n';

/**
 * Time periods for the Stats page. Pure functions; every timestamp is local time in ms.
 * A period is the half-open interval [from, to).
 */

export type PeriodPreset = 'week' | 'month' | '3m' | '6m' | '12m' | 'year' | 'custom';
export type Bucket = 'day' | 'week' | 'month';

export const PERIOD_PRESETS: PeriodPreset[] = ['week', 'month', '3m', '6m', '12m', 'year', 'custom'];

/** Custom range in whole days: both ends are included. Any timestamp within the day works. */
export interface CustomRange {
  from: number;
  to: number;
}

export interface Period {
  preset: PeriodPreset;
  /** Inclusive start. */
  from: number;
  /** Exclusive end. For periods that run up to today this is `now`, so comparisons are like for like. */
  to: number;
  /** Human readable range, e.g. "1 Sep – 16 Oct 2026". */
  label: string;
  /** Length in weeks (fractional, at least 1) for per-week averages. */
  weeks: number;
  /** Chart bucket size. */
  bucket: Bucket;
  /** Range the chart spans. Covers the whole calendar unit (Mon–Sun, the full month/year) for calendar presets. */
  chartFrom: number;
  chartTo: number;
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Same day-of-month `n` months away, clamped to the month end (31 Mar − 1 month = 28/29 Feb). */
export function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.getTime();
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function startOfYear(ts: number): number {
  return new Date(new Date(ts).getFullYear(), 0, 1).getTime();
}

/** Whole calendar days between two day starts (DST safe). */
function dayCount(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

function bucketForDays(days: number): Bucket {
  if (days <= 14) return 'day';
  if (days <= 190) return 'week';
  return 'month';
}

/** "16 Oct 2026", "1–16 Oct 2026", "1 Sep – 16 Oct 2026", "17 Oct 2025 – 16 Oct 2026". `to` is exclusive. */
export function formatRange(from: number, to: number): string {
  const a = new Date(from);
  const b = new Date(Math.max(from, to - 1));
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  const full: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const end = b.toLocaleDateString(LOCALE_TAG, full);
  if (sameMonth && a.getDate() === b.getDate()) return end;
  if (sameMonth) return `${a.getDate()}–${end}`;
  const start = a.toLocaleDateString(LOCALE_TAG, sameYear ? { day: 'numeric', month: 'short' } : full);
  return `${start} – ${end}`;
}

/** Short name of a preset for chips. */
export function presetName(p: PeriodPreset): string {
  switch (p) {
    case 'week':
      return t('Week');
    case 'month':
      return t('Month');
    case '3m':
      return tn(3, '{n} month', '{n} months');
    case '6m':
      return tn(6, '{n} month', '{n} months');
    case '12m':
      return tn(12, '{n} month', '{n} months');
    case 'year':
      return t('Year');
    case 'custom':
      return t('Custom…');
  }
}

function make(preset: PeriodPreset, from: number, to: number, bucket: Bucket, chartFrom = from, chartTo = to): Period {
  return {
    preset,
    from,
    to,
    label: formatRange(from, to),
    weeks: Math.max(1, (to - from) / WEEK_MS),
    bucket,
    chartFrom,
    chartTo,
  };
}

/** Normalise a custom range: whole days, swapped if reversed, `to` made exclusive. */
export function customPeriod(range: CustomRange): Period {
  let a = startOfDay(range.from);
  let b = startOfDay(range.to);
  if (b < a) [a, b] = [b, a];
  const to = addDays(b, 1);
  return make('custom', a, to, bucketForDays(dayCount(a, to)));
}

export function resolvePeriod(preset: PeriodPreset, now: number, custom?: CustomRange): Period {
  switch (preset) {
    case 'week': {
      const from = startOfWeek(now);
      return make('week', from, now, 'day', from, addDays(from, 7));
    }
    case 'month': {
      const from = startOfMonth(now);
      return make('month', from, now, 'week', from, addMonths(from, 1));
    }
    case '3m':
    case '6m':
    case '12m': {
      const months = preset === '3m' ? 3 : preset === '6m' ? 6 : 12;
      const from = addDays(startOfDay(addMonths(now, -months)), 1);
      return make(preset, from, now, months === 12 ? 'month' : 'week');
    }
    case 'year': {
      const from = startOfYear(now);
      return make('year', from, now, 'month', from, new Date(new Date(now).getFullYear() + 1, 0, 1).getTime());
    }
    case 'custom':
      return customPeriod(custom ?? { from: addDays(now, -27), to: now });
  }
}

/**
 * The window to compare against, right before `p` and of the same length.
 * Calendar presets compare with the same part of the previous calendar unit
 * (1–16 Oct vs 1–16 Sep, Mon–Wed vs last Mon–Wed), which is the same length and lines up with how people think.
 */
export function previousPeriod(p: Period): Period {
  let from: number;
  let to: number;
  let chartFrom: number;
  let chartTo: number;
  if (p.preset === 'week') {
    from = addDays(p.from, -7);
    to = p.to - (p.from - from);
    chartFrom = from;
    chartTo = p.from;
  } else if (p.preset === 'month' || p.preset === 'year') {
    const step = p.preset === 'month' ? -1 : -12;
    from = addMonths(p.from, step);
    // Keep the elapsed time, but never spill into the current unit (31 Oct → 30 Sep).
    to = Math.min(from + (p.to - p.from), p.from);
    chartFrom = from;
    chartTo = p.from;
  } else {
    to = p.from;
    // Whole-day windows step back in calendar days (DST safe); windows ending "now" by their exact length.
    from = p.to === startOfDay(p.to) ? addDays(p.from, -dayCount(p.from, p.to)) : p.from - (p.to - p.from);
    chartFrom = from;
    chartTo = to;
  }
  return { ...p, from, to, label: formatRange(from, to), weeks: Math.max(1, (to - from) / WEEK_MS), chartFrom, chartTo };
}

export interface BucketRange {
  start: number;
  end: number;
}

function bucketStart(ts: number, bucket: Bucket): number {
  if (bucket === 'day') return startOfDay(ts);
  if (bucket === 'week') return startOfWeek(ts);
  return startOfMonth(ts);
}

function nextBucket(ts: number, bucket: Bucket): number {
  if (bucket === 'day') return addDays(ts, 1);
  if (bucket === 'week') return addDays(ts, 7);
  return addMonths(ts, 1);
}

/** Consecutive chart buckets covering the period's chart range. The first one may start before `chartFrom`. */
export function periodBuckets(p: Period): BucketRange[] {
  const out: BucketRange[] = [];
  let s = bucketStart(p.chartFrom, p.bucket);
  while (s < p.chartTo && out.length < 400) {
    const e = nextBucket(s, p.bucket);
    out.push({ start: s, end: e });
    s = e;
  }
  return out;
}

/** Index of the bucket containing `ts`, or -1. Buckets are sorted and contiguous. */
export function bucketIndex(buckets: BucketRange[], ts: number): number {
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ts < buckets[mid].start) hi = mid - 1;
    else if (ts >= buckets[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

export function inPeriod(ts: number, p: { from: number; to: number }): boolean {
  return ts >= p.from && ts < p.to;
}

/** Relative change; null when there is nothing to compare with (previous 0). */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}
