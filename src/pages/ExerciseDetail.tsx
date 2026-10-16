import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAllExercises, useExerciseMap, useStore } from '../store/store';
import { computeRecords, e1rm, exerciseHistory, isWorkingSet, weightForReps, type Session } from '../lib/calc';
import { fmtClock, fmtDate, fmtNum, toDisplayWeight } from '../lib/format';
import { BODY_PART_LABELS, EQUIPMENT_LABELS, EXERCISE_TYPE_LABELS, MUSCLE_LABELS } from '../data/exercises';
import { BodyMap } from '../components/BodyMap';
import { ExerciseAvatar, ExerciseForm } from '../components/ExercisePicker';
import { describeSet } from '../components/WorkoutEditor';
import { Empty, Segmented } from '../components/ui';
import { findSubstitutes } from '../lib/substitutes';
import { strengthRank } from '../lib/strength';
import { PlayCircle } from 'lucide-react';
import type { Exercise } from '../types';

type Tab = 'about' | 'history' | 'charts' | 'records';
type Metric = 'e1rm' | 'weight' | 'volume' | 'reps' | 'duration' | 'distance';
type Range = '3m' | '6m' | '1y' | 'all';

const METRIC_LABEL: Record<Metric, string> = {
  e1rm: 'Odhad 1RM',
  weight: 'Max. váha',
  volume: 'Objem',
  reps: 'Max. opakování',
  duration: 'Nejdelší čas',
  distance: 'Vzdálenost',
};

function metricsFor(ex: Exercise): Metric[] {
  switch (ex.type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      return ['e1rm', 'weight', 'volume', 'reps'];
    case 'assisted_bodyweight':
    case 'reps_only':
      return ['reps'];
    case 'duration':
      return ['duration'];
    case 'distance_duration':
      return ['distance', 'duration'];
  }
}

function sessionValue(s: Session, m: Metric): number {
  const sets = s.sets.filter(isWorkingSet);
  switch (m) {
    case 'e1rm':
      return Math.max(0, ...sets.map((x) => e1rm(x.weight ?? 0, x.reps ?? 0)));
    case 'weight':
      return Math.max(0, ...sets.map((x) => x.weight ?? 0));
    case 'volume':
      return sets.reduce((a, x) => a + (x.weight ?? 0) * (x.reps ?? 0), 0);
    case 'reps':
      return Math.max(0, ...sets.map((x) => x.reps ?? 0));
    case 'duration':
      return Math.max(0, ...sets.map((x) => x.durationSec ?? 0));
    case 'distance':
      return sets.reduce((a, x) => a + (x.distance ?? 0), 0);
  }
}

export default function ExerciseDetail() {
  const { id = '' } = useParams();
  const exMap = useExerciseMap();
  const all = useAllExercises();
  const workouts = useStore((s) => s.workouts);
  const settings = useStore((s) => s.settings);
  const deleteExercise = useStore((s) => s.deleteExercise);
  const measurements = useStore((s) => s.measurements);
  const pinned = useStore((s) => s.exerciseNotes?.[id]);
  const navigate = useNavigate();
  const ex = exMap.get(id);
  const [tab, setTab] = useState<Tab>('charts');
  const [editing, setEditing] = useState(false);
  const metrics = ex ? metricsFor(ex) : [];
  const [metric, setMetric] = useState<Metric>(metrics[0] ?? 'e1rm');
  const [range, setRange] = useState<Range>('6m');

  const sessions = useMemo(() => (ex ? exerciseHistory(workouts, ex.id) : []), [workouts, ex]);
  const records = useMemo(() => computeRecords(sessions), [sessions]);

  if (!ex) return <Navigate to="/exercises" replace />;
  const unit = settings.unit;
  const bodyweight = [...measurements].reverse().find((m) => m.type === 'bodyweight')?.value;
  const rank = bodyweight ? strengthRank(ex.id, ex.id === 'pull-up' ? records.maxReps : records.maxE1rm, bodyweight, settings.sex) : null;
  const isWeight = metric === 'e1rm' || metric === 'weight' || metric === 'volume';

  const cutoff =
    range === 'all' ? 0 : Date.now() - { '3m': 91, '6m': 182, '1y': 365 }[range] * 86_400_000;
  const data = [...sessions]
    .filter((s) => s.date >= cutoff)
    .reverse()
    .map((s) => {
      const v = sessionValue(s, metric);
      return { date: s.date, value: isWeight ? (toDisplayWeight(v, unit) ?? 0) : metric === 'distance' ? v : v };
    })
    .filter((d) => d.value > 0);

  const fmtVal = (v: number) =>
    isWeight ? `${fmtNum(v)} ${unit}` : metric === 'duration' ? fmtClock(v) : metric === 'distance' ? `${fmtNum(v, 2)} km` : `${v}`;

  const first = data[0]?.value ?? 0;
  const last = data[data.length - 1]?.value ?? 0;
  const change = first ? ((last - first) / first) * 100 : 0;

  const tabs: { value: Tab; label: string }[] = [
    { value: 'charts', label: 'Grafy' },
    { value: 'history', label: 'Historie' },
    { value: 'records', label: 'Rekordy' },
    { value: 'about', label: 'Info' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ Zpět
        </button>
        {ex.custom && (
          <div className="row">
            <button className="btn ghost" onClick={() => setEditing(true)}>
              Upravit
            </button>
            <button
              className="btn ghost danger"
              onClick={() => {
                if (sessions.length && !window.confirm(`Cvik má ${sessions.length} záznamů v historii. Opravdu smazat?`)) return;
                deleteExercise(ex.id);
                navigate('/exercises', { replace: true });
              }}
            >
              Smazat
            </button>
          </div>
        )}
      </div>
      <h1 style={{ fontSize: 24 }}>{ex.name}</h1>
      <div className="muted small" style={{ marginBottom: 14 }}>
        {BODY_PART_LABELS[ex.bodyPart]} · {EQUIPMENT_LABELS[ex.equipment]} · {sessions.length}× odcvičeno
      </div>
      <Segmented value={tab} options={tabs} onChange={setTab} />

      {tab === 'charts' && (
        <div className="mt-l">
          {metrics.length > 1 && (
            <div className="chips">
              {metrics.map((m) => (
                <button key={m} className={`chip ${metric === m ? 'on' : ''}`} onClick={() => setMetric(m)}>
                  {METRIC_LABEL[m]}
                </button>
              ))}
            </div>
          )}
          <div className="card mt">
            <div className="row between">
              <div>
                <div className="small muted">{METRIC_LABEL[metric]}</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{data.length ? fmtVal(last) : '–'}</div>
              </div>
              {data.length > 1 && (
                <span className={`badge ${change >= 0 ? 'ok' : ''}`} style={change < 0 ? { color: 'var(--danger)' } : undefined}>
                  {change >= 0 ? '▲' : '▼'} {fmtNum(Math.abs(change), 1)} %
                </span>
              )}
            </div>
            {data.length > 1 ? (
              <div style={{ height: 220, marginTop: 10 }}>
                <ResponsiveContainer>
                  <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(t) => fmtDate(t, { day: 'numeric', month: 'numeric' })}
                      stroke="var(--line)"
                    />
                    <YAxis stroke="var(--line)" domain={['auto', 'auto']} tickFormatter={(v) => (metric === 'duration' ? fmtClock(v) : fmtNum(v, 0))} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 10 }}
                      labelFormatter={(t) => fmtDate(Number(t))}
                      formatter={(v) => [fmtVal(Number(v)), METRIC_LABEL[metric]]}
                    />
                    <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty icon="📈" title="Málo dat">
                Graf se zobrazí po alespoň dvou trénincích s tímto cvikem.
              </Empty>
            )}
            <div className="mt">
              <Segmented
                value={range}
                onChange={setRange}
                options={[
                  { value: '3m', label: '3 měs.' },
                  { value: '6m', label: '6 měs.' },
                  { value: '1y', label: 'Rok' },
                  { value: 'all', label: 'Vše' },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="mt-l stack">
          {sessions.map((s) => (
            <Link key={s.workoutId + s.date} to={`/history/${s.workoutId}`} className="card tap" style={{ display: 'block' }}>
              <div className="row between">
                <h3 className="ellipsis">{s.workoutName}</h3>
                <span className="small muted">{fmtDate(s.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              {s.sets.map((set, i) => (
                <div key={i} className="row between small" style={{ marginTop: 4 }}>
                  <span>
                    <span className="muted" style={{ display: 'inline-block', width: 22 }}>
                      {set.type === 'warmup' ? 'W' : i + 1}
                    </span>
                    {describeSet(set, ex, settings)}
                  </span>
                  {ex.type === 'weight_reps' && set.weight && set.reps ? (
                    <span className="tiny muted">1RM {fmtNum(toDisplayWeight(e1rm(set.weight, set.reps), unit))}</span>
                  ) : null}
                </div>
              ))}
            </Link>
          ))}
          {!sessions.length && <Empty icon="📭" title="Zatím žádná historie" />}
        </div>
      )}

      {tab === 'records' && (
        <div className="mt-l">
          {rank && (rank.value > 0) && (
            <div className="card row" style={{ marginBottom: 12, gap: 14 }}>
              <div style={{ fontSize: 40 }}>{rank.tier.icon}</div>
              <div className="grow">
                <div className="small muted bold">Silový rank</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: rank.tier.color }}>{rank.tier.name}</div>
                {rank.next && rank.nextTarget !== undefined && (
                  <>
                    <div className="progress" style={{ height: 6, marginTop: 6 }}>
                      <div style={{ width: `${rank.progress * 100}%`, background: rank.next.color }} />
                    </div>
                    <div className="tiny muted" style={{ marginTop: 4 }}>
                      {rank.next.icon} {rank.next.name} při{' '}
                      {rank.byReps ? `${rank.nextTarget} opak.` : `1RM ${fmtNum(toDisplayWeight(rank.nextTarget, unit), 0)} ${unit}`}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {ex.type === 'weight_reps' || ex.type === 'weighted_bodyweight' ? (
            <>
              <div className="grid-2">
                <div className="stat">
                  <div className="v">{records.maxE1rm ? `${fmtNum(toDisplayWeight(records.maxE1rm, unit))} ${unit}` : '–'}</div>
                  <div className="l">Odhad 1RM</div>
                </div>
                <div className="stat">
                  <div className="v">{records.maxWeight ? `${fmtNum(toDisplayWeight(records.maxWeight, unit))} ${unit}` : '–'}</div>
                  <div className="l">Nejvyšší váha</div>
                </div>
                <div className="stat">
                  <div className="v">{records.maxSetVolume ? `${fmtNum(toDisplayWeight(records.maxSetVolume, unit), 0)} ${unit}` : '–'}</div>
                  <div className="l">Největší objem série</div>
                </div>
                <div className="stat">
                  <div className="v">{records.maxSessionVolume ? `${fmtNum(toDisplayWeight(records.maxSessionVolume, unit), 0)} ${unit}` : '–'}</div>
                  <div className="l">Největší objem v tréninku</div>
                </div>
              </div>
              <div className="section-title mt-l">
                <h2>Rekordy podle opakování</h2>
              </div>
              <div className="list">
                <div className="list-item small muted bold">
                  <span style={{ width: 70 }}>Opak.</span>
                  <span className="grow">Nejlepší</span>
                  <span>Odhad</span>
                </div>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((r) => (
                  <div key={r} className="list-item">
                    <span style={{ width: 70 }} className="bold">
                      {r} RM
                    </span>
                    <span className="grow">{records.repMaxes[r] ? `${fmtNum(toDisplayWeight(records.repMaxes[r], unit))} ${unit}` : '–'}</span>
                    <span className="muted small">
                      {records.maxE1rm ? `${fmtNum(toDisplayWeight(weightForReps(records.maxE1rm, r), unit))} ${unit}` : '–'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid-2">
              <div className="stat">
                <div className="v">{records.maxReps || '–'}</div>
                <div className="l">Max. opakování</div>
              </div>
              <div className="stat">
                <div className="v">{records.maxDuration ? fmtClock(records.maxDuration) : '–'}</div>
                <div className="l">Nejdelší čas</div>
              </div>
              <div className="stat">
                <div className="v">{records.maxDistance ? `${fmtNum(records.maxDistance, 2)} km` : '–'}</div>
                <div className="l">Nejdelší vzdálenost</div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'about' && (
        <div className="mt-l stack">
          {ex.primary.length > 0 && (
            <div className="card">
              <BodyMap
                height={200}
                color={(m) => (ex.primary.includes(m) ? '#ff6b35' : ex.secondary.includes(m) ? '#8a4a2f' : '#3a4150')}
              />
              <div className="small">
                <span className="accent bold">Hlavní:</span> {ex.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </div>
              {ex.secondary.length > 0 && (
                <div className="small muted">
                  <span className="bold">Vedlejší:</span> {ex.secondary.map((m) => MUSCLE_LABELS[m]).join(', ')}
                </div>
              )}
            </div>
          )}
          <div className="card small">
            <div>
              <span className="muted">Typ záznamu:</span> {EXERCISE_TYPE_LABELS[ex.type]}
            </div>
            {pinned && <div className="sticky-note">📌 {pinned}</div>}
          </div>
          <a
            className="btn cool block"
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' technika provedení')}`}
            target="_blank"
            rel="noreferrer"
          >
            <PlayCircle size={18} /> Video návod na YouTube
          </a>
          {ex.instructions?.length ? (
            <div className="card">
              <h3>Postup</h3>
              <ol style={{ paddingLeft: 20, margin: '8px 0 0' }}>
                {ex.instructions.map((s, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {ex.bodyPart !== 'cardio' && (
            <>
              <h3 className="mt">Podobné cviky</h3>
              <div className="list">
                {findSubstitutes(ex, all, 5).map((alt) => (
                  <Link key={alt.id} to={`/exercises/${alt.id}`} className="list-item">
                    <ExerciseAvatar ex={alt} />
                    <div className="grow bold ellipsis">{alt.name}</div>
                    <span className="chev" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {editing && <ExerciseForm initial={ex} onClose={() => setEditing(false)} />}
    </div>
  );
}
