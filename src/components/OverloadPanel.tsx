import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { Session } from '../core/history';
import { compareBest, slotOf } from '../core/progress/trend';
import { defaultFocus, targetFor } from '../core/progress/engine';
import { overloadSeries, overloadState } from '../lib/overload';
import { fmtDate, fmtNum, toDisplayWeight } from '../lib/format';
import { useStore } from '../store/store';
import { t, tn } from '../i18n';

const RANGES = [6, 12, 24, 0] as const; // 0 = all sessions
const KEY = 'overload-range';
const load = (): number => {
  try {
    const raw = localStorage.getItem(KEY);
    const v = Number(raw);
    return raw !== null && RANGES.includes(v as (typeof RANGES)[number]) ? v : 12;
  } catch {
    return 12;
  }
};

/** Words for the change between the recent best set and the one before, e.g. "+2.5 kg" or "+1 rep". */
export function describeDelta(d: { weight: number; reps: number } | null, unit: 'kg' | 'lb'): string {
  if (!d) return '';
  if (Math.abs(d.weight) > 0.01) {
    const w = toDisplayWeight(Math.abs(d.weight), unit) ?? 0;
    return `${d.weight > 0 ? '+' : '−'}${fmtNum(w)} ${unit}`;
  }
  if (d.reps !== 0) return `${d.reps > 0 ? '+' : '−'}${tn(Math.abs(d.reps), '{n} rep', '{n} reps')}`;
  return '';
}

/**
 * Progressive overload for one lift, from what was actually lifted: the best set of each session (heaviest weight that
 * reached the bottom of the rep range, then most reps). Sessions are compared with sessions done in the same position in
 * the workout, so incline press done first is not judged against incline press done after the bench press.
 */
export function OverloadPanel({ sessions, exerciseId }: { sessions: Session[]; exerciseId: string }) {
  const settings = useStore((s) => s.settings);
  const unit = settings.unit;
  const [range, setRange] = useState(load);
  // Which order the chart emphasises and the verdict is about. Switched with the buttons under the chart.
  const [focus, setFocus] = useState<'first' | 'after'>('first');
  const repMin = targetFor(exerciseId, settings.exerciseTargets, defaultFocus(settings)).repMin;
  const pick = (n: number) => {
    setRange(n);
    try {
      localStorage.setItem(KEY, String(n));
    } catch {
      /* storage unavailable */
    }
  };
  const series = overloadSeries(sessions, range || sessions.length, repMin);
  if (series.length < 2) return null;
  const verdict = overloadSeries(sessions, 11, repMin);
  const hasBoth = series.some((p) => p.slot === 'fatigued') && series.some((p) => p.slot !== 'fatigued');
  const result = overloadState(verdict, hasBoth ? (focus === 'after' ? 'fatigued' : 'fresh') : undefined);
  const { delta, moreWork, slot, mixed } = result;
  // When you pick an order that has too few sessions, do not quietly judge it from the other order.
  const state = hasBoth && mixed ? 'new' : result.state;
  const Icon = state === 'up' ? TrendingUp : state === 'down' ? TrendingDown : Minus;
  const label = state === 'up' ? t('Progressing') : state === 'down' ? t('Going backwards') : state === 'flat' ? t('Plateau') : t('Collecting data');
  const change = moreWork ? t('more work') : describeDelta(delta, unit);
  const where =
    slot === undefined || mixed
      ? ''
      : slot === 'fresh'
        ? t('Compared with sessions where you did it before other work for this muscle.')
        : t('Compared with sessions where you did it after other work for this muscle.');
  const inFocus = hasBoth ? series.filter((p) => (p.slot === 'fatigued') === (focus === 'after')) : series;
  const shown = [...inFocus].slice(-6).reverse();

  return (
    <div className="card mt">
      <div className="row between">
        <div className="bold">{t('Progressive overload')}</div>
        <div className={`overload-${state} row`} style={{ gap: 6 }}>
          <Icon size={16} aria-hidden="true" />
          <span className="bold small">{change && state !== 'new' ? `${label} ${change}` : label}</span>
        </div>
      </div>
      <div className="small muted" style={{ margin: '4px 0 8px' }}>
        {t('Based on your best set: the heaviest weight with at least {n} reps, then the most reps. Last 3 sessions against the 8 before.', { n: repMin })}{' '}
        {where}
        {mixed && ` ${hasBoth ? t('Too few sessions in this order to judge yet.') : t('Too few sessions in the same position, so all sessions are compared.')}`}
      </div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {RANGES.map((n) => (
          <button key={n} className={`chip ${range === n ? 'on' : ''}`} onClick={() => pick(n)}>
            {n ? t('Last {n}', { n }) : t('All')}
          </button>
        ))}
      </div>
      <div style={{ height: 150 }}>
        <ResponsiveContainer>
          <LineChart
            data={series.map((p) => {
              const w = toDisplayWeight(p.best.weight, unit) ?? 0;
              // Two lines: the same lift done first versus after other work for the muscle never share a line.
              return { d: fmtDate(p.date), first: p.slot === 'fatigued' ? null : w, after: p.slot === 'fatigued' ? w : null, reps: p.best.reps };
            })}
            margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="d" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
            {/* Only points of the order selected below the chart answer a tap; the faded line is for orientation. */}
            <Tooltip
              content={({ active, payload, label }) => {
                const row = payload?.[0]?.payload as { first: number | null; after: number | null; reps: number } | undefined;
                const key = !hasBoth || focus === 'first' ? 'first' : 'after';
                const v = row?.[key];
                if (!active || !row || v == null) return null;
                return (
                  <div style={{ background: 'var(--card-2)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                    <div className="muted">{label}</div>
                    <div className="bold">
                      {v} {unit} × {row.reps}
                    </div>
                  </div>
                );
              }}
            />
            <Line type="stepAfter" dataKey="first" stroke="var(--accent)" strokeWidth={!hasBoth || focus === 'first' ? 2.5 : 1.5} strokeOpacity={!hasBoth || focus === 'first' ? 1 : 0.25} dot={series.length <= 24 && (!hasBoth || focus === 'first')} activeDot={!hasBoth || focus === 'first'} connectNulls />
            <Line type="stepAfter" dataKey="after" stroke={focus === 'after' ? 'var(--accent)' : 'var(--muted)'} strokeWidth={focus === 'after' ? 2.5 : 1.5} strokeOpacity={focus === 'after' ? 1 : 0.25} strokeDasharray="4 3" dot={series.length <= 24 && focus === 'after'} activeDot={focus === 'after'} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasBoth && (
        <div className="chips" style={{ margin: '8px 0' }}>
          <button className={`chip ${focus === 'first' ? 'on' : ''}`} onClick={() => setFocus('first')}>
            <span aria-hidden="true">━</span> {t('Done first')}
          </button>
          <button className={`chip ${focus === 'after' ? 'on' : ''}`} onClick={() => setFocus('after')}>
            <span aria-hidden="true">┅</span> {t('After other work')}
          </button>
        </div>
      )}
      {shown.map((p, i) => {
        const prev = shown[i + 1];
        const comparable = prev && slotOf(prev.priorSets) === slotOf(p.priorSets);
        const c = comparable ? compareBest(p.best, prev.best) : 0;
        return (
          <div key={p.date} className="row between small" style={{ padding: '3px 0' }}>
            <span className="muted">
              {fmtDate(p.date)}
              {p.slot === 'fatigued' && ` · ${t('after other work')}`}
            </span>
            <span>
              {fmtNum(toDisplayWeight(p.best.weight, unit))} {unit} × {p.best.reps}
              {p.belowRange && <span className="muted"> *</span>}
              {c !== 0 && <span className={c > 0 ? 'overload-up' : 'overload-down'}> {c > 0 ? '▲' : '▼'}</span>}
            </span>
          </div>
        );
      })}
      {shown.some((p) => p.belowRange) && <div className="tiny muted mt">* {t('No set reached {n} reps, so the heaviest set is shown.', { n: repMin })}</div>}
    </div>
  );
}
