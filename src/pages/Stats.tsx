import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useExerciseMap, useStore } from '../store/store';
import { computeRecords, exerciseHistory, setsPerMuscle, startOfWeek, workoutDurationMs, workoutVolume } from '../lib/calc';
import { fmtDate, fmtDuration, fmtNum, fmtVolume, toDisplayWeight } from '../lib/format';
import { ALL_MUSCLES, MUSCLE_LABELS } from '../data/exercises';
import { BodyMap, volumeColor } from '../components/BodyMap';
import { Empty, Segmented } from '../components/ui';

type Period = '1w' | '4w' | '12w';
const WEEKS: Record<Period, number> = { '1w': 1, '4w': 4, '12w': 12 };

export default function Stats() {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const unit = useStore((s) => s.settings.unit);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('4w');
  const [chart, setChart] = useState<'count' | 'volume' | 'time'>('count');

  const weeks = WEEKS[period];
  const since = period === '1w' ? startOfWeek(Date.now()) : Date.now() - weeks * 7 * 86_400_000;
  const inPeriod = workouts.filter((w) => w.startedAt >= since);

  const muscleSets = useMemo(() => setsPerMuscle(workouts, exMap, since), [workouts, exMap, since]);
  const perWeek = (m: (typeof ALL_MUSCLES)[number]) => (muscleSets[m] ?? 0) / weeks;

  const weekly = useMemo(() => {
    const out: { week: number; count: number; volume: number; time: number }[] = [];
    let w = startOfWeek(Date.now());
    for (let i = 0; i < 12; i++) {
      out.unshift({ week: w, count: 0, volume: 0, time: 0 });
      w = startOfWeek(w - 3 * 86_400_000);
    }
    for (const wk of workouts) {
      const k = startOfWeek(wk.startedAt);
      const row = out.find((r) => r.week === k);
      if (!row) continue;
      row.count++;
      row.volume += toDisplayWeight(workoutVolume(wk, exMap), unit) ?? 0;
      row.time += workoutDurationMs(wk) / 60000;
    }
    return out;
  }, [workouts, exMap, unit]);

  const topExercises = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of inPeriod) for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + e.sets.length);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [inPeriod]);

  const big3 = useMemo(
    () =>
      [
        ['squat', 'Dřep'],
        ['bench-press', 'Bench press'],
        ['deadlift', 'Mrtvý tah'],
      ].map(([id, label]) => ({ id, label, e1rm: computeRecords(exerciseHistory(workouts, id)).maxE1rm })),
    [workouts],
  );
  const total = big3.reduce((a, b) => a + b.e1rm, 0);
  const bw = [...measurements].reverse().find((m) => m.type === 'bodyweight')?.value;

  const totalVolume = inPeriod.reduce((a, w) => a + workoutVolume(w, exMap), 0);
  const totalTime = inPeriod.reduce((a, w) => a + workoutDurationMs(w), 0);

  if (!workouts.length) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="back" onClick={() => navigate(-1)}>
            ‹ Zpět
          </button>
        </div>
        <h1>Statistiky</h1>
        <Empty title="Zatím tu nic není">
          Odcvič první trénink a statistiky se začnou plnit.
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ Zpět
        </button>
      </div>
      <h1 style={{ marginBottom: 14 }}>Statistiky</h1>
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: '1w', label: 'Tento týden' },
          { value: '4w', label: '4 týdny' },
          { value: '12w', label: '12 týdnů' },
        ]}
      />

      <div className="grid-2 mt">
        <div className="stat">
          <div className="v">{inPeriod.length}</div>
          <div className="l">Tréninků</div>
        </div>
        <div className="stat">
          <div className="v">{fmtVolume(totalVolume, unit)}</div>
          <div className="l">Celkový objem</div>
        </div>
        <div className="stat">
          <div className="v">{fmtDuration(totalTime)}</div>
          <div className="l">Čas v posilovně</div>
        </div>
        <div className="stat">
          <div className="v">{inPeriod.length ? fmtDuration(totalTime / inPeriod.length) : '–'}</div>
          <div className="l">Průměrná délka</div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>Série na sval {weeks > 1 ? '(průměr za týden)' : ''}</h2>
        </div>
        <div className="card">
          <BodyMap color={(m) => volumeColor(perWeek(m))} height={210} />
          <div className="small muted center" style={{ margin: '4px 0 10px' }}>
            Doporučeno 10–20 sérií týdně na sval (zelená zóna).
          </div>
          {ALL_MUSCLES.map((m) => {
            const v = perWeek(m);
            const pct = Math.min(1, v / 25);
            return (
              <div key={m} className="muscle-bar">
                <span className="ellipsis">{MUSCLE_LABELS[m]}</span>
                <div className="track">
                  <div className="zone" style={{ left: '40%', width: '40%' }} />
                  <div className="fill" style={{ width: `${pct * 100}%`, background: volumeColor(v) }} />
                </div>
                <span className="bold" style={{ textAlign: 'right' }}>
                  {fmtNum(v, 1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>Posledních 12 týdnů</h2>
        </div>
        <div className="card">
          <Segmented
            value={chart}
            onChange={setChart}
            options={[
              { value: 'count', label: 'Tréninky' },
              { value: 'volume', label: 'Objem' },
              { value: 'time', label: 'Čas' },
            ]}
          />
          <div style={{ height: 200, marginTop: 12 }}>
            <ResponsiveContainer>
              <BarChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="week" tickFormatter={(t) => fmtDate(t, { day: 'numeric', month: 'numeric' })} stroke="var(--line)" />
                <YAxis stroke="var(--line)" allowDecimals={false} tickFormatter={(v) => (chart === 'volume' && v >= 1000 ? `${fmtNum(v / 1000, 0)}k` : String(Math.round(v)))} />
                <Tooltip
                  cursor={{ fill: 'var(--accent-soft)' }}
                  contentStyle={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 10 }}
                  labelFormatter={(t) => `Týden od ${fmtDate(Number(t), { day: 'numeric', month: 'long' })}`}
                  formatter={(v) => [
                    chart === 'count' ? `${v}` : chart === 'volume' ? `${fmtNum(Number(v), 0)} ${unit}` : `${fmtNum(Number(v), 0)} min`,
                    chart === 'count' ? 'Tréninky' : chart === 'volume' ? 'Objem' : 'Čas',
                  ]}
                />
                <Bar dataKey={chart} fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {total > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Velká trojka (odhad 1RM)</h2>
          </div>
          <div className="card">
            {big3.map((b) => (
              <Link key={b.id} to={`/exercises/${b.id}`} className="row between" style={{ padding: '6px 0' }}>
                <span>{b.label}</span>
                <span className="bold">{b.e1rm ? `${fmtNum(toDisplayWeight(b.e1rm, unit))} ${unit}` : '–'}</span>
              </Link>
            ))}
            <div className="row between" style={{ paddingTop: 10, marginTop: 6 }}>
              <span className="bold">Součet</span>
              <span className="bold accent">
                {fmtNum(toDisplayWeight(total, unit))} {unit}
              </span>
            </div>
            {bw ? (
              <div className="small muted mt">
                To je {fmtNum(total / bw, 2)}× tvoje tělesná hmotnost ({fmtNum(toDisplayWeight(bw, unit))} {unit}).
              </div>
            ) : (
              <div className="small muted mt">
                Zapiš si tělesnou hmotnost v sekci <Link to="/measure" className="accent">Měření</Link> a uvidíš poměr síly k váze.
              </div>
            )}
          </div>
        </div>
      )}

      {topExercises.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Nejčastější cviky</h2>
          </div>
          <div className="list">
            {topExercises.map(([id, sets]) => (
              <Link key={id} to={`/exercises/${id}`} className="list-item">
                <span className="grow bold ellipsis">{exMap.get(id)?.name ?? id}</span>
                <span className="muted small">{sets} sérií</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
