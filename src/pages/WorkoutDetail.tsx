import { useMemo } from 'react';
import { Pencil, RefreshCw, Repeat2, Save, Share2, Trash2 } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useExerciseMap, useStore } from '../store/store';
import {
  detectPRs,
  doneSetCount,
  e1rm,
  isWorkingSet,
  uid,
  workoutDurationMs,
  workoutVolume,
  type PrHit,
} from '../lib/calc';
import { fmtDateTime, fmtDuration, fmtNum, fmtVolume, toDisplayWeight } from '../lib/format';
import { describeSet } from '../components/WorkoutEditor';
import { BodyMap, IDLE, loadColor } from '../components/BodyMap';
import { workoutMuscleSets } from '../components/WorkoutCard';
import type { Muscle } from '../types';
import { confirmDialog, toast, undoToast, BackLabel } from '../components/ui';
import type { Routine } from '../types';
import { t, tn } from '../i18n';

const PR_LABEL: Record<PrHit['kind'], string> = {
  weight: 'Heaviest weight',
  e1rm: 'Est. 1RM',
  reps: 'Most reps',
  volume: 'Set volume',
  duration: 'Longest time',
  distance: 'Longest distance',
};

export default function WorkoutDetail() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const isSummary = params.get('summary') === '1';
  const workouts = useStore((s) => s.workouts);
  const routines = useStore((s) => s.routines);
  const settings = useStore((s) => s.settings);
  const active = useStore((s) => s.active);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const startWorkout = useStore((s) => s.startWorkout);
  const routineFromWorkout = useStore((s) => s.routineFromWorkout);
  const updateRoutineFromWorkout = useStore((s) => s.updateRoutineFromWorkout);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const w = workouts.find((x) => x.id === id);
  const unit = settings.unit;
  const older = useMemo(() => (w ? workouts.filter((x) => x.startedAt < w.startedAt) : []), [workouts, w]);
  const prs = useMemo(() => (w ? detectPRs(w, older, exMap) : []), [w, older, exMap]);
  const load = useMemo(() => (w ? workoutMuscleSets(w, exMap) : {}), [w, exMap]);
  const maxLoad = Math.max(0, ...Object.values(load).map((v) => v ?? 0));
  const muscleColor = (m: Muscle) => {
    const v = load[m] ?? 0;
    return v < 0.25 || !maxLoad ? IDLE : loadColor(0.3 + (0.7 * v) / maxLoad);
  };

  if (!w) return <Navigate to="/history" replace />;

  const volume = workoutVolume(w, exMap);
  const previous = older.find((x) => (w.routineId ? x.routineId === w.routineId : x.name === w.name));
  const prevVolume = previous ? workoutVolume(previous, exMap) : 0;
  const diff = prevVolume ? ((volume - prevVolume) / prevVolume) * 100 : null;
  const routine = routines.find((r) => r.id === w.routineId);

  const repeat = () => {
    if (active) return toast(t('Finish your current workout first'));
    const temp: Routine = {
      id: w.routineId ?? uid(),
      name: w.name,
      createdAt: Date.now(),
      exercises: w.exercises.map((we) => ({
        id: uid(),
        exerciseId: we.exerciseId,
        restSec: we.restSec,
        supersetId: we.supersetId,
        sets: we.sets.map((s) => ({ type: s.type, weight: s.weight, reps: s.reps, durationSec: s.durationSec, distance: s.distance })),
      })),
    };
    startWorkout(temp);
    if (!w.routineId) useStore.getState().mutateActive((a) => void delete a.routineId);
    navigate('/workout');
  };

  const shareText = () => {
    const lines = [`${w.name} – ${fmtDateTime(w.startedAt)}`, t('{duration} · volume {volume}', { duration: fmtDuration(workoutDurationMs(w)), volume: fmtVolume(volume, unit) }), ''];
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      lines.push(ex.name);
      we.sets.forEach((s, i) => lines.push(`  ${s.type === 'warmup' ? 'W' : i + 1}. ${describeSet(s, ex, settings)}`));
    }
    if (prs.length) lines.push('', t('New personal records: {n}', { n: prs.length }));
    return lines.join('\n');
  };

  const share = async () => {
    const text = shareText();
    try {
      if (navigator.share) await navigator.share({ title: w.name, text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t('Copied to clipboard'));
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => (isSummary ? navigate('/', { replace: true }) : navigate(-1))}>
          {isSummary ? t('Done') : <BackLabel />}
        </button>
        <Link to={`/history/${w.id}/edit`} className="btn ghost">
          <Pencil size={16} /> {t('Edit')}
        </Link>
      </div>

      {isSummary && (
        <div className="hero center" style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 24 }}>{t('Great work!')}</h1>
          <div className="muted small" style={{ marginTop: 8 }}>
            {t('Workout #{n}', { n: older.length + 1 })}
            {diff !== null && (
              <>
                {' · '}
                <span className="bold">
                  {t('volume {diff} % vs last time', { diff: `${diff >= 0 ? '+' : ''}${fmtNum(diff, 0)}` })}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <h1>{w.name}</h1>
      <div className="muted small">{fmtDateTime(w.startedAt)}</div>

      <div className="grid-3 mt">
        <div className="stat">
          <div className="v">{fmtDuration(workoutDurationMs(w))}</div>
          <div className="l">{t('Duration')}</div>
        </div>
        <div className="stat">
          <div className="v">{fmtVolume(volume, unit)}</div>
          <div className="l">{t('Volume')}</div>
        </div>
        <div className="stat">
          <div className="v">{doneSetCount(w)}</div>
          <div className="l">{t('Sets')}</div>
        </div>
      </div>

      {maxLoad > 0 && (
        <div className="card mt">
          <div className="small muted bold" style={{ marginBottom: 6 }}>
            {t('Muscles worked')}
          </div>
          <BodyMap height={260} color={muscleColor} value={(m) => load[m] ?? 0} onPick={(m) => navigate(`/muscles/${m}`)} />
        </div>
      )}

      {prs.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>{t('Personal records ({n})', { n: prs.length })}</h2>
          </div>
          <div className="list">
            {prs.map((p, i) => {
              const ex = exMap.get(p.exerciseId);
              const val =
                p.kind === 'reps'
                  ? tn(p.value, '{n} rep', '{n} reps')
                  : p.kind === 'duration'
                    ? `${Math.round(p.value)} s`
                    : p.kind === 'distance'
                      ? `${fmtNum(p.value, 2)} km`
                      : `${fmtNum(toDisplayWeight(p.value, unit))} ${unit}`;
              return (
                <div key={i} className="list-item">
                  <div className="grow">
                    <div className="bold ellipsis">{ex?.name}</div>
                    <div className="small muted">{t(PR_LABEL[p.kind])}</div>
                  </div>
                  <span className="badge gold">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isSummary && (
        <div className="section stack">
          {routine ? (
            <button
              className="btn soft block"
              onClick={() => {
                updateRoutineFromWorkout(w.id);
                toast(t('Routine “{name}” updated', { name: routine.name }));
              }}
            >
              <RefreshCw size={16} /> {t('Update routine from this workout')}
            </button>
          ) : (
            <button
              className="btn soft block"
              onClick={() => {
                routineFromWorkout(w.id);
                toast(t('Saved as a new routine'));
              }}
            >
              <Save size={16} /> {t('Save as routine')}
            </button>
          )}
        </div>
      )}

      {w.notes && (
        <div className="card mt-l">
          <div className="small muted bold">{t('Note')}</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{w.notes}</div>
        </div>
      )}

      <div className="section stack">
        {w.exercises.map((we) => {
          const ex = exMap.get(we.exerciseId);
          if (!ex) return null;
          const best = Math.max(0, ...we.sets.filter(isWorkingSet).map((s) => e1rm(s.weight ?? 0, s.reps ?? 0)));
          let n = 0;
          return (
            <div key={we.id} className={`card ${we.supersetId ? 'ex-card superset' : ''}`} style={{ marginTop: 0 }}>
              <Link to={`/exercises/${ex.id}`} className="ex-name">
                {ex.name}
              </Link>
              {we.notes && <div className="small muted">{we.notes}</div>}
              <div style={{ marginTop: 6 }}>
                {we.sets.map((s) => {
                  if (s.type === 'normal') n++;
                  return (
                    <div key={s.id} className="row between small" style={{ padding: '3px 0' }}>
                      <span>
                        <span className={`bold ${s.type === 'warmup' ? '' : 'muted'}`} style={{ display: 'inline-block', width: 22, color: s.type === 'warmup' ? 'var(--warn)' : s.type === 'drop' ? 'var(--purple)' : s.type === 'failure' ? 'var(--danger)' : undefined }}>
                          {s.type === 'normal' ? n : s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : 'F'}
                        </span>
                        {describeSet(s, ex, settings)}
                        {s.rpe ? <span className="muted"> @ RPE {fmtNum(s.rpe, 1)}</span> : null}
                      </span>
                      {s.weight && s.reps && ex.type === 'weight_reps' ? (
                        <span className="muted tiny">1RM {fmtNum(toDisplayWeight(e1rm(s.weight, s.reps), unit))}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {best > 0 && ex.type === 'weight_reps' && (
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {t('Best est. 1RM: {value} {unit}', { value: fmtNum(toDisplayWeight(best, unit)), unit })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid-3 section">
        <button className="btn sm" onClick={repeat}>
          <Repeat2 size={16} /> {t('Repeat')}
        </button>
        <button className="btn sm" onClick={share}>
          <Share2 size={16} /> {t('Text')}
        </button>
        <button
          className="btn sm danger"
          onClick={async () => {
            if (await confirmDialog(t('Delete this workout?'), t('You can undo this for a few seconds.'), t('Delete'))) {
              const copy = structuredClone(w);
              deleteWorkout(w.id);
              navigate('/history', { replace: true });
              undoToast(t('Workout deleted'), () => useStore.getState().restoreWorkout(copy));
            }
          }}
        >
          <Trash2 size={16} /> {t('Delete')}
        </button>
      </div>
      {!isSummary && !routine && (
        <button
          className="btn block mt"
          onClick={() => {
            routineFromWorkout(w.id);
            toast(t('Saved as a new routine'));
          }}
        >
          <Save size={16} /> {t('Save as routine')}
        </button>
      )}
    </div>
  );
}
