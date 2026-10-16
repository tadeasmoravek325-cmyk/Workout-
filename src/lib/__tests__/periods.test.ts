import { describe, expect, it } from 'vitest';
import {
  addMonths,
  bucketIndex,
  change,
  customPeriod,
  formatRange,
  inPeriod,
  periodBuckets,
  previousPeriod,
  resolvePeriod,
} from '../periods';

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min).getTime();
const WEEK = 7 * 86_400_000;
// Friday 16 Oct 2026, 15:30
const NOW = d(2026, 10, 16, 15, 30);

describe('addMonths', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths(d(2026, 3, 31), -1)).toBe(d(2026, 2, 28));
    expect(addMonths(d(2024, 3, 31), -1)).toBe(d(2024, 2, 29));
    expect(addMonths(d(2026, 1, 31), 1)).toBe(d(2026, 2, 28));
    expect(addMonths(d(2026, 10, 16), -12)).toBe(d(2025, 10, 16));
    expect(addMonths(d(2026, 1, 15), -1)).toBe(d(2025, 12, 15));
  });
});

describe('resolvePeriod', () => {
  it('week starts on Monday and runs to now, chart spans Mon–Sun by day', () => {
    const p = resolvePeriod('week', NOW);
    expect(p.from).toBe(d(2026, 10, 12));
    expect(p.to).toBe(NOW);
    expect(p.weeks).toBe(1);
    expect(p.bucket).toBe('day');
    expect(periodBuckets(p)).toHaveLength(7);
    expect(p.chartTo).toBe(d(2026, 10, 19));
    expect(p.label).toBe('12–16 Oct 2026');
  });

  it('week on a Sunday still starts on the Monday before', () => {
    const p = resolvePeriod('week', d(2026, 10, 18, 20));
    expect(p.from).toBe(d(2026, 10, 12));
  });

  it('month is the calendar month to date, bucketed by week', () => {
    const p = resolvePeriod('month', NOW);
    expect(p.from).toBe(d(2026, 10, 1));
    expect(p.to).toBe(NOW);
    expect(p.bucket).toBe('week');
    expect(p.weeks).toBeCloseTo((NOW - d(2026, 10, 1)) / WEEK, 3);
    expect(p.chartTo).toBe(d(2026, 11, 1));
    expect(p.label).toBe('1–16 Oct 2026');
  });

  it('month on the 1st has a minimum of one week', () => {
    const p = resolvePeriod('month', d(2026, 10, 1, 9));
    expect(p.weeks).toBe(1);
    expect(p.label).toBe('1 Oct 2026');
  });

  it('rolling 3/6/12 months end now', () => {
    const p3 = resolvePeriod('3m', NOW);
    expect(p3.from).toBe(d(2026, 7, 17));
    expect(p3.to).toBe(NOW);
    expect(p3.bucket).toBe('week');
    expect(p3.weeks).toBeGreaterThan(13);
    expect(p3.weeks).toBeLessThan(13.5);

    const p6 = resolvePeriod('6m', NOW);
    expect(p6.from).toBe(d(2026, 4, 17));
    expect(p6.bucket).toBe('week');

    const p12 = resolvePeriod('12m', NOW);
    expect(p12.from).toBe(d(2025, 10, 17));
    expect(p12.bucket).toBe('month');
    expect(p12.label).toBe('17 Oct 2025 – 16 Oct 2026');
    // 12 month buckets + the current one (Oct 2025 is partial at the start)
    expect(periodBuckets(p12)).toHaveLength(13);
  });

  it('rolling months near month ends', () => {
    // 31 May − 3 months = 28 Feb (clamped), then next day
    const p = resolvePeriod('3m', d(2026, 5, 31, 12));
    expect(p.from).toBe(d(2026, 3, 1));
  });

  it('year is the calendar year to date, monthly, chart Jan–Dec', () => {
    const p = resolvePeriod('year', NOW);
    expect(p.from).toBe(d(2026, 1, 1));
    expect(p.bucket).toBe('month');
    expect(periodBuckets(p)).toHaveLength(12);
    expect(p.label).toBe('1 Jan – 16 Oct 2026');
  });

  it('custom without a range falls back to the last 4 weeks', () => {
    const p = resolvePeriod('custom', NOW);
    expect(p.from).toBe(d(2026, 9, 19));
    expect(p.to).toBe(d(2026, 10, 17));
    expect(p.weeks).toBe(4);
  });
});

describe('custom ranges', () => {
  it('includes both days', () => {
    const p = customPeriod({ from: d(2026, 9, 1, 14), to: d(2026, 10, 16, 8) });
    expect(p.from).toBe(d(2026, 9, 1));
    expect(p.to).toBe(d(2026, 10, 17));
    expect(inPeriod(d(2026, 10, 16, 23, 59), p)).toBe(true);
    expect(inPeriod(d(2026, 10, 17), p)).toBe(false);
    expect(inPeriod(d(2026, 8, 31, 23, 59), p)).toBe(false);
    expect(p.label).toMatch(/^1 Sept? – 16 Oct 2026$/);
    expect(p.bucket).toBe('week');
  });

  it('swaps reversed ends', () => {
    const p = customPeriod({ from: d(2026, 10, 16), to: d(2026, 10, 10) });
    expect(p.from).toBe(d(2026, 10, 10));
    expect(p.to).toBe(d(2026, 10, 17));
  });

  it('single day is one day, one bucket, weeks = 1', () => {
    const p = customPeriod({ from: d(2026, 10, 5), to: d(2026, 10, 5) });
    expect(p.to - p.from).toBe(86_400_000);
    expect(p.weeks).toBe(1);
    expect(p.bucket).toBe('day');
    expect(periodBuckets(p)).toHaveLength(1);
    expect(p.label).toBe('5 Oct 2026');
  });

  it('chooses bucket size by length', () => {
    expect(customPeriod({ from: d(2026, 10, 1), to: d(2026, 10, 14) }).bucket).toBe('day');
    expect(customPeriod({ from: d(2026, 10, 1), to: d(2026, 10, 15) }).bucket).toBe('week');
    expect(customPeriod({ from: d(2026, 1, 1), to: d(2026, 6, 30) }).bucket).toBe('week');
    expect(customPeriod({ from: d(2025, 1, 1), to: d(2026, 6, 30) }).bucket).toBe('month');
  });

  it('weeks are fractional', () => {
    const p = customPeriod({ from: d(2026, 9, 1), to: d(2026, 9, 21) });
    expect(p.weeks).toBeCloseTo(3, 1);
  });

  it('spans years', () => {
    const p = customPeriod({ from: d(2025, 12, 20), to: d(2026, 1, 10) });
    expect(p.label).toBe('20 Dec 2025 – 10 Jan 2026');
    expect(periodBuckets(p).map((b) => new Date(b.start).getDay())).toEqual([1, 1, 1, 1]);
  });
});

describe('previousPeriod', () => {
  it('week compares with last week up to the same moment', () => {
    const p = resolvePeriod('week', NOW);
    const q = previousPeriod(p);
    expect(q.from).toBe(d(2026, 10, 5));
    expect(q.to).toBe(d(2026, 10, 9, 15, 30));
    expect(q.chartTo).toBe(p.from);
  });

  it('month compares with the same days of the previous month', () => {
    const q = previousPeriod(resolvePeriod('month', NOW));
    expect(q.from).toBe(d(2026, 9, 1));
    expect(q.to).toBe(d(2026, 9, 16, 15, 30));
  });

  it('month at the end of a long month never spills into the current one', () => {
    const q = previousPeriod(resolvePeriod('month', d(2026, 3, 31, 20)));
    expect(q.from).toBe(d(2026, 2, 1));
    expect(q.to).toBe(d(2026, 3, 1));
  });

  it('January month compares with December', () => {
    const q = previousPeriod(resolvePeriod('month', d(2026, 1, 10, 12)));
    expect(q.from).toBe(d(2025, 12, 1));
    expect(q.to).toBe(d(2025, 12, 10, 12));
  });

  it('year compares with the same part of last year', () => {
    const q = previousPeriod(resolvePeriod('year', NOW));
    expect(q.from).toBe(d(2025, 1, 1));
    expect(q.to).toBe(d(2025, 10, 16, 15, 30));
  });

  it('rolling windows are the same length right before', () => {
    const p = resolvePeriod('3m', NOW);
    const q = previousPeriod(p);
    expect(q.to).toBe(p.from);
    expect(q.to - q.from).toBe(p.to - p.from);
  });

  it('custom whole-day ranges step back the same number of days', () => {
    const p = customPeriod({ from: d(2026, 10, 1), to: d(2026, 10, 10) });
    const q = previousPeriod(p);
    expect(q.from).toBe(d(2026, 9, 21));
    expect(q.to).toBe(d(2026, 10, 1));
    expect(q.label).toMatch(/^21–30 Sept? 2026$/);
  });
});

describe('buckets', () => {
  it('month buckets by Monday-start weeks covering the whole month', () => {
    const b = periodBuckets(resolvePeriod('month', NOW));
    expect(b[0].start).toBe(d(2026, 9, 28));
    expect(b[b.length - 1].start).toBe(d(2026, 10, 26));
    expect(b).toHaveLength(5);
  });

  it('bucketIndex finds the containing bucket', () => {
    const b = periodBuckets(resolvePeriod('week', NOW));
    expect(bucketIndex(b, d(2026, 10, 12))).toBe(0);
    expect(bucketIndex(b, d(2026, 10, 16, 18))).toBe(4);
    expect(bucketIndex(b, d(2026, 10, 18, 23, 59))).toBe(6);
    expect(bucketIndex(b, d(2026, 10, 19))).toBe(-1);
    expect(bucketIndex(b, d(2026, 10, 11, 23))).toBe(-1);
  });
});

describe('formatRange and change', () => {
  it('formats', () => {
    expect(formatRange(d(2026, 10, 16), d(2026, 10, 17))).toBe('16 Oct 2026');
    expect(formatRange(d(2026, 10, 1), d(2026, 10, 17))).toBe('1–16 Oct 2026');
  });

  it('change is relative, null without a baseline', () => {
    expect(change(12, 10)).toBeCloseTo(0.2);
    expect(change(5, 10)).toBeCloseTo(-0.5);
    expect(change(5, 0)).toBeNull();
    expect(change(0, 0)).toBeNull();
  });
});
