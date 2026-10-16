import { useMemo, useState } from 'react';
import { Pin } from 'lucide-react';
import { Icon } from '../components/Icon';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAllExercises, useExerciseMap, useStore } from '../store/store';
import { computeRecords, e1rm, exerciseHistory, isWorkingSet, weightForReps, type Session } from '../lib/calc';
import { fmtClock, fmtDate, fmtNum, toDisplayWeight } from '../lib/format';
import { BODY_PART_LABELS, EQUIPMENT_LABELS, EXERCISE_TYPE_LABELS, MUSCLE_LABELS, muscleLoad } from '../data/exercises';
import { BodyMap, loadColor } from '../components/BodyMap';
import { OneRmCalculator, PlateCalculator } from '../components/ExerciseTools';
import { ExerciseAvatar, ExerciseForm } from '../components/ExercisePicker';
import { describeSet } from '../components/WorkoutEditor';
import { confirmDialog, Empty, Segmented, undoToast } from '../components/ui';
import { findSubstitutes } from '../lib/substitutes';
import { strengthRank } from '../lib/strength';
import { PlayCircle } from 'lucide-react';
import { t, tn } from '../i18n';
import type { Exercise } from '../types';

type Tab = 'about' | 'history' | 'charts' | 'records';
type Metric = 'e1rm' | 'weight' | 'volume' | 'reps' | 'duration' | 'distance';
type Range = '3m' | '6m' | '1y' | 'all';

const METRIC_LABEL: Record<Metric, string> = {
  e1rm: 'Est. 1RM',
  weight: 'Max weight',
  volume: 'Volume',
  reps: 'Max reps',
  duration: 'Longest time',
  distance: 'Distance',
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
    { value: 'charts', label: t('Charts') },
    { value: 'history', label: t('History') },
    { value: 'records', label: t('PRs') },
    { value: 'about', label: t('About') },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ {t('Back')}
        </button>
        {ex.custom && (
          <div className="row">
            <button className="btn ghost" onClick={() => setEditing(true)}>
              {t('Edit')}
            </button>
            <button
              className="btn ghost danger"
              onClick={async () => {
                if (
                  sessions.length &&
                  !(await confirmDialog(
                    t('Delete exercise?'),
                    tn(
                      sessions.length,
                      'This exercise has {n} entry in your history. It will stay in that workout without a name.',
                      'This exercise has {n} entries in your history. They will stay in those workouts without a name.',
                    ),
                    t('Delete'),
                  ))
                )
                  return;
                const copy = structuredClone(ex);
                deleteExercise(ex.id);
                navigate('/exercises', { replace: true });
                undoToast(t('Exercise deleted'), () => useStore.getState().saveExercise(copy));
              }}
            >
              {t('Delete')}
            </button>
          </div>
        )}
      </div>
      <h1 style={{ fontSize: 24 }}>{ex.name}</h1>
      <div className="muted small" style={{ marginBottom: 14 }}>
        {BODY_PART_LABELS[ex.bodyPart]} · {EQUIPMENT_LABELS[ex.equipment]} · {tn(sessions.length, 'done {n} time', 'done {n} times')}
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
                <div className="num-lg">{data.length ? fmtVal(last) : '–'}</div>
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
              <Empty title={t('Not enough data')}>
                {t('The chart shows up after at least two workouts with this exercise.')}
              </Empty>
            )}
            <div className="mt">
              <Segmented
                value={range}
                onChange={setRange}
                options={[
                  { value: '3m', label: t('3 mo') },
                  { value: '6m', label: t('6 mo') },
                  { value: '1y', label: t('Year') },
                  { value: 'all', label: t('All') },
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
          {!sessions.length && <Empty title={t('No history yet')} />}
        </div>
      )}

      {tab === 'records' && (
        <div className="mt-l">
          {rank && (rank.value > 0) && (
            <div className="card row" style={{ marginBottom: 12, gap: 14 }}>
              <div style={{ color: rank.tier.color }}>
                <Icon name={rank.tier.icon} size={40} />
              </div>
              <div className="grow">
                <div className="small muted bold">{t('Strength rank')}</div>
                <div className="num-lg" style={{ fontSize: 24, color: rank.tier.color }}>{rank.tier.name}</div>
                {rank.next && rank.nextTarget !== undefined && (
                  <>
                    <div className="progress" style={{ height: 6, marginTop: 6 }}>
                      <div style={{ width: `${rank.progress * 100}%`, background: rank.next.color }} />
                    </div>
                    <div className="tiny muted" style={{ marginTop: 4 }}>
                      {rank.byReps
                        ? t('{tier} at {reps} reps', { tier: rank.next.name, reps: rank.nextTarget })
                        : t('{tier} at 1RM {weight}', { tier: rank.next.name, weight: `${fmtNum(toDisplayWeight(rank.nextTarget, unit), 0)} ${unit}` })}
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
                  <div className="l">{t('Est. 1RM')}</div>
                </div>
                <div className="stat">
                  <div className="v">{records.maxWeight ? `${fmtNum(toDisplayWeight(records.maxWeight, unit))} ${unit}` : '–'}</div>
                  <div className="l">{t('Heaviest weight')}</div>
                </div>
                <div className="stat">
                  <div className="v">{records.maxSetVolume ? `${fmtNum(toDisplayWeight(records.maxSetVolume, unit), 0)} ${unit}` : '–'}</div>
                  <div className="l">{t('Best set volume')}</div>
                </div>
                <div className="stat">
                  <div className="v">{records.maxSessionVolume ? `${fmtNum(toDisplayWeight(records.maxSessionVolume, unit), 0)} ${unit}` : '–'}</div>
                  <div className="l">{t('Best workout volume')}</div>
                </div>
              </div>
              <div className="section-title mt-l">
                <h2>{t('Rep PRs')}</h2>
              </div>
              <div className="list">
                <div className="list-item small muted bold">
                  <span style={{ width: 70 }}>{t('Reps')}</span>
                  <span className="grow">{t('Best')}</span>
                  <span>{t('Estimate')}</span>
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
              <div className="section-title mt-l">
                <h2>{t('Calculators')}</h2>
              </div>
              <div className="stack">
                <OneRmCalculator bestKg={records.maxE1rm} />
                {ex.equipment === 'barbell' && <PlateCalculator initialKg={records.maxWeight} />}
              </div>
            </>
          ) : (
            <div className="grid-2">
              <div className="stat">
                <div className="v">{records.maxReps || '–'}</div>
                <div className="l">{t('Max reps')}</div>
              </div>
              <div className="stat">
                <div className="v">{records.maxDuration ? fmtClock(records.maxDuration) : '–'}</div>
                <div className="l">{t('Longest time')}</div>
              </div>
              <div className="stat">
                <div className="v">{records.maxDistance ? `${fmtNum(records.maxDistance, 2)} km` : '–'}</div>
                <div className="l">{t('Longest distance')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'about' && (() => {
        const load = muscleLoad(ex);
        return (
        <div className="mt-l stack">
          {ex.primary.length > 0 && (
            <div className="card">
              <BodyMap height={240} value={(m) => load[m] ?? 0} color={(m) => loadColor(load[m])} />
              <div className="small">
                <span className="accent bold">{t('Primary')}:</span> {ex.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </div>
              {ex.secondary.length > 0 && (
                <div className="small muted">
                  <span className="bold">{t('Secondary')}:</span> {ex.secondary.map((m) => MUSCLE_LABELS[m]).join(', ')}
                </div>
              )}
            </div>
          )}
          <div className="card small">
            <div>
              <span className="muted">{t('Tracking type')}:</span> {EXERCISE_TYPE_LABELS[ex.type]}
            </div>
            {pinned && (
              <div className="sticky-note">
                <Pin size={15} style={{ marginTop: 2 }} /> {pinned}
              </div>
            )}
          </div>
          <a
            className="btn cool block"
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' proper form')}`}
            target="_blank"
            rel="noreferrer"
          >
            <PlayCircle size={18} /> {t('Video guide on YouTube')}
          </a>
          {ex.instructions?.length ? (
            <div className="card">
              <h3>{t('How to')}</h3>
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
              <h3 className="mt">{t('Similar exercises')}</h3>
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
        );
      })()}

      {editing && <ExerciseForm initial={ex} onClose={() => setEditing(false)} />}
    </div>
  );
}
