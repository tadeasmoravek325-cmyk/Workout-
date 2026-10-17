import type { Unit } from '../types';
import { LOCALE_TAG, t, tn } from '../i18n';

export const KG_PER_LB = 0.45359237;

export function toDisplayWeight(kg: number | undefined, unit: Unit): number | undefined {
  if (kg === undefined || kg === null || Number.isNaN(kg)) return undefined;
  const v = unit === 'kg' ? kg : kg / KG_PER_LB;
  return Math.round(v * 100) / 100;
}

export function fromDisplayWeight(v: number | undefined, unit: Unit): number | undefined {
  if (v === undefined || Number.isNaN(v)) return undefined;
  return unit === 'kg' ? v : v * KG_PER_LB;
}

export function fmtNum(v: number | undefined, digits = 1): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '–';
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return r.toLocaleString(LOCALE_TAG, { maximumFractionDigits: digits });
}

export function fmtWeight(kg: number | undefined, unit: Unit, digits = 1): string {
  const v = toDisplayWeight(kg, unit);
  if (v === undefined) return '–';
  return `${fmtNum(v, digits)} ${unit}`;
}

export function fmtVolume(kg: number, unit: Unit): string {
  const v = toDisplayWeight(kg, unit) ?? 0;
  if (v >= 10000) return unit === 'kg' ? `${fmtNum(v / 1000, 1)} t` : `${fmtNum(v / 1000, 1)}k lb`;
  return `${fmtNum(v, 0)} ${unit}`;
}

export function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? h + ':' : ''}${mm}:${String(r).padStart(2, '0')}`;
}

export function parseClock(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return Number(t);
  const parts = t.split(':').map(Number);
  if (parts.some((p) => Number.isNaN(p))) return undefined;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function fmtDate(ts: number, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  return new Date(ts).toLocaleDateString(LOCALE_TAG, opts);
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString(LOCALE_TAG, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeDay(ts: number, now = Date.now()): string {
  const day = 86_400_000;
  const d0 = new Date(now);
  d0.setHours(0, 0, 0, 0);
  const diff = Math.floor((d0.getTime() - new Date(ts).setHours(0, 0, 0, 0)) / day);
  if (diff <= 0) return t('Today');
  if (diff === 1) return t('Yesterday');
  if (diff < 7) return tn(diff, '{n} day ago', '{n} days ago');
  return fmtDate(ts, { day: 'numeric', month: 'short' });
}

/** Plural-aware label: plural(3, 'workout', 'workouts') → 'workouts'. */
export function plural(n: number, one: string, other: string): string {
  return tn(n, one, other);
}

/** Splits "12.4 t" into a big number and a small unit. */
export function splitUnit(s: string): [string, string] {
  const i = s.indexOf(' ');
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}
