import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, Clock, Dumbbell, Layers, Timer, Trophy } from 'lucide-react';
import { useExerciseMap, useStore } from '../store/store';
import { computeRecords, doneSetCount, exerciseHistory, setsPerMuscle, workoutDurationMs, workoutVolume } from '../lib/calc';
import { computeProgress, type Progress } from '../lib/gamification';
import { fmtDate, fmtDuration, fmtNum, fmtVolume, toDisplayWeight } from '../lib/format';
import {
  PERIOD_PRESETS,
  bucketIndex,
  change,
  customPeriod,
  inPeriod,
  periodBuckets,
  presetName,
  previousPeriod,
  resolvePeriod,
  type Bucket,
  type CustomRange,
  type Period,
  type PeriodPreset,
} from '../lib/periods';
import { ALL_MUSCLES, MUSCLE_LABELS } from '../data/exercises';
import { BodyMap, volumeColor } from '../components/BodyMap';
import { Empty, Segmented, Sheet, BackLabel } from '../components/ui';
import type { Exercise, Workout } from '../types';
import { t, tn } from '../i18n';
import { CountUp } from '../components/CountUp';
import './Stats.css';

const STORE_KEY = 'stats-period';

function loadSaved(): { preset: PeriodPreset; custom?: CustomRange } {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (PERIOD_PRESETS.includes(v.preset) && (v.preset !== 'custom' || v.custom)) return v;
    }
  } catch {
    /* storage unavailable */
  }
  return { preset: 'month' };
}

function save(v: { preset: PeriodPreset; custom?: CustomRange }) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

interface Summary {
  count: number;
  volume: number;
  time: number;
  sets: number;
  prs: number;
}

function summarise(list: Workout[], exMap: Map<string, Exercise>, perWorkout: Progress['perWorkout']): Summary {
  const s: Summary = { count: list.length, volume: 0, time: 0, sets: 0, prs: 0 };
  for (const w of list) {
    s.volume += workoutVolume(w, exMap);
    s.time += workoutDurationMs(w);
    s.sets += doneSetCount(w);
    s.prs += perWorkout.get(w.id)?.prExercises.length ?? 0;
  }
  return s;
}

function headline(p: PeriodPreset): string {
  switch (p) {
    case 'week':
      return t('This week');
    case 'month':
      return t('This month');
    case '3m':
      return t('Last {n} months', { n: 3 });
    case '6m':
      return t('Last {n} months', { n: 6 });
    case '12m':
      return t('Last {n} months', { n: 12 });
    case 'year':
      return t('This year');
    case 'custom':
      return t('Custom period');
  }
}

function chartTitle(b: Bucket): string {
  return b === 'day' ? t('Day by day') : b === 'week' ? t('Week by week') : t('Month by month');
}

function tickLabel(ts: number, b: Bucket): string {
  if (b === 'day') return fmtDate(ts, { weekday: 'short' });
  if (b === 'week') return fmtDate(ts, { day: 'numeric', month: 'numeric' });
  return fmtDate(ts, { month: 'short' });
}

function tooltipLabel(ts: number, b: Bucket): string {
  if (b === 'day') return fmtDate(ts, { weekday: 'long', day: 'numeric', month: 'long' });
  if (b === 'week') return t('Week of {date}', { date: fmtDate(ts, { day: 'numeric', month: 'long' }) });
  return fmtDate(ts, { month: 'long', year: 'numeric' });
}

/** ▲ 12% / ▼ 8% / new / – compared with the previous period. */
function Delta({ cur, prev, hero }: { cur: number; prev: number; hero?: boolean }) {
  const cls = `st-delta${hero ? ' on-hero' : ''}`;
  if (!cur && !prev) return <span className={`${cls} flat`}>–</span>;
  const c = change(cur, prev);
  if (c === null)
    return (
      <span className={`${cls} up`} aria-label={t('New compared with the previous period')}>
        {t('new')}
      </span>
    );
  const pct = Math.round(c * 100);
  if (pct === 0) return <span className={`${cls} flat`}>±0%</span>;
  const up = pct > 0;
  return (
    <span
      className={`${cls} ${up ? 'up' : 'down'}`}
      aria-label={t(up ? 'Up {n}% on the previous period' : 'Down {n}% on the previous period', { n: Math.abs(pct) })}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {fmtNum(Math.abs(pct), 0)}%
    </span>
  );
}

function toInput(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromInput(v: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

function CustomSheet({ period, onApply, onClose }: { period: Period; onApply: (r: CustomRange) => void; onClose: () => void }) {
  const [from, setFrom] = useState(toInput(period.from));
  const [to, setTo] = useState(toInput(Math.max(period.from, period.to - 1)));
  const today = toInput(Date.now());
  const a = fromInput(from);
  const b = fromInput(to);
  const preview = a !== undefined && b !== undefined ? customPeriod({ from: a, to: b }) : undefined;
  const days = preview ? Math.round((preview.to - preview.from) / 86_400_000) : 0;
  return (
    <Sheet title={t('Custom period')} onClose={onClose}>
      <div className="st-dates">
        <label className="field">
          <span className="st-date-label">{t('From')}</span>
          <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span className="st-date-label">{t('To')}</span>
          <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="st-sheet-preview">
        {preview ? (
          <>
            <span className="bold">{preview.label}</span>
            <span className="muted"> · {tn(days, '{n} day', '{n} days')}</span>
          </>
        ) : (
          <span className="muted">{t('Pick both dates')}</span>
        )}
      </div>
      <button className="btn primary block" disabled={!preview} onClick={() => a !== undefined && b !== undefined && onApply({ from: a, to: b })}>
        {t('Show this period')}
      </button>
    </Sheet>
  );
}

export default function Stats() {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const unit = useStore((s) => s.settings.unit);
  const goalCurrent = useStore((s) => s.settings.weeklyGoal);
  const goalLog = useStore((s) => s.settings.goalLog);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const [sel, setSel] = useState(loadSaved);
  const [customOpen, setCustomOpen] = useState(false);
  const [chart, setChart] = useState<'count' | 'volume' | 'time'>('count');
  // Fixed for the life of the page so memoised values stay stable.
  const [now] = useState(() => Date.now());

  const choose = (v: { preset: PeriodPreset; custom?: CustomRange }) => {
    setSel(v);
    save(v);
  };

  const period = useMemo(() => resolvePeriod(sel.preset, now, sel.custom), [sel, now]);
  const prev = useMemo(() => previousPeriod(period), [period]);

  const progress = useMemo(() => computeProgress(workouts, exMap, { current: goalCurrent, log: goalLog }), [workouts, exMap, goalCurrent, goalLog]);

  const cur = useMemo(() => workouts.filter((w) => inPeriod(w.startedAt, period)), [workouts, period]);
  const before = useMemo(() => workouts.filter((w) => inPeriod(w.startedAt, prev)), [workouts, prev]);
  const sNow = useMemo(() => summarise(cur, exMap, progress.perWorkout), [cur, exMap, progress]);
  const sPrev = useMemo(() => summarise(before, exMap, progress.perWorkout), [before, exMap, progress]);

  const muscleSets = useMemo(() => setsPerMuscle(cur, exMap, 0), [cur, exMap]);
  const perWeek = (m: (typeof ALL_MUSCLES)[number]) => (muscleSets[m] ?? 0) / period.weeks;
  const averaged = period.weeks > 1.01;

  const buckets = useMemo(() => {
    const ranges = periodBuckets(period);
    // A first bucket that starts before the period is labelled by the period start (1 Oct, not 28 Sep).
    const rows = ranges.map((r) => ({ start: Math.max(r.start, period.chartFrom), count: 0, volume: 0, time: 0 }));
    for (const w of cur) {
      const i = bucketIndex(ranges, w.startedAt);
      if (i < 0) continue;
      rows[i].count++;
      rows[i].volume += toDisplayWeight(workoutVolume(w, exMap), unit) ?? 0;
      rows[i].time += workoutDurationMs(w) / 60000;
    }
    return rows;
  }, [period, cur, exMap, unit]);

  const topExercises = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of cur)
      for (const e of w.exercises) {
        const n = e.sets.filter((s) => s.done).length;
        if (n) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + n);
      }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [cur]);

  const big3 = useMemo(
    () =>
      [
        ['squat', 'Squat'],
        ['bench-press', 'Bench press'],
        ['deadlift', 'Deadlift'],
      ].map(([id, label]) => ({ id, label, e1rm: computeRecords(exerciseHistory(workouts, id)).maxE1rm })),
    [workouts],
  );
  const total = big3.reduce((a, b) => a + b.e1rm, 0);
  const bw = [...measurements].reverse().find((m) => m.type === 'bodyweight')?.value;


  // Bring a remembered chip that sits off-screen (Year, Custom) into view, without moving the page.
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>('.chip.on');
    if (row && chip) row.scrollLeft = chip.offsetLeft - row.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    // Only on first render: later changes come from taps on visible chips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts.length > 0]);

  if (!workouts.length) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="back" onClick={() => navigate(-1)}>
            <BackLabel />
          </button>
        </div>
        <h1>{t('Stats')}</h1>
        <Empty title={t('Nothing here yet')}>{t('Finish your first workout and your stats will start filling up.')}</Empty>
      </div>
    );
  }

  const avgNow = sNow.count ? sNow.time / sNow.count : 0;
  const avgPrev = sPrev.count ? sPrev.time / sPrev.count : 0;
  const perWeekCount = sNow.count / period.weeks;
  const topMax = topExercises[0]?.[1] ?? 1;

  const tiles = [
    { key: 'volume', icon: <Dumbbell size={16} />, v: fmtVolume(sNow.volume, unit), l: t('Volume'), cur: sNow.volume, prev: sPrev.volume },
    { key: 'sets', icon: <Layers size={16} />, v: fmtNum(sNow.sets, 0), l: t('Sets'), cur: sNow.sets, prev: sPrev.sets },
    { key: 'time', icon: <Clock size={16} />, v: fmtDuration(sNow.time), l: t('Time in the gym'), cur: sNow.time, prev: sPrev.time },
    { key: 'avg', icon: <Timer size={16} />, v: sNow.count ? fmtDuration(avgNow) : '–', l: t('Average length'), cur: avgNow, prev: avgPrev },
  ];

  return (
    <div className="page st-page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          <BackLabel />
        </button>
      </div>
      <h1 style={{ marginBottom: 12 }}>{t('Stats')}</h1>

      <div className="chips st-chips" ref={chipsRef} role="tablist" aria-label={t('Period')}>
        {PERIOD_PRESETS.map((p) => {
          const on = sel.preset === p;
          return (
            <button
              key={p}
              role="tab"
              aria-selected={on}
              className={`chip${on ? ' on' : ''}`}
              onClick={() => (p === 'custom' ? setCustomOpen(true) : choose({ preset: p }))}
            >
              {p === 'custom' && <CalendarRange size={16} aria-hidden="true" />}
              {presetName(p)}
            </button>
          );
        })}
      </div>

      <div className="st-range">
        <span className="bold">{period.label}</span>
        <span className="muted small">{t('compared with {range}', { range: prev.label })}</span>
      </div>

      <div className="st-hero" key={`${sel.preset}-${period.from}`}>
        <svg className="st-hero-art" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="56" />
          <circle cx="60" cy="60" r="34" className="cut" />
          <circle cx="60" cy="60" r="9" />
        </svg>
        <div className="st-hero-top">
          <span className="st-hero-kicker">{headline(sel.preset)}</span>
          <Delta cur={sNow.count} prev={sPrev.count} hero />
        </div>
        <div className="st-hero-num">
          <CountUp value={sNow.count} duration={450} />
        </div>
        <div className="st-hero-label">{tn(sNow.count, 'workout', 'workouts')}</div>
        <div className="st-hero-foot">
          {averaged && <span>{t('{n} a week', { n: fmtNum(perWeekCount, 1) })}</span>}
          <span>{t('{n} in the period before', { n: sPrev.count })}</span>
        </div>
      </div>

      <div className="st-tiles">
        {tiles.map((s) => (
          <div key={s.key} className="st-tile">
            <div className="st-tile-head">
              <span className="st-tile-ico">{s.icon}</span>
              <Delta cur={s.cur} prev={s.prev} />
            </div>
            <div className="st-tile-v">{s.v}</div>
            <div className="st-tile-l">{s.l}</div>
          </div>
        ))}
        <div className="st-tile st-tile-wide">
          <span className="st-tile-ico gold">
            <Trophy size={18} />
          </span>
          <div className="grow">
            <div className="st-tile-v">{sNow.prs}</div>
            <div className="st-tile-l">{tn(sNow.prs, 'personal record', 'personal records')}</div>
          </div>
          <Delta cur={sNow.prs} prev={sPrev.prs} />
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{chartTitle(period.bucket)}</h2>
        </div>
        <div className="card">
          <Segmented
            value={chart}
            onChange={setChart}
            options={[
              { value: 'count', label: t('Workouts') },
              { value: 'volume', label: t('Volume') },
              { value: 'time', label: t('Time') },
            ]}
          />
          <div style={{ height: 200, marginTop: 12 }}>
            <ResponsiveContainer>
              <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="start"
                  tickFormatter={(ts) => tickLabel(Number(ts), period.bucket)}
                  stroke="var(--line)"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  tickLine={false}
                  minTickGap={8}
                />
                <YAxis
                  stroke="var(--line)"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tickFormatter={(v) => (chart === 'volume' && v >= 1000 ? `${fmtNum(v / 1000, 0)}k` : String(Math.round(v)))}
                />
                <Tooltip
                  cursor={{ fill: 'var(--accent-soft)' }}
                  contentStyle={{ background: 'var(--card-2)', border: 0, borderRadius: 12, color: 'var(--text)' }}
                  labelStyle={{ color: 'var(--muted)' }}
                  itemStyle={{ color: 'var(--text)' }}
                  labelFormatter={(ts) => tooltipLabel(Number(ts), period.bucket)}
                  formatter={(v) => [
                    chart === 'count' ? `${v}` : chart === 'volume' ? `${fmtNum(Number(v), 0)} ${unit}` : `${fmtNum(Number(v), 0)} min`,
                    chart === 'count' ? t('Workouts') : chart === 'volume' ? t('Volume') : t('Time'),
                  ]}
                />
                <Bar dataKey={chart} fill="var(--accent)" radius={[6, 6, 6, 6]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{averaged ? t('Sets per muscle (weekly average)') : t('Sets per muscle')}</h2>
        </div>
        <div className="card">
          <BodyMap color={(m) => volumeColor(perWeek(m))} value={perWeek} height={240} onPick={(m) => navigate(`/muscles/${m}`)} />
          <div className="small muted center" style={{ margin: '4px 0 10px' }}>
            {t('Aim for 10–20 sets per muscle each week. Tap a muscle for details.')}
          </div>
          {ALL_MUSCLES.map((m) => {
            const v = perWeek(m);
            const pct = Math.min(1, v / 25);
            return (
              <Link key={m} to={`/muscles/${m}`} className="muscle-bar">
                <span className="ellipsis">{MUSCLE_LABELS[m]}</span>
                <div className="track">
                  <div className="zone" style={{ left: '40%', width: '40%' }} />
                  <div className="fill" style={{ width: `${pct * 100}%`, background: volumeColor(v) }} />
                </div>
                <span className="bold" style={{ textAlign: 'right' }}>
                  {fmtNum(v, 1)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t('Top exercises')}</h2>
        </div>
        {topExercises.length ? (
          <div className="st-top">
            {topExercises.map(([id, sets], i) => (
              <Link key={id} to={`/exercises/${id}`} className="st-top-row">
                <span className={`st-rank${i === 0 ? ' first' : ''}`}>{i + 1}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row between" style={{ gap: 8 }}>
                    <span className="bold ellipsis">{exMap.get(id)?.name ?? id}</span>
                    <span className="muted small" style={{ flexShrink: 0 }}>
                      {tn(sets, '{n} set', '{n} sets')}
                    </span>
                  </div>
                  <div className="st-top-bar">
                    <div style={{ width: `${(sets / topMax) * 100}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card small muted">{t('No workouts in this period.')}</div>
        )}
      </div>

      {total > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>{t('Big 3 (est. 1RM)')}</h2>
            <span className="small muted">{t('All time')}</span>
          </div>
          <div className="card">
            {big3.map((b) => (
              <Link key={b.id} to={`/exercises/${b.id}`} className="row between" style={{ padding: '6px 0', minHeight: 44 }}>
                <span>{t(b.label)}</span>
                <span className="bold">{b.e1rm ? `${fmtNum(toDisplayWeight(b.e1rm, unit))} ${unit}` : '–'}</span>
              </Link>
            ))}
            <div className="row between" style={{ paddingTop: 10, marginTop: 6 }}>
              <span className="bold">{t('Total')}</span>
              <span className="bold accent">
                {fmtNum(toDisplayWeight(total, unit))} {unit}
              </span>
            </div>
            {bw ? (
              <div className="small muted mt">
                {t('That is {ratio}× your bodyweight ({bw}).', { ratio: fmtNum(total / bw, 2), bw: `${fmtNum(toDisplayWeight(bw, unit))} ${unit}` })}
              </div>
            ) : (
              <div className="small muted mt">
                {t('Log your bodyweight in')}{' '}
                <Link to="/measure" className="accent">
                  {t('Measurements')}
                </Link>{' '}
                {t('to see your strength-to-weight ratio.')}
              </div>
            )}
          </div>
        </div>
      )}

      {customOpen && (
        <CustomSheet
          period={sel.preset === 'custom' ? period : resolvePeriod('custom', now)}
          onClose={() => setCustomOpen(false)}
          onApply={(r) => {
            choose({ preset: 'custom', custom: r });
            setCustomOpen(false);
          }}
        />
      )}
    </div>
  );
}
