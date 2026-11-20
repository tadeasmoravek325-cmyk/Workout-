import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { Session } from '../lib/calc';
import { overloadSeries, overloadState } from '../lib/overload';
import { fmtDate, fmtNum, toDisplayWeight } from '../lib/format';
import { useStore } from '../store/store';
import { t } from '../i18n';

const RANGES = [6, 12, 24, 0] as const; // 0 = all sessions
const KEY = 'overload-range';
const load = (): number => {
  try {
    const v = Number(localStorage.getItem(KEY));
    return RANGES.includes(v as (typeof RANGES)[number]) && localStorage.getItem(KEY) !== null ? v : 12;
  } catch {
    return 12;
  }
};

/** Progressive overload for one lift: are strength and work done climbing over the last sessions? */
export function OverloadPanel({ sessions }: { sessions: Session[] }) {
  const unit = useStore((s) => s.settings.unit);
  const [range, setRange] = useState(load);
  const pick = (n: number) => {
    setRange(n);
    try {
      localStorage.setItem(KEY, String(n));
    } catch {
      /* storage unavailable */
    }
  };
  const series = overloadSeries(sessions, range || sessions.length);
  if (series.length < 2) return null;
  const { state, change } = overloadState(overloadSeries(sessions));
  const Icon = state === 'up' ? TrendingUp : state === 'down' ? TrendingDown : Minus;
  const label =
    state === 'up' ? t('Progressing') : state === 'down' ? t('Going backwards') : state === 'flat' ? t('Plateau') : t('Collecting data');
  return (
    <div className="card mt">
      <div className="row between">
        <div className="bold">{t('Progressive overload')}</div>
        <div className={`overload-${state} row`} style={{ gap: 6 }}>
          <Icon size={16} aria-hidden="true" />
          <span className="bold small">
            {label}
            {state !== 'new' && ` ${change > 0 ? '+' : ''}${fmtNum(change, 1)}%`}
          </span>
        </div>
      </div>
      <div className="small muted" style={{ margin: '4px 0 8px' }}>
        {t('Compares your last 2 sessions with the 2 before.')} {series.some((p) => !p.reliable) && t('≈ marks estimates from sets above 12 reps, which are less reliable.')}
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
          <LineChart data={series.map((p) => ({ d: fmtDate(p.date), v: Math.round((toDisplayWeight(p.e1rm, unit) ?? 0) * 10) / 10 }))} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="d" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--card-2)', border: 'none', borderRadius: 8 }} formatter={(v) => [`${v} ${unit}`, 'e1RM']} />
            <Line type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={2} dot={series.length <= 24} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {[...series].slice(-6).reverse().map((p, i, a) => {
        const prev = a[i + 1];
        const d = prev ? p.e1rm - prev.e1rm : 0;
        return (
          <div key={p.date} className="row between small" style={{ padding: '3px 0' }}>
            <span className="muted">{fmtDate(p.date)}</span>
            <span>
              {!p.reliable && '≈ '}
              {fmtNum(toDisplayWeight(p.e1rm, unit))} {unit} e1RM
              {prev && d !== 0 && <span className={d > 0 ? 'overload-up' : 'overload-down'}> {d > 0 ? '▲' : '▼'}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
