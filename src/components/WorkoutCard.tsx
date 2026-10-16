import { Link } from 'react-router-dom';
import { Clock, Layers, Trophy, Weight } from 'lucide-react';
import type { Workout } from '../types';
import { useExerciseMap, useStore } from '../store/store';
import { doneSetCount, workoutDurationMs, workoutVolume } from '../lib/calc';
import { fmtDateTime, fmtDuration, fmtVolume } from '../lib/format';
import { t, tn } from '../i18n';

export function WorkoutCard({ w, prCount }: { w: Workout; prCount?: number }) {
  const exMap = useExerciseMap();
  const unit = useStore((s) => s.settings.unit);
  return (
    <Link to={`/history/${w.id}`} className="card tap" style={{ display: 'block' }}>
      <div className="row between">
        <h3 className="ellipsis">{w.name}</h3>
        {!!prCount && <span className="badge gold">
            <Trophy size={12} /> {prCount}
          </span>}
      </div>
      <div className="small muted">{fmtDateTime(w.startedAt)}</div>
      <div className="row small" style={{ gap: 14, marginTop: 8 }}>
        <span className="meta">
          <Clock size={13} /> {fmtDuration(workoutDurationMs(w))}
        </span>
        <span className="meta">
          <Weight size={13} /> {fmtVolume(workoutVolume(w, exMap), unit)}
        </span>
        <span className="meta">
          <Layers size={13} /> {tn(doneSetCount(w), '{n} set', '{n} sets')}
        </span>
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>
        {w.exercises.slice(0, 4).map((e) => (
          <div key={e.id} className="ellipsis">
            {e.sets.length} × {exMap.get(e.exerciseId)?.name ?? t('Unknown exercise')}
          </div>
        ))}
        {w.exercises.length > 4 && <div>{t('and {n} more…', { n: w.exercises.length - 4 })}</div>}
      </div>
    </Link>
  );
}
