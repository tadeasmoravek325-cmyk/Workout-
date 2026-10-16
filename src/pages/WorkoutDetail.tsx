import { useMemo, useState } from 'react';
import { ImageDown, Pencil, Repeat2, Share2, Trash2 } from 'lucide-react';
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
import { ACHIEVEMENTS, achievementStats, unlockedIds } from '../lib/achievements';
import { describeSet } from '../components/WorkoutEditor';
import { toast } from '../components/ui';
import type { Routine } from '../types';
import { useGame } from '../lib/useGame';
import { Celebration } from '../components/Celebration';
import { renderShareCard } from '../lib/shareCard';

const PR_LABEL: Record<PrHit['kind'], string> = {
  weight: 'Nejvyšší váha',
  e1rm: 'Odhad 1RM',
  reps: 'Nejvíc opakování',
  volume: 'Objem série',
  duration: 'Nejdelší čas',
  distance: 'Nejdelší vzdálenost',
};

export default function WorkoutDetail() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const isSummary = params.get('summary') === '1';
  const workouts = useStore((s) => s.workouts);
  const routines = useStore((s) => s.routines);
  const settings = useStore((s) => s.settings);
  const measurements = useStore((s) => s.measurements);
  const active = useStore((s) => s.active);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const startWorkout = useStore((s) => s.startWorkout);
  const routineFromWorkout = useStore((s) => s.routineFromWorkout);
  const updateRoutineFromWorkout = useStore((s) => s.updateRoutineFromWorkout);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const w = workouts.find((x) => x.id === id);
  const unit = settings.unit;
  const game = useGame();
  const [celebrating, setCelebrating] = useState(isSummary);
  const xp = game.progress.perWorkout.get(id)?.xp ?? 0;

  const older = useMemo(() => (w ? workouts.filter((x) => x.startedAt < w.startedAt) : []), [workouts, w]);
  const prs = useMemo(() => (w ? detectPRs(w, older, exMap) : []), [w, older, exMap]);
  const newAchievements = useMemo(() => {
    if (!w || !isSummary) return [];
    const before = unlockedIds(achievementStats(older, exMap, measurements));
    const after = unlockedIds(achievementStats([w, ...older], exMap, measurements));
    return ACHIEVEMENTS.filter((a) => after.has(a.id) && !before.has(a.id));
  }, [w, older, exMap, measurements, isSummary]);

  if (!w) return <Navigate to="/history" replace />;

  const volume = workoutVolume(w, exMap);
  const previous = older.find((x) => (w.routineId ? x.routineId === w.routineId : x.name === w.name));
  const prevVolume = previous ? workoutVolume(previous, exMap) : 0;
  const diff = prevVolume ? ((volume - prevVolume) / prevVolume) * 100 : null;
  const routine = routines.find((r) => r.id === w.routineId);

  const repeat = () => {
    if (active) return toast('Nejdřív dokonči rozběhnutý trénink');
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
    const lines = [`💪 ${w.name} – ${fmtDateTime(w.startedAt)}`, `⏱ ${fmtDuration(workoutDurationMs(w))} · 🏋️ ${fmtVolume(volume, unit)}`, ''];
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      lines.push(ex.name);
      we.sets.forEach((s, i) => lines.push(`  ${s.type === 'warmup' ? 'W' : i + 1}. ${describeSet(s, ex, settings)}`));
    }
    if (prs.length) lines.push('', `🏆 ${prs.length} nových rekordů`);
    return lines.join('\n');
  };

  const shareImage = async () => {
    try {
      const blob = await renderShareCard(w, exMap, settings, {
        prs: prs.filter((p) => p.kind !== 'volume').length,
        level: game.level.level,
        levelTitle: game.level.title,
        streak: game.streak.streak,
      });
      const file = new File([blob], 'gym-trenink.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: w.name });
      else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gym-trenink.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Obrázek stažen');
      }
    } catch {
      /* cancelled */
    }
  };

  const share = async () => {
    const text = shareText();
    try {
      if (navigator.share) await navigator.share({ title: w.name, text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Zkopírováno do schránky');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => (isSummary ? navigate('/', { replace: true }) : navigate(-1))}>
          {isSummary ? 'Hotovo' : '‹ Zpět'}
        </button>
        <Link to={`/history/${w.id}/edit`} className="btn ghost">
          <Pencil size={16} /> Upravit
        </Link>
      </div>

      {isSummary && (
        <div className="hero center" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 44 }}>🎉</div>
          <h1 style={{ fontSize: 24 }}>Skvělá práce!</h1>
          <div className="badge white" style={{ marginTop: 8 }}>
            +{xp} XP
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            Trénink č. {older.length + 1}
            {diff !== null && (
              <>
                {' · '}
                <span className="bold">
                  objem {diff >= 0 ? '+' : ''}
                  {fmtNum(diff, 0)} % oproti minule
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
          <div className="l">Délka</div>
        </div>
        <div className="stat">
          <div className="v">{fmtVolume(volume, unit)}</div>
          <div className="l">Objem</div>
        </div>
        <div className="stat">
          <div className="v">{doneSetCount(w)}</div>
          <div className="l">Sérií</div>
        </div>
      </div>

      {prs.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>🏆 Osobní rekordy ({prs.length})</h2>
          </div>
          <div className="list">
            {prs.map((p, i) => {
              const ex = exMap.get(p.exerciseId);
              const val =
                p.kind === 'reps'
                  ? `${p.value} opak.`
                  : p.kind === 'duration'
                    ? `${Math.round(p.value)} s`
                    : p.kind === 'distance'
                      ? `${fmtNum(p.value, 2)} km`
                      : `${fmtNum(toDisplayWeight(p.value, unit))} ${unit}`;
              return (
                <div key={i} className="list-item">
                  <div className="grow">
                    <div className="bold ellipsis">{ex?.name}</div>
                    <div className="small muted">{PR_LABEL[p.kind]}</div>
                  </div>
                  <span className="badge gold">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {newAchievements.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Nové odznaky</h2>
          </div>
          <div className="stack">
            {newAchievements.map((a) => (
              <div key={a.id} className="card ach">
                <div className="ico">{a.icon}</div>
                <div>
                  <div className="bold">{a.title}</div>
                  <div className="small muted">{a.description}</div>
                </div>
              </div>
            ))}
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
                toast(`Rutina „${routine.name}“ aktualizována`);
              }}
            >
              🔄 Aktualizovat rutinu podle tohoto tréninku
            </button>
          ) : (
            <button
              className="btn soft block"
              onClick={() => {
                routineFromWorkout(w.id);
                toast('Uloženo jako nová rutina');
              }}
            >
              💾 Uložit jako rutinu
            </button>
          )}
        </div>
      )}

      {w.notes && (
        <div className="card mt-l">
          <div className="small muted bold">Poznámka</div>
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
                        {s.rpe ? <span className="muted"> @ RPE {String(s.rpe).replace('.', ',')}</span> : null}
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
                  Nejlepší odhad 1RM: {fmtNum(toDisplayWeight(best, unit))} {unit}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn primary block section" onClick={shareImage}>
        <ImageDown size={18} /> Sdílet obrázek tréninku
      </button>
      <div className="grid-3 mt">
        <button className="btn sm" onClick={repeat}>
          <Repeat2 size={16} /> Znovu
        </button>
        <button className="btn sm" onClick={share}>
          <Share2 size={16} /> Text
        </button>
        <button
          className="btn sm danger"
          onClick={() => {
            if (window.confirm('Smazat tento trénink?')) {
              deleteWorkout(w.id);
              navigate('/history', { replace: true });
            }
          }}
        >
          <Trash2 size={16} /> Smazat
        </button>
      </div>
      {celebrating && (
        <Celebration
          xp={xp}
          totalXp={game.totalXp}
          prs={prs.filter((p) => p.kind !== 'volume').length}
          achievements={newAchievements.map((a) => a.icon)}
          onClose={() => setCelebrating(false)}
        />
      )}
      {!isSummary && !routine && (
        <button
          className="btn block mt"
          onClick={() => {
            routineFromWorkout(w.id);
            toast('Uloženo jako nová rutina');
          }}
        >
          💾 Uložit jako rutinu
        </button>
      )}
    </div>
  );
}
